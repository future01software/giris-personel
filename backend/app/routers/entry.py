import os
import hmac
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from twilio.rest import Client

from app.models import EntryDecision
from app.db import db, DEMO_MODE
from app.deps import get_current_user, require_role
from app.presence import PRESENCE, ensure_presence_ready, record_presence, rebuild_presence
from app.utils import new_id
from app.websocket import manager

router = APIRouter(prefix="/entry", tags=["entry"])

# Twilio (optional)
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_PHONE = os.environ.get("TWILIO_PHONE_NUMBER")

twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except Exception as e:
        logging.warning(f"Twilio initialization failed: {e}")


def _to_action(decision_value: str) -> str:
    """
    UI'dan gelen decision değerini action'a çevirir.
    - Eğer zaten IN/OUT geliyorsa aynen döndürür.
    - Eğer approved/rejected geliyorsa:
        approved -> IN
        rejected -> OUT
    """
    d = (decision_value or "").upper().strip()

    if d in ("IN", "OUT"):
        return d

    if d in ("APPROVED", "ALLOW", "ALLOWED", "ACCEPTED", "OK"):
        return "IN"
    if d in ("REJECTED", "DENY", "DENIED", "NOT_OK", "NO"):
        return "OUT"

    return "OUT"


@router.post("/decision")
async def make_entry_decision(decision: EntryDecision, current_user: dict = Depends(get_current_user)):
    current_user["role"] = (current_user.get("role") or "").lower()
    await require_role(current_user, ["admin", "security"])

    now = datetime.now(timezone.utc)
    action = _to_action(getattr(decision, "decision", None))
    personnel_id = getattr(decision, "personnel_id", None)

    # Mükerrer / tutarsız hareketleri engelle (çift tıklama, eski ekran vb.)
    # Sadece açık IN/OUT hareketlerinde; approved/rejected gibi eski kararlar etkilenmez.
    explicit = (decision.decision or "").upper().strip()
    if personnel_id and explicit in ("IN", "OUT") and not DEMO_MODE:
        await ensure_presence_ready()
        presence = await db[PRESENCE].find_one({"person_id": personnel_id}, {"_id": 0, "status": 1})
        is_inside = (presence or {}).get("status") == "IN"
        if explicit == "IN" and is_inside:
            raise HTTPException(status_code=409, detail="Personel zaten içeride görünüyor. Önce çıkış yapın.")
        if explicit == "OUT" and not is_inside:
            raise HTTPException(status_code=409, detail="Personel içeride görünmüyor, çıkış verilemez.")

    # ✅ Personel snapshot (liste hızlı dolsun)
    personnel = None
    if personnel_id:
        personnel = await db.personnel.find_one({"id": personnel_id})

    person_full_name = (personnel or {}).get("full_name") or ""
    person_company = (personnel or {}).get("company") or ""
    person_tc = (personnel or {}).get("tc_number") or ""

    created_by_name = current_user.get("full_name") or current_user.get("email") or "unknown"
    gate = getattr(decision, "gate", None) or ""

    # ✅ Hem eski hem yeni alanlar birlikte
    log = {
        "id": new_id("log"),

        # ids (uyumluluk için ikisini de yaz)
        "personnel_id": personnel_id,
        "person_id": personnel_id,

        # karar
        "decision": decision.decision,
        "action": action,  # "IN" | "OUT"

        # not/sebep (uyumluluk)
        "reason": getattr(decision, "reason", None) or "",
        "note": getattr(decision, "reason", None) or "",

        # kullanıcı alanları (uyumluluk)
        "checked_by": current_user.get("id"),
        "checked_by_name": created_by_name,
        "checked_by_role": current_user.get("role") or "",

        "created_by_user_id": str(current_user.get("id") or current_user.get("_id") or ""),
        "created_by_role": current_user.get("role") or "",
        "created_by_name": created_by_name,

        # zaman alanları (uyumluluk)
        "timestamp": now.isoformat(),
        "timestamp_ts": now.timestamp(),
        "created_at": now.isoformat(),
        "created_at_ts": now.timestamp(),

        # person snapshot (EntryLogs ekranı için)
        "person_full_name": person_full_name,
        "person_company": person_company,
        "person_tc_number": person_tc,
        "gate": gate,  # ✅ SAHA / LOKASYON
    }

    await db.entry_logs.insert_one(log)
    await record_presence(log)

    # 📡 LIVE UPDATE: Broadcast to all connected clients
    try:
        # Strip MongoDB _id (ObjectId can't be JSON serialized)
        broadcast_log = {k: v for k, v in log.items() if k != "_id"}
        broadcast_personnel = None
        if personnel:
            broadcast_personnel = {k: v for k, v in personnel.items() if k != "_id"}

        await manager.broadcast({
            "type": "NEW_ENTRY",
            "data": {**broadcast_log, "personnel": broadcast_personnel}
        })
    except Exception as e:
        print(f"WS Broadcast failed: {e}")

    # Optional SMS (sadece rejected için)
    if twilio_client and (str(decision.decision).lower() == "rejected"):
        try:
            if personnel and personnel.get("phone"):
                message = f"Entry rejected: {getattr(decision, 'reason', None) or 'Document issue'}"
                await run_in_threadpool(
                    twilio_client.messages.create, body=message, from_=TWILIO_PHONE, to=personnel["phone"]
                )
        except Exception as e:
            logging.error(f"SMS send failed: {e}")

    return {"message": "Entry decision recorded", "id": log["id"], "action": action}


@router.get("/logs")
async def get_entry_logs(limit: int = 100, current_user: dict = Depends(get_current_user)):
    current_user["role"] = (current_user.get("role") or "").lower()
    await require_role(current_user, ["admin", "security"])

    limit = max(1, min(limit, 500))

    logs = await db.entry_logs.find({}, {"_id": 0}).sort("timestamp_ts", -1).to_list(limit)
    if not logs:
        logs = await db.entry_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)

    personnel_ids = list(
        set((log.get("personnel_id") or log.get("person_id")) for log in logs if (log.get("personnel_id") or log.get("person_id")))
    )

    all_personnel = []
    if personnel_ids:
        all_personnel = await db.personnel.find({"id": {"$in": personnel_ids}}, {"_id": 0}).to_list(len(personnel_ids))

    personnel_map = {p["id"]: p for p in all_personnel}

    enriched_logs = []
    for log in logs:
        pid = log.get("personnel_id") or log.get("person_id")
        personnel = personnel_map.get(pid)
        enriched_logs.append({**log, "personnel": personnel})

    return enriched_logs


@router.get("/logs/_ping")
async def logs_ping():
    return {"ok": True, "where": "entry router is alive"}


@router.get("/logs/sessions")
async def get_entry_log_sessions(
    hours: int = 24,
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    """
    Son X saat içindeki giriş-çıkış hareketlerinden "oturum/süre" üretir.
    Dönüş: entry_time, exit_time, duration_sec dahil.
    """
    current_user["role"] = (current_user.get("role") or "").lower()
    await require_role(current_user, ["admin", "security"])

    hours = max(1, min(hours, 168))   # 1 saat - 7 gün
    limit = max(1, min(limit, 500))

    now_dt = datetime.now(timezone.utc)
    now_ts = now_dt.timestamp()
    cutoff_ts = now_ts - (hours * 3600)

    logs = await (
        db.entry_logs.find({"timestamp_ts": {"$gte": cutoff_ts}}, {"_id": 0})
        .sort("timestamp_ts", -1)
        .to_list(5000)
    )

    if not logs:
        cutoff_iso = datetime.fromtimestamp(cutoff_ts, tz=timezone.utc).isoformat()
        logs = await (
            db.entry_logs.find({"timestamp": {"$gte": cutoff_iso}}, {"_id": 0})
            .sort("timestamp", -1)
            .to_list(5000)
        )

    personnel_ids = list(set((x.get("personnel_id") or x.get("person_id")) for x in logs if (x.get("personnel_id") or x.get("person_id"))))
    personnel_map: Dict[str, Any] = {}
    if personnel_ids:
        ppl = await db.personnel.find({"id": {"$in": personnel_ids}}, {"_id": 0}).to_list(len(personnel_ids))
        personnel_map = {p["id"]: p for p in ppl}

    sessions: Dict[str, Dict[str, Any]] = {}

    def _action_of(log: dict) -> str:
        a = (log.get("action") or "").upper().strip()
        if a in ("IN", "OUT"):
            return a
        return _to_action(log.get("decision") or "")

    def _ts_of(log: dict) -> float:
        ts = log.get("timestamp_ts")
        if isinstance(ts, (int, float)):
            return float(ts)
        try:
            return datetime.fromisoformat((log.get("timestamp") or "").replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0.0

    def _iso_of(log: dict) -> str:
        return (log.get("timestamp") or "")

    for log in logs:
        pid = log.get("personnel_id") or log.get("person_id")
        if not pid:
            continue

        act = _action_of(log)
        if act not in ("IN", "OUT"):
            continue

        ts_num = _ts_of(log)
        iso = _iso_of(log)

        item = sessions.get(pid)
        if not item:
            p = personnel_map.get(pid) or {}
            item = {
                "personnel_id": pid,
                "full_name": p.get("full_name") or "",
                "company": p.get("company") or "",
                "tc_number": p.get("tc_number") or "",
                "personnel": p,

                "entry_time": None,
                "exit_time": None,
                "_entry_ts": None,
                "_exit_ts": None,

                "last_action": None,
                "_last_ts": None,

                "last_guard": log.get("checked_by_name") or "—",
            }
            sessions[pid] = item

        if item["_last_ts"] is None or ts_num >= item["_last_ts"]:
            item["_last_ts"] = ts_num
            item["last_action"] = "in" if act == "IN" else "out"
            item["last_guard"] = log.get("checked_by_name") or item["last_guard"]

        if act == "IN":
            if item["_entry_ts"] is None or ts_num >= item["_entry_ts"]:
                item["_entry_ts"] = ts_num
                item["entry_time"] = iso

            item["_exit_ts"] = None
            item["exit_time"] = None

        elif act == "OUT":
            if item["_exit_ts"] is None or ts_num >= item["_exit_ts"]:
                item["_exit_ts"] = ts_num
                item["exit_time"] = iso

    out_items = []
    for s in sessions.values():
        duration_sec = None
        if s["_entry_ts"] is not None:
            end_ts = s["_exit_ts"] if s["_exit_ts"] is not None else now_ts
            if end_ts >= s["_entry_ts"]:
                duration_sec = int(end_ts - s["_entry_ts"])

        out_items.append({
            "personnel_id": s["personnel_id"],
            "full_name": s["full_name"],
            "company": s["company"],
            "tc_number": s["tc_number"],
            "personnel": s["personnel"],

            "entry_time": s["entry_time"],
            "exit_time": s["exit_time"],
            "duration_sec": duration_sec,

            "last_action": s["last_action"],
            "last_guard": s["last_guard"],
        })

    out_items.sort(key=lambda x: (x.get("entry_time") or ""), reverse=True)
    return {"items": out_items[:limit]}


@router.get("/logs/paginated")
async def get_entry_logs_paginated(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
):
    current_user["role"] = (current_user.get("role") or "").lower()
    await require_role(current_user, ["admin", "security"])

    page = max(1, page)
    limit = max(1, min(limit, 200))
    skip = (page - 1) * limit

    total = await db.entry_logs.count_documents({})

    logs = (
        await db.entry_logs.find({}, {"_id": 0})
        .sort("timestamp_ts", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

    if not logs:
        logs = (
            await db.entry_logs.find({}, {"_id": 0})
            .sort("timestamp", -1)
            .skip(skip)
            .limit(limit)
            .to_list(limit)
        )

    personnel_ids = list(
        set((log.get("personnel_id") or log.get("person_id")) for log in logs if (log.get("personnel_id") or log.get("person_id")))
    )

    all_personnel = []
    if personnel_ids:
        all_personnel = await db.personnel.find({"id": {"$in": personnel_ids}}, {"_id": 0}).to_list(len(personnel_ids))

    personnel_map = {p["id"]: p for p in all_personnel}

    enriched_logs = []
    for log in logs:
        pid = log.get("personnel_id") or log.get("person_id")
        personnel = personnel_map.get(pid)
        enriched_logs.append({**log, "personnel": personnel})

    return {
        "data": enriched_logs,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


# =========================
# İÇERİDEKİLER / DURUM (presence)
# =========================
def _presence_item(p: dict) -> dict:
    return {
        "personnel_id": p.get("person_id"),
        "full_name": p.get("person_full_name") or "",
        "company": p.get("person_company") or "",
        "tc_number": p.get("person_tc_number") or "",
        "status": p.get("status"),
        "gate": p.get("gate") or "",
        "last_ts": p.get("last_ts"),      # epoch saniye
        "last_at": p.get("last_at"),      # ISO (UTC)
        "auto_closed": bool(p.get("auto_closed")),
    }


@router.get("/inside")
async def get_inside(
    gate: Optional[str] = None,
    min_hours: float = 0,
    current_user: dict = Depends(get_current_user),
):
    """Şu an içeride olanlar. gate: o kapıdan giriş yapanlar. min_hours: en az X saattir içeride olanlar."""
    await require_role(current_user, ["admin", "security", "supervisor"])
    if DEMO_MODE:
        return {"items": []}
    await ensure_presence_ready()

    q: Dict[str, Any] = {"status": "IN"}
    if gate:
        q["gate"] = gate
    if min_hours and min_hours > 0:
        q["last_ts"] = {"$lt": datetime.now(timezone.utc).timestamp() - min_hours * 3600}

    rows = await db[PRESENCE].find(q, {"_id": 0}).sort("last_ts", -1).to_list(None)
    return {"items": [_presence_item(r) for r in rows]}


@router.get("/status/{personnel_id}")
async def get_presence_status(personnel_id: str, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin", "security", "supervisor"])
    if DEMO_MODE:
        return {"personnel_id": personnel_id, "status": "OUT", "is_inside": False}
    await ensure_presence_ready()

    p = await db[PRESENCE].find_one({"person_id": personnel_id}, {"_id": 0})
    if not p:
        return {"personnel_id": personnel_id, "status": None, "is_inside": False}
    return {**_presence_item(p), "is_inside": p.get("status") == "IN"}


@router.post("/presence/rebuild")
async def rebuild_presence_endpoint(current_user: dict = Depends(get_current_user)):
    """İçeride durumunu tüm loglardan yeniden üretir (deploy sonrası bir kez / tutarsızlıkta)."""
    await require_role(current_user, ["admin"])
    return await rebuild_presence()


# =========================
# OTOMATİK ÇIKIŞ (unutulan çıkışlar)
# =========================
AUTO_CLOSE_SETTINGS_ID = "auto_close"
AUTO_CLOSE_DEFAULTS = {"enabled": False, "hours": 14}
_optional_bearer = HTTPBearer(auto_error=False)


class AutoCloseSettings(BaseModel):
    enabled: bool
    hours: int


async def _get_auto_close_settings() -> dict:
    doc = await db.settings.find_one({"_id": AUTO_CLOSE_SETTINGS_ID}) or {}
    return {
        "enabled": bool(doc.get("enabled", AUTO_CLOSE_DEFAULTS["enabled"])),
        "hours": int(doc.get("hours", AUTO_CLOSE_DEFAULTS["hours"])),
    }


async def _admin_or_cron(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
) -> str:
    """Cloud Scheduler 'X-Cron-Secret' header'ı ile, admin ise JWT ile çağırır."""
    cron_secret = os.environ.get("CRON_SECRET") or ""
    sent = request.headers.get("X-Cron-Secret") or ""
    if cron_secret and sent and hmac.compare_digest(sent, cron_secret):
        return "cron"
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await get_current_user(credentials)
    await require_role(user, ["admin"])
    return "admin"


@router.get("/auto-close/settings")
async def get_auto_close_settings(current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])
    return await _get_auto_close_settings()


@router.put("/auto-close/settings")
async def update_auto_close_settings(payload: AutoCloseSettings, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])
    if not 1 <= payload.hours <= 72:
        raise HTTPException(status_code=400, detail="Saat 1 ile 72 arasında olmalı")
    await db.settings.update_one(
        {"_id": AUTO_CLOSE_SETTINGS_ID},
        {"$set": {
            "enabled": payload.enabled,
            "hours": payload.hours,
            "updated_by": current_user.get("full_name") or current_user.get("email") or "",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return await _get_auto_close_settings()


@router.post("/auto-close")
async def auto_close_forgotten_exits(dry_run: bool = False, caller: str = Depends(_admin_or_cron)):
    """
    X saatten uzun süredir içeride görünenlere otomatik ÇIKIŞ yazar.
    Çıkış saati = giriş + X saat (gerçek çıkış bilinmediği için süre raporları şişmesin).
    dry_run=true: hiçbir şey yazmaz, kimlerin kapatılacağını döndürür.
    Cron çağrısı sadece ayar açıksa çalışır; admin elle her zaman çalıştırabilir.
    """
    cfg = await _get_auto_close_settings()
    if caller == "cron" and not cfg["enabled"] and not dry_run:
        return {"enabled": False, "dry_run": False, "closed": 0, "items": []}
    if DEMO_MODE:
        return {"enabled": cfg["enabled"], "dry_run": dry_run, "closed": 0, "items": []}

    await ensure_presence_ready()

    limit_sec = cfg["hours"] * 3600
    cutoff = datetime.now(timezone.utc).timestamp() - limit_sec
    candidates = await db[PRESENCE].find(
        {"status": "IN", "last_ts": {"$lt": cutoff}}, {"_id": 0}
    ).to_list(None)

    items = []
    for p in candidates:
        exit_ts = float(p["last_ts"]) + limit_sec
        exit_dt = datetime.fromtimestamp(exit_ts, timezone.utc)
        item = {**_presence_item(p), "exit_at": exit_dt.isoformat()}

        if dry_run:
            items.append(item)
            continue

        log_id = new_id("log")
        # Önce presence'ı atomik olarak "talep et": aynı anda iki çağrı aynı kişiyi iki kez kapatamaz
        claimed = await db[PRESENCE].update_one(
            {"person_id": p["person_id"], "status": "IN", "last_ts": p["last_ts"]},
            {"$set": {
                "status": "OUT", "last_ts": exit_ts, "last_at": exit_dt.isoformat(),
                "last_log_id": log_id, "auto_closed": True,
            }},
        )
        if claimed.modified_count != 1:
            continue

        reason = f"Otomatik çıkış ({cfg['hours']} saat içinde çıkış yapılmadı)"
        await db.entry_logs.insert_one({
            "id": log_id,
            "personnel_id": p["person_id"],
            "person_id": p["person_id"],
            "decision": "OUT",
            "action": "OUT",
            "reason": reason,
            "note": reason,
            "auto_closed": True,
            "checked_by": "system",
            "checked_by_name": "Sistem (Otomatik)",
            "checked_by_role": "system",
            "created_by_user_id": "system",
            "created_by_role": "system",
            "created_by_name": "Sistem (Otomatik)",
            "timestamp": exit_dt.isoformat(),
            "timestamp_ts": exit_ts,
            "created_at": exit_dt.isoformat(),
            "created_at_ts": exit_ts,
            "person_full_name": p.get("person_full_name") or "",
            "person_company": p.get("person_company") or "",
            "person_tc_number": p.get("person_tc_number") or "",
            "gate": p.get("gate") or "",
        })
        items.append(item)

    return {"enabled": cfg["enabled"], "dry_run": dry_run, "closed": 0 if dry_run else len(items), "items": items}

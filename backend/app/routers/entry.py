import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any

from fastapi import APIRouter, Depends
from twilio.rest import Client

from app.models import EntryDecision
from app.db import db
from app.deps import get_current_user, require_role
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
                twilio_client.messages.create(body=message, from_=TWILIO_PHONE, to=personnel["phone"])
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

"""
İçeride / dışarıda durumu (presence).

Her personelin SON hareketi `entry_presence` koleksiyonunda tek satır olarak tutulur.
Böylece "içeridekiler" listesi, kişi durumu, dashboard sayısı ve otomatik çıkış
tüm entry_logs'u taramadan, tek ve hızlı bir sorguyla bulunur.

entry_logs hâlâ tek doğruluk kaynağıdır; presence her zaman ondan yeniden üretilebilir
(rebuild_presence).
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from pymongo import UpdateOne
from pymongo.errors import BulkWriteError, DuplicateKeyError

from .db import db, DEMO_MODE

logger = logging.getLogger(__name__)

PRESENCE = "entry_presence"
_SYNC_DOC_ID = "presence_sync"
# Aynı anda eski revision'ın yazdığı kayıtları kaçırmamak için senkronda geriye bakış payı
_CATCHUP_MARGIN_SEC = 3600

_IN_VALUES = {"IN", "APPROVED", "ALLOW", "ALLOWED", "ACCEPTED", "OK"}

_LOG_PROJECTION = {
    "_id": 0, "id": 1, "person_id": 1, "personnel_id": 1, "action": 1, "decision": 1,
    "created_at_ts": 1, "timestamp_ts": 1, "created_at": 1, "timestamp": 1, "gate": 1,
    "person_full_name": 1, "person_company": 1, "person_tc_number": 1, "auto_closed": 1,
}


def action_of(log: dict) -> str:
    a = (log.get("action") or "").upper().strip()
    if a in ("IN", "OUT"):
        return a
    d = (log.get("decision") or "").upper().strip()
    return "IN" if d in _IN_VALUES else "OUT"


def ts_of(log: dict) -> float:
    for key in ("created_at_ts", "timestamp_ts"):
        if isinstance(log.get(key), (int, float)):
            return float(log[key])
    iso = log.get("created_at") or log.get("timestamp")
    if iso:
        try:
            dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()
        except Exception:
            pass
    return 0.0


def _presence_update(log: dict) -> Optional[tuple[dict, dict]]:
    pid = log.get("person_id") or log.get("personnel_id")
    if not pid:
        return None
    ts = ts_of(log)
    doc = {
        "person_id": pid,
        "status": action_of(log),
        "last_ts": ts,
        "last_at": datetime.fromtimestamp(ts, timezone.utc).isoformat(),
        "gate": log.get("gate") or "",
        "last_log_id": log.get("id"),
        "person_full_name": log.get("person_full_name") or "",
        "person_company": log.get("person_company") or "",
        "person_tc_number": log.get("person_tc_number") or "",
        "auto_closed": bool(log.get("auto_closed")),
    }
    # Sadece daha yeni hareket eski durumu ezebilir. Daha yeni bir kayıt varsa filtre eşleşmez,
    # upsert insert dener ve unique index DuplicateKeyError verir -> yok sayılır.
    return {"person_id": pid, "last_ts": {"$lte": ts}}, {"$set": doc}


async def record_presence(log: dict) -> None:
    upd = _presence_update(log)
    if upd is None or DEMO_MODE:
        return
    try:
        await db[PRESENCE].update_one(*upd, upsert=True)
    except DuplicateKeyError:
        pass


async def _apply_logs(cursor) -> tuple[int, float]:
    latest: dict[str, dict] = {}
    max_ts = 0.0
    async for log in cursor:
        pid = log.get("person_id") or log.get("personnel_id")
        if not pid:
            continue
        ts = ts_of(log)
        max_ts = max(max_ts, ts)
        prev = latest.get(pid)
        if prev is None or ts >= ts_of(prev):
            latest[pid] = log

    ops = [
        UpdateOne(*upd, upsert=True)
        for upd in (_presence_update(l) for l in latest.values())
        if upd is not None
    ]
    for i in range(0, len(ops), 1000):
        try:
            await db[PRESENCE].bulk_write(ops[i:i + 1000], ordered=False)
        except BulkWriteError as e:
            # 11000 = daha yeni kayıt zaten var; diğer hatalar gerçek hata
            others = [err for err in e.details.get("writeErrors", []) if err.get("code") != 11000]
            if others:
                raise
    return len(latest), max_ts


async def rebuild_presence() -> dict:
    """Tüm entry_logs'tan presence'ı baştan üretir (admin endpoint'i ve ilk kurulum)."""
    count, max_ts = await _apply_logs(db.entry_logs.find({}, _LOG_PROJECTION))
    await db.meta.update_one(
        {"_id": _SYNC_DOC_ID},
        {"$set": {"max_ts": max_ts, "synced_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"people": count, "max_ts": max_ts}


async def _sync_presence() -> None:
    try:
        await db[PRESENCE].create_index("person_id", unique=True)
        await db[PRESENCE].create_index([("status", 1), ("last_ts", 1)])
    except Exception as e:
        logger.warning(f"presence index creation failed: {e}")

    sync = await db.meta.find_one({"_id": _SYNC_DOC_ID})
    if not sync:
        result = await rebuild_presence()
        logger.info(f"presence rebuilt from entry_logs: {result}")
        return

    # Bu revision devreye girmeden önce (eski sürümün) yazdığı logları da işle
    since = float(sync.get("max_ts") or 0) - _CATCHUP_MARGIN_SEC
    count, max_ts = await _apply_logs(
        db.entry_logs.find(
            {"$or": [{"created_at_ts": {"$gte": since}}, {"timestamp_ts": {"$gte": since}}]},
            _LOG_PROJECTION,
        )
    )
    if max_ts > float(sync.get("max_ts") or 0):
        await db.meta.update_one({"_id": _SYNC_DOC_ID}, {"$set": {"max_ts": max_ts}})
    logger.info(f"presence catch-up done: {count} people updated")


_sync_task: Optional[asyncio.Task] = None


async def ensure_presence_ready() -> None:
    """İlk çağrıda presence'ı entry_logs ile senkronlar; sonraki çağrılar beklemeden döner."""
    global _sync_task
    if DEMO_MODE:
        return
    if _sync_task is None:
        _sync_task = asyncio.create_task(_sync_presence())
    try:
        await asyncio.shield(_sync_task)
    except Exception as e:
        logger.error(f"presence sync failed: {e}")
        _sync_task = None  # bir sonraki istekte tekrar dene

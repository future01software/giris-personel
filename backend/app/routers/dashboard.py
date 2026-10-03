from datetime import datetime, timezone, timedelta
import time

from fastapi import APIRouter, Depends
from app.db import db, DEMO_MODE
from app.deps import get_current_user
from app.presence import PRESENCE, ensure_presence_ready

TR_TZ = timezone(timedelta(hours=3))

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# ── 30-saniye cache: Aynı anda birden çok kullanıcı = aynı DB sorgusu bir kez ──
_stats_cache = {"data": None, "ts": 0}
CACHE_TTL = 30  # saniye


@router.get("/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if DEMO_MODE:
        return {
            "total_personnel": 124,
            "total_entries_today": 42,
            "approved_today": 38,
            "rejected_today": 4,
            "can_enter": 118,
            "cannot_enter": 6,
            "inside_count": 12
        }

    # Cache kontrolü
    now_ts = time.time()
    if _stats_cache["data"] and (now_ts - _stats_cache["ts"]) < CACHE_TTL:
        return _stats_cache["data"]

    total_personnel = await db.personnel.count_documents({})

    # "Bugün" Türkiye saatine göre (UTC gece yarısı değil)
    today_start = datetime.now(TR_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    today_q = {"$or": [
        {"timestamp_ts": {"$gte": today_start.timestamp()}},
        # eski kayıtlar: sadece ISO string var (UTC olarak yazılmış)
        {"timestamp_ts": {"$exists": False},
         "timestamp": {"$gte": today_start.astimezone(timezone.utc).isoformat()}},
    ]}

    total_entries_today = await db.entry_logs.count_documents(today_q)
    # Yeni kayıtlar decision "IN"/"OUT" yazıyor; eski kayıtlar "approved"/"rejected"
    approved_today = await db.entry_logs.count_documents(
        {"$and": [today_q, {"$or": [{"action": "IN"}, {"decision": {"$in": ["approved", "APPROVED", "IN"]}}]}]}
    )
    rejected_today = await db.entry_logs.count_documents(
        {"$and": [today_q, {"decision": {"$in": ["rejected", "REJECTED"]}}]}
    )

    # Bu endpoint zaten ayrı bir mantıkla yazılmıştı; BOZMADAN taşıyoruz.
    all_personnel = await db.personnel.find({}, {"_id": 0, "id": 1, "assignment_end": 1}).to_list(None)
    doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
    doc_types_map = {dt["id"]: dt for dt in doc_types}

    all_documents = await db.personnel_documents.find(
        {}, {"_id": 0, "personnel_id": 1, "document_type_id": 1, "expiry_date": 1}
    ).to_list(None)

    documents_by_personnel = {}
    for doc in all_documents:
        documents_by_personnel.setdefault(doc["personnel_id"], []).append(doc)

    can_enter = 0
    cannot_enter = 0
    now = datetime.now(timezone.utc)

    for person in all_personnel:
        assignment_expired = False
        if person.get("assignment_end"):
            assignment_end_str = person["assignment_end"]
            if assignment_end_str and assignment_end_str not in ["-", "nan", "", "None"]:
                try:
                    assignment_end = datetime.fromisoformat(assignment_end_str) if isinstance(assignment_end_str, str) else assignment_end_str
                    if assignment_end.tzinfo is None:
                        assignment_end = assignment_end.replace(tzinfo=timezone.utc)
                    if assignment_end < now:
                        assignment_expired = True
                except (ValueError, AttributeError):
                    pass

        if assignment_expired:
            cannot_enter += 1
            continue

        documents = documents_by_personnel.get(person["id"], [])
        has_expired = False
        for doc in documents:
            doc_type = doc_types_map.get(doc["document_type_id"])
            if doc_type and doc_type["is_mandatory"]:
                expiry_str = doc["expiry_date"]
                try:
                    expiry = datetime.fromisoformat(expiry_str) if isinstance(expiry_str, str) else expiry_str
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if (expiry - now).days < 0:
                        has_expired = True
                        break
                except (ValueError, AttributeError):
                    has_expired = True
                    break

        if has_expired:
            cannot_enter += 1
        else:
            can_enter += 1

    result = {
        "total_personnel": total_personnel,
        "total_entries_today": total_entries_today,
        "approved_today": approved_today,
        "rejected_today": rejected_today,
        "can_enter": can_enter,
        "cannot_enter": cannot_enter,
        "inside_count": await _calculate_inside_count()
    }

    # Cache'e kaydet
    _stats_cache["data"] = result
    _stats_cache["ts"] = time.time()

    return result

async def _calculate_inside_count() -> int:
    # Son hareketi IN olan herkes (24 saat sınırı yok; uzun süre içeride kalan da sayılır)
    await ensure_presence_ready()
    return await db[PRESENCE].count_documents({"status": "IN"})

from datetime import datetime, timezone, timedelta
import time

from fastapi import APIRouter, Depends
from app.db import db, DEMO_MODE
from app.deps import get_current_user
from app.presence import PRESENCE, ensure_presence_ready
from app.utils import compute_can_enter_map

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

    # Personel listesiyle AYNI kural (mükerrer evrak, saat dilimi, engel, eksik evrak dahil)
    all_personnel = await db.personnel.find(
        {},
        {"_id": 0, "id": 1, "assignment_start": 1, "assignment_end": 1,
         "entry_blocked": 1, "is_blocked": 1, "blocked": 1},
    ).to_list(None)
    can_map = await compute_can_enter_map(all_personnel)
    can_enter = sum(1 for v in can_map.values() if v)
    cannot_enter = sum(1 for v in can_map.values() if not v)

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

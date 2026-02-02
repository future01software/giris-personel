from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from app.db import db
from app.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_personnel = await db.personnel.count_documents({})

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_entries_today = await db.entry_logs.count_documents({"timestamp": {"$gte": today_start.isoformat()}})
    approved_today = await db.entry_logs.count_documents({"timestamp": {"$gte": today_start.isoformat()}, "decision": "approved"})
    rejected_today = await db.entry_logs.count_documents({"timestamp": {"$gte": today_start.isoformat()}, "decision": "rejected"})

    # Bu endpoint zaten ayrı bir mantıkla yazılmıştı; BOZMADAN taşıyoruz.
    all_personnel = await db.personnel.find({}, {"_id": 0, "id": 1, "assignment_end": 1}).to_list(1000)
    doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
    doc_types_map = {dt["id"]: dt for dt in doc_types}

    all_documents = await db.personnel_documents.find(
        {}, {"_id": 0, "personnel_id": 1, "document_type_id": 1, "expiry_date": 1}
    ).to_list(10000)

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

    return {
        "total_personnel": total_personnel,
        "total_entries_today": total_entries_today,
        "approved_today": approved_today,
        "rejected_today": rejected_today,
        "can_enter": can_enter,
        "can_enter": can_enter,
        "cannot_enter": cannot_enter,
        "inside_count": await _calculate_inside_count()
    }

async def _calculate_inside_count() -> int:
    # 1. Get logs from last 24 hours (to capture active shifts)
    # Ideally we should scan further back, but for performance 24h-48h is typical window.
    # If someone stayed more than 24h, they might fall off this count, which is acceptable for "live" dashboard.
    lookback = datetime.now(timezone.utc) - timedelta(hours=24)
    query = {"timestamp": {"$gte": lookback.isoformat()}}
    
    # Snapshot of person_status
    status_map = {} # pid -> "IN" | "OUT"

    # Fetch all logs for last 24h (asc by time)
    # We use a cursor processing to be memory efficient
    cursor = db.entry_logs.find(query).sort("timestamp_ts", 1)
    
    async for log in cursor:
        pid = log.get("person_id") or log.get("personnel_id")
        if not pid: 
            continue
        
        # Normalize action
        action_raw = log.get("action") or log.get("decision") or ""
        # _to_action helpers are in entry_logs.py, duplicating simple version here to avoid circular imports or refactor overhead
        a = str(action_raw).upper().strip()
        final_action = "OUT"
        if a in ["IN", "APPROVED", "ALLOW", "ALLOWED", "ACCEPTED", "OK"]:
            final_action = "IN"
            
        status_map[pid] = final_action

    # Count how many are 'IN'
    count = sum(1 for status in status_map.values() if status == "IN")
    return count

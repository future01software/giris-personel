from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Dict, Any
import math

from app.db import db, DEMO_MODE
from app.deps import get_current_user
from openpyxl import Workbook
from io import BytesIO
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/entry-logs", tags=["EntryLogs"])

# =========================
# AUTH
# =========================
def _role(user: dict) -> str:
    return (user.get("role") or "").lower()

def require_role(user: dict, allowed: List[str]):
    if _role(user) not in [a.lower() for a in allowed]:
        raise HTTPException(status_code=403, detail="Yetkisiz işlem")

# =========================
# TIME HELPERS
# =========================
TR_TZ = timezone(timedelta(hours=3))

def _parse_day(day_str: str) -> date:
    try:
        return datetime.strptime(day_str, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="day formatı YYYY-MM-DD olmalı")

def _day_bounds(day_str: str):
    d = _parse_day(day_str)
    start_local = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=TR_TZ)
    end_local = start_local + timedelta(days=1)
    return start_local, end_local

def _clean(doc: dict) -> dict:
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d["_id"])
        d.pop("_id", None)
    return d

def _to_action_from_decision(decision_value: str) -> str:
    d = (decision_value or "").upper().strip()
    if d in ("IN", "OUT"):
        return d
    if d in ("APPROVED", "ALLOW", "ALLOWED", "ACCEPTED", "OK", "IN"):
        return "IN"
    if d in ("REJECTED", "DENY", "DENIED", "NOT_OK", "NO", "OUT"):
        return "OUT"
    return "OUT"

def _action_of(log: dict) -> str:
    a = (log.get("action") or "").upper().strip()
    if a in ("IN", "OUT"):
        return a
    return _to_action_from_decision(log.get("decision") or "")

def _iso_of(log: dict) -> Optional[str]:
    return log.get("created_at") or log.get("timestamp")

def _ts_of(log: dict) -> float:
    if isinstance(log.get("created_at_ts"), (int, float)):
        return float(log["created_at_ts"])
    if isinstance(log.get("timestamp_ts"), (int, float)):
        return float(log["timestamp_ts"])
    iso = _iso_of(log)
    if iso:
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0.0
    return 0.0

# =========================
# QUERY BUILDER (day filter robust)
# =========================
def _build_day_query(day: Optional[str], action: Optional[str]) -> Dict[str, Any]:
    q: Dict[str, Any] = {}

    if day:
        start_local, end_local = _day_bounds(day)
        start_ts = start_local.timestamp()
        end_ts = end_local.timestamp()

        day_prefix = day
        regex = {"$regex": f"^{day_prefix}"}

        or_list = [
            {"created_at_ts": {"$gte": start_ts, "$lt": end_ts}},
            {"timestamp_ts": {"$gte": start_ts, "$lt": end_ts}},
            {"created_at": regex},
            {"timestamp": regex},
        ]
        q["$or"] = or_list

    if action:
        a = action.upper().strip()
        if a not in ("IN", "OUT"):
            raise HTTPException(status_code=400, detail="action IN veya OUT olmalı")
        
        # Sadece action veya decision alanına göre DB'de filtrele
        q["$or"] = q.get("$or", []) + [
            {"action": a},
            {"decision": a}
        ]

    return q

# =========================
# ✅ UPDATED: SEARCH (lookback + duration_sec)
# ==================@router.get("/search")
async def search_entry_logs(
    q: str,
    day: Optional[str] = None,          # YYYY-MM-DD opsiyonel
    action: Optional[str] = None,       # IN/OUT opsiyonel
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    """
    q: person adı / şirket / tc ile arama (snapshot alanları üzerinden)
    day: verilirse TR günü; ayrıca lookback ile (önceki gün IN) yakalanır
    action: IN/OUT
    NOT: OUT satırına duration_sec ekler (IN->OUT farkı)
    """
    require_role(current_user, ["admin", "security"])

    q_str = (q or "").strip()
    if not q_str:
        return {"items": []}

    limit = max(1, min(limit, 500))

    # action filtre isteği
    action_req = None
    if action:
        a = action.upper().strip()
        if a not in ("IN", "OUT"):
            raise HTTPException(status_code=400, detail="action IN veya OUT olmalı")
        action_req = a

    # 1) Arama filtreleri (snapshot alanları)
    search_clauses = [
        {"person_full_name": {"$regex": q_str, "$options": "i"}},
        {"person_company": {"$regex": q_str, "$options": "i"}},
        {"person_tc_number": {"$regex": q_str, "$options": "i"}},
    ]
    query = {"$or": search_clauses}

    # 2) Action filtresini de DB seviyesine ekle (Eğer day yoksa)
    # Day varsa duration hesabı için tüm actionları çekmemiz gerekebilir, 
    # ama genellikle arama yaparken sadece IN veya sadece OUT isteniyorsa DB'de filtrelemek mantıklı.
    # Ancak duration hesabı için OUT logu için eşleşen IN loguna ihtiyacımız var.
    # Bu yüzden sadece 'action' filtresini day yoksa DB'de yapalım.
    if action_req and not day:
        query = {"$and": [
            query,
            {"$or": [{"action": action_req}, {"decision": action_req}]}
        ]}

    # 3) Day varsa: lookback ile çek (önceki gün başlayan uzun mesailer için)
    start_ts = None
    end_ts = None
    if day:
        start_local, end_local = _day_bounds(day)
        start_ts = start_local.timestamp()
        end_ts = end_local.timestamp()
        lookback_ts = start_ts - 48 * 3600  # 48 saat güvenli aralık
        
        day_prefix = day
        regex = {"$regex": f"^{day_prefix}"}

        day_query = {
            "$or": [
                {"created_at_ts": {"$gte": lookback_ts, "$lt": end_ts}},
                {"timestamp_ts": {"$gte": lookback_ts, "$lt": end_ts}},
                {"created_at": regex},
                {"timestamp": regex},
            ]
        }
        query = {"$and": [query, day_query]}

    # Veriyi çek
    cursor = db["entry_logs"].find(query).sort([("created_at_ts", 1)])
    raw = [_clean(x) async for x in cursor.limit(limit * 5)]

    # Normalize fields
    for x in raw:
        x["action"] = _action_of(x)
        x["_ts"] = _ts_of(x)
        if not x.get("person_id") and x.get("personnel_id"):
            x["person_id"] = x["personnel_id"]
        if not x.get("personnel_id") and x.get("person_id"):
            x["personnel_id"] = x["person_id"]
        if not x.get("created_at") and x.get("timestamp"):
            x["created_at"] = x["timestamp"]
        if not x.get("created_by_name") and x.get("checked_by_name"):
            x["created_by_name"] = x["checked_by_name"]

    # Duration_sec hesapla (kişi bazlı IN->OUT)
    # Not: Sıralama asc (1) yaptık ki baştan sona eşleşsinler
    open_in: Dict[str, float] = {}
    duration_by_id: Dict[str, int] = {}

    for log in raw:
        pid = log.get("person_id") or log.get("personnel_id")
        if not pid:
            continue
        act = log.get("action")
        ts = float(log.get("_ts") or 0)

        if act == "IN":
            open_in[pid] = ts
        elif act == "OUT":
            in_ts = open_in.pop(pid, None)
            if in_ts is not None and ts > in_ts:
                duration_by_id[log["id"]] = int(ts - in_ts)

    # Day/Action filtreleri ve duration ekleme
    items = []
    for log in raw:
        # Duration ekle
        if log.get("action") == "OUT":
            log["duration_sec"] = duration_by_id.get(log["id"])
        
        # Day filtre
        if day and start_ts is not None and end_ts is not None:
            ts = log.get("_ts") or 0
            if not (start_ts <= ts < end_ts):
                continue
        
        # Action filtre (Response seviyesinde, duration hesabı bozulmasın diye burada kalsın)
        if action_req and log.get("action") != action_req:
            continue
            
        items.append(log)

    # Son olarak DESC sırala ve limit uygula
    items.sort(key=lambda z: z.get("_ts", 0), reverse=True)
    items = items[:limit]

    for it in items:
        it.pop("_ts", None)

    return {"items": items}

# =========================
# PAGINATED EVENT LIST
# =========================
@router.get("/paginated")
async def paginated(
    page: int = 1,
    limit: int = 20,
    day: Optional[str] = None,        # YYYY-MM-DD (TR günü)
    action: Optional[str] = None,     # IN/OUT (opsiyonel)
    current_user: dict = Depends(get_current_user),
):
    require_role(current_user, ["admin", "security"])

    if DEMO_MODE:
        now = datetime.now(timezone.utc)
        mock_items = [
            {
                "id": "demo_log_1",
                "person_id": "demo_p_0", "personnel_id": "demo_p_0",
                "person_full_name": "Ahmet Yılmaz",
                "person_company": "Demolife İnşaat",
                "person_tc_number": "12345678900",
                "action": "IN", "decision": "IN",
                "timestamp": (now - timedelta(minutes=5)).isoformat(),
                "created_at": (now - timedelta(minutes=5)).isoformat(),
                "timestamp_ts": (now - timedelta(minutes=5)).timestamp(),
                "created_at_ts": (now - timedelta(minutes=5)).timestamp(),
                "checked_by_name": "Demo Admin",
                "gate": "PORT_FACILITY"
            },
            {
                "id": "demo_log_2",
                "person_id": "demo_p_1", "personnel_id": "demo_p_1",
                "person_full_name": "Mehmet Demir",
                "person_company": "Demolife İnşaat",
                "person_tc_number": "12345678901",
                "action": "IN", "decision": "IN",
                "timestamp": (now - timedelta(minutes=20)).isoformat(),
                "created_at": (now - timedelta(minutes=20)).isoformat(),
                "timestamp_ts": (now - timedelta(minutes=20)).timestamp(),
                "created_at_ts": (now - timedelta(minutes=20)).timestamp(),
                "checked_by_name": "Demo Admin",
                "gate": "PORT_FACILITY"
            },
            {
                "id": "demo_log_3",
                "person_id": "demo_p_4", "personnel_id": "demo_p_4",
                "person_full_name": "Can Özkan",
                "person_company": "Atlas Tersane",
                "person_tc_number": "12345678904",
                "action": "IN", "decision": "IN",
                "timestamp": (now - timedelta(minutes=45)).isoformat(),
                "created_at": (now - timedelta(minutes=45)).isoformat(),
                "timestamp_ts": (now - timedelta(minutes=45)).timestamp(),
                "created_at_ts": (now - timedelta(minutes=45)).timestamp(),
                "checked_by_name": "Demo Admin",
                "gate": "ADMIN_BUILDING"
            },
            {
                "id": "demo_log_4",
                "person_id": "demo_p_2", "personnel_id": "demo_p_2",
                "person_full_name": "Ayşe Kaya",
                "person_company": "Yıldız Liman",
                "person_tc_number": "12345678902",
                "action": "OUT", "decision": "OUT",
                "timestamp": (now - timedelta(hours=1)).isoformat(),
                "created_at": (now - timedelta(hours=1)).isoformat(),
                "timestamp_ts": (now - timedelta(hours=1)).timestamp(),
                "created_at_ts": (now - timedelta(hours=1)).timestamp(),
                "checked_by_name": "Demo Admin",
                "gate": "PORT_FACILITY",
                "duration_sec": 14400
            },
            {
                "id": "demo_log_5",
                "person_id": "demo_p_2", "personnel_id": "demo_p_2",
                "person_full_name": "Ayşe Kaya",
                "person_company": "Yıldız Liman",
                "person_tc_number": "12345678902",
                "action": "IN", "decision": "IN",
                "timestamp": (now - timedelta(hours=5)).isoformat(),
                "created_at": (now - timedelta(hours=5)).isoformat(),
                "timestamp_ts": (now - timedelta(hours=5)).timestamp(),
                "created_at_ts": (now - timedelta(hours=5)).timestamp(),
                "checked_by_name": "Demo Admin",
                "gate": "PORT_FACILITY"
            },
            {
                "id": "demo_log_6",
                "person_id": "demo_p_1", "personnel_id": "demo_p_1",
                "person_full_name": "Mehmet Demir",
                "person_company": "Demolife İnşaat",
                "person_tc_number": "12345678901",
                "action": "OUT", "decision": "OUT",
                "timestamp": (now - timedelta(hours=2)).isoformat(),
                "created_at": (now - timedelta(hours=2)).isoformat(),
                "timestamp_ts": (now - timedelta(hours=2)).timestamp(),
                "created_at_ts": (now - timedelta(hours=2)).timestamp(),
                "checked_by_name": "Demo Admin",
                "gate": "PORT_FACILITY",
                "duration_sec": 28800
            },
            {
                "id": "demo_log_7",
                "person_id": "demo_p_1", "personnel_id": "demo_p_1",
                "person_full_name": "Mehmet Demir",
                "person_company": "Demolife İnşaat",
                "person_tc_number": "12345678901",
                "action": "IN", "decision": "IN",
                "timestamp": (now - timedelta(hours=10)).isoformat(),
                "created_at": (now - timedelta(hours=10)).isoformat(),
                "timestamp_ts": (now - timedelta(hours=10)).timestamp(),
                "created_at_ts": (now - timedelta(hours=10)).timestamp(),
                "checked_by_name": "Demo Admin",
                "gate": "PORT_FACILITY"
            },
            {
                "id": "demo_log_8",
                "person_id": "demo_p_0", "personnel_id": "demo_p_0",
                "person_full_name": "Ahmet Yılmaz",
                "person_company": "Demolife İnşaat",
                "person_tc_number": "12345678900",
                "action": "OUT", "decision": "OUT",
                "timestamp": (now - timedelta(hours=3)).isoformat(),
                "created_at": (now - timedelta(hours=3)).isoformat(),
                "timestamp_ts": (now - timedelta(hours=3)).timestamp(),
                "created_at_ts": (now - timedelta(hours=3)).timestamp(),
                "checked_by_name": "Demo Admin",
                "gate": "PORT_FACILITY",
                "duration_sec": 18000
            },
        ]
        return {"data": mock_items, "page": 1, "pages": 1, "total": len(mock_items)}

    page = max(1, page)
    limit = max(1, min(limit, 200))
    skip = (page - 1) * limit

    q = _build_day_query(day, action)

    # MongoDB natively handles skip, limit and sort much faster
    cursor = db["entry_logs"].find(q).sort([("created_at_ts", -1), ("timestamp_ts", -1)]).skip(skip).limit(limit)
    raw = [_clean(x) async for x in cursor]

    for x in raw:
        x["action"] = _action_of(x)
        # _ts is only used for sorting which we now do in DB
        # x["_ts"] = _ts_of(x) 
        if not x.get("person_id") and x.get("personnel_id"):
            x["person_id"] = x["personnel_id"]
        if not x.get("personnel_id") and x.get("person_id"):
            x["personnel_id"] = x["person_id"]

    # total count for pagination
    total = await db["entry_logs"].count_documents(q)
    pages = max(1, math.ceil(total / limit))

    page_items = raw

    ids = list({(i.get("person_id") or i.get("personnel_id")) for i in page_items if (i.get("person_id") or i.get("personnel_id"))})
    personnel_map: Dict[str, Any] = {}
    if ids:
        ppl = await db["personnel"].find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
        personnel_map = {p["id"]: p for p in ppl}

    for it in page_items:
        pid = it.get("person_id") or it.get("personnel_id")
        p = personnel_map.get(pid) if pid else None

        if not it.get("person_full_name") and p:
            it["person_full_name"] = p.get("full_name") or ""
        if not it.get("person_company") and p:
            it["person_company"] = p.get("company") or ""
        if not it.get("person_tc_number") and p:
            it["person_tc_number"] = p.get("tc_number") or ""

        if not it.get("created_at") and it.get("timestamp"):
            it["created_at"] = it["timestamp"]

        if not it.get("created_by_name") and it.get("checked_by_name"):
            it["created_by_name"] = it["checked_by_name"]

        it.pop("_ts", None)

    return {"data": page_items, "page": page, "pages": pages, "total": total}

# =========================
# DAY TOTALS (person_id -> total_sec)
# =========================
@router.get("/day-totals")
async def day_totals(
    day: str,
    current_user: dict = Depends(get_current_user),
):
    require_role(current_user, ["admin", "security"])

    start_local, end_local = _day_bounds(day)
    start_ts = start_local.timestamp()
    end_ts = end_local.timestamp()

    lookback_ts = start_ts - 24 * 3600
    day_prefix = day
    regex = {"$regex": f"^{day_prefix}"}

    q = {
        "$or": [
            {"created_at_ts": {"$gte": lookback_ts, "$lt": end_ts}},
            {"timestamp_ts": {"$gte": lookback_ts, "$lt": end_ts}},
            {"created_at": regex},
            {"timestamp": regex},
        ]
    }

    logs = [_clean(x) async for x in db["entry_logs"].find(q)]

    for x in logs:
        x["action"] = _action_of(x)
        x["_ts"] = _ts_of(x)
        if not x.get("person_id") and x.get("personnel_id"):
            x["person_id"] = x["personnel_id"]

    logs.sort(key=lambda z: z.get("_ts", 0))

    meta: Dict[str, Dict[str, str]] = {}
    for x in logs:
        pid = x.get("person_id")
        if not pid or pid in meta:
            continue
        meta[pid] = {
            "person_full_name": x.get("person_full_name") or "",
            "person_company": x.get("person_company") or "",
            "person_tc_number": x.get("person_tc_number") or "",
        }

    ids = [pid for pid, m in meta.items() if not (m.get("person_full_name") and m.get("person_company"))]
    if ids:
        ppl = await db["personnel"].find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))
        for p in ppl:
            pid = p.get("id")
            if not pid:
                continue
            m = meta.get(pid) or {}
            if not m.get("person_full_name"):
                m["person_full_name"] = p.get("full_name") or ""
            if not m.get("person_company"):
                m["person_company"] = p.get("company") or ""
            if not m.get("person_tc_number"):
                m["person_tc_number"] = p.get("tc_number") or ""
            meta[pid] = m

    open_in: Dict[str, float] = {}
    totals: Dict[str, int] = {}

    def add_overlap(pid: str, in_ts: float, out_ts: float):
        a = max(in_ts, start_ts)
        b = min(out_ts, end_ts)
        if b > a:
            totals[pid] = totals.get(pid, 0) + int(b - a)

    for log in logs:
        pid = log.get("person_id")
        if not pid:
            continue

        act = log.get("action")
        ts = log.get("_ts", 0)

        if act == "IN":
            open_in[pid] = ts
        elif act == "OUT":
            in_ts = open_in.pop(pid, None)
            if in_ts is not None:
                add_overlap(pid, in_ts, ts)

    for pid, in_ts in open_in.items():
        add_overlap(pid, in_ts, end_ts)

    items = []
    for pid, sec in totals.items():
        m = meta.get(pid, {})
        items.append({
            "person_id": pid,
            "total_sec": sec,
            "person_full_name": m.get("person_full_name", ""),
            "person_company": m.get("person_company", ""),
            "person_tc_number": m.get("person_tc_number", ""),
        })

    items.sort(key=lambda x: x["total_sec"], reverse=True)
    return {"items": items, "day": day}


# =========================
# MONTHLY EXCEL REPORT
# =========================
@router.get("/monthly-report-excel")
async def monthly_report_excel(
    year: int,
    month: int,
    current_user: dict = Depends(get_current_user),
):
    require_role(current_user, ["admin", "security"])

    # 1. Bounds (UTC timestamps for filtering)
    start_dt = datetime(year, month, 1, 0, 0, 0, tzinfo=TR_TZ)
    if month == 12:
        end_dt = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=TR_TZ)
    else:
        end_dt = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=TR_TZ)

    start_ts = start_dt.timestamp()
    end_ts = end_dt.timestamp()

    # 2. Query
    q = {
        "$or": [
            {"created_at_ts": {"$gte": start_ts, "$lt": end_ts}},
            {"timestamp_ts": {"$gte": start_ts, "$lt": end_ts}},
        ]
    }
    raw = [_clean(x) async for x in db["entry_logs"].find(q)]

    # 3. Process + Duration Calculation
    # Normalize fields
    for x in raw:
        x["action"] = _action_of(x)
        x["_ts"] = _ts_of(x)
        if not x.get("person_id") and x.get("personnel_id"):
            x["person_id"] = x["personnel_id"]

    raw.sort(key=lambda z: z.get("_ts", 0))

    # Aggregation structures
    meta: Dict[str, Dict[str, str]] = {}
    worked_days: Dict[str, set] = {}  # pid -> set of day_strings
    total_sec: Dict[str, int] = {}
    
    # Temporary structures for duration
    open_in: Dict[str, float] = {}

    def add_sec(pid, secs):
        total_sec[pid] = total_sec.get(pid, 0) + int(secs)

    for log in raw:
        pid = log.get("person_id")
        if not pid:
            continue
        
        # Meta info snapshot
        if pid not in meta:
            meta[pid] = {
                "full_name": log.get("person_full_name") or log.get("personnel_name") or "",
                "company": log.get("person_company") or "",
                # TC removed
                "gate": log.get("gate") or log.get("security_unit") or "MAIN_GATE"
            }

        ts = log.get("_ts", 0)
        dt_local = datetime.fromtimestamp(ts, TR_TZ)
        day_str = dt_local.strftime("%Y-%m-%d")

        # Track unique days
        if pid not in worked_days:
            worked_days[pid] = set()
        worked_days[pid].add(day_str)

        # Duration calc
        act = log.get("action")
        if act == "IN":
            open_in[pid] = ts
        elif act == "OUT":
            in_ts = open_in.pop(pid, None)
            if in_ts:
                diff = ts - in_ts
                if diff > 0:
                    add_sec(pid, diff)

    # Close lingering open sessions at month end boundary (optional choice)
    # We will NOT auto-close them here for report accuracy, only count completed ranges.
    # Or strict logic: if they are still inside at month end, we count up to month end?
    # For now, simplistic approach: ignore unclosed sessions for duration sum.
    
    # Fill missing meta from personnel collection if needed
    missing_ids = [pid for pid, m in meta.items() if not m.get("full_name")]
    if missing_ids:
        ppl = await db["personnel"].find({"id": {"$in": missing_ids}}, {"_id": 0}).to_list(len(missing_ids))
        for p in ppl:
            pid = p.get("id")
            if pid and pid in meta:
                if not meta[pid]["full_name"]: meta[pid]["full_name"] = p.get("full_name") or ""
                if not meta[pid]["company"]: meta[pid]["company"] = p.get("company") or ""
                # TC removed from fill logic too, though harmless if left unused


    # 4. Generate Excel
    wb = Workbook()
    ws = wb.active
    ws.title = f"Rapor {year}-{month:02d}"

    # Headers
    headers = ["Ad Soyad", "Firma", "Çalışılan Gün Sayısı", "Toplam Süre", "Giriş Yeri (Son)"]
    ws.append(headers)

    # Gate Labels Map
    GATE_LABELS = {
        "ADMIN_BUILDING": "İdari Bina",
        "PORT_FACILITY": "Liman Tesisi",
        "OFFDOCK1_SAYINLAR": "Offdock1 (Sayınlar)",
        "OFFDOCK2_KOMURLER": "Offdock2 (Kömürler)",
        "MAIN_GATE": "Ana Kapı"
    }

    # Rows
    # Sort IDs by name for nicer output
    all_pids = list(meta.keys())
    all_pids.sort(key=lambda pid: meta[pid]["full_name"] or "")

    for pid in all_pids:
        m = meta[pid]
        days_count = len(worked_days.get(pid, []))
        
        secs = total_sec.get(pid, 0)
        hours = int(secs // 3600)
        mins = int((secs % 3600) // 60)
        
        if hours > 0:
            time_str = f"{hours} saat {mins} dakika"
        else:
            time_str = f"{mins} dakika"

        raw_gate = m.get("gate", "MAIN_GATE")
        # Direct lookup or fallback to raw if not in map
        gate_label = GATE_LABELS.get(raw_gate, raw_gate) or "Ana Kapı"

        ws.append([
            m["full_name"],
            m["company"],
            days_count,
            time_str,
            gate_label
        ])

    # Column widths
    ws.column_dimensions["A"].width = 15
    ws.column_dimensions["B"].width = 30
    ws.column_dimensions["C"].width = 25
    ws.column_dimensions["D"].width = 20
    ws.column_dimensions["E"].width = 15
    ws.column_dimensions["F"].width = 15
    ws.column_dimensions["G"].width = 25

    out = BytesIO()
    wb.save(out)
    out.seek(0)

    fname = f"Aylik_Rapor_{year}_{month:02d}.xlsx"
    return StreamingResponse(
        out, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )

entry_logs_router = router

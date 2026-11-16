import re
from uuid import uuid4
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Optional

from .db import db

def prepare_turkish_search(q: str):
    """
    Türkçe karakterler için özel regex pattern oluşturur.
    i/İ, ı/I, ğ/Ğ, ü/Ü, ş/Ş, ö/Ö, ç/Ç gibi harfleri kapsar.
    """
    if not q:
        return None
    
    replacements = {
        "i": "[iİ]", "İ": "[iİ]",
        "ı": "[ıI]", "I": "[ıI]",
        "g": "[gG]", "G": "[gG]",
        "ğ": "[ğĞ]", "Ğ": "[ğĞ]",
        "ü": "[üÜ]", "Ü": "[üÜ]",
        "ş": "[şŞ]", "Ş": "[şŞ]",
        "ö": "[öÖ]", "Ö": "[öÖ]",
        "ç": "[çÇ]", "Ç": "[çÇ]",
        "c": "[cC]", "C": "[cC]",
        "o": "[oO]", "O": "[oO]",
        "u": "[uU]", "U": "[uU]",
        "s": "[sS]", "S": "[sS]",
    }
    
    pattern = ""
    for char in q:
        replacement = replacements.get(char)
        if replacement:
            pattern += replacement
        elif char.isalpha():
            pattern += f"[{char.lower()}{char.upper()}]"
        else:
            pattern += re.escape(char)
            
    return pattern

def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def parse_dt_safe(value) -> Optional[datetime]:
    """
    Güvenli datetime parse:
    - None, boş, '-', 'nan' gibi değerleri None döndürür
    - tz yoksa UTC kabul eder
    """
    if not value:
        return None
    try:
        if isinstance(value, datetime):
            dt = value
        else:
            s = str(value).strip()
            if s in ["-", "nan", "", "None", "null"]:
                return None
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


# Türkiye'de yaz/kış saati uygulaması yok (2016'dan beri sabit UTC+3)
TR_TZ = timezone(timedelta(hours=3))
_DATE_ONLY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _as_calendar_day(value) -> Optional[date]:
    """
    Değer sadece bir GÜN ifade ediyorsa (ör. '2026-11-20', Excel'den gelen
    '2026-11-20 00:00:00' ya da gece yarısı UTC '2026-11-20T00:00:00Z') o günü döndürür.
    Saat bilgisi taşıyan gerçek bir an ise None döndürür.
    """
    if isinstance(value, datetime):
        dt = value
    else:
        s = str(value or "").strip()
        if _DATE_ONLY_RE.match(s):
            try:
                return date.fromisoformat(s)
            except ValueError:
                return None
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None

    if dt.time() != dt_time(0, 0):
        return None
    if dt.tzinfo is not None and dt.utcoffset() != timedelta(0):
        return None
    return dt.date()


def parse_end_dt(value) -> Optional[datetime]:
    """
    Bitiş tarihleri (evrak son geçerlilik, görevlendirme bitiş) için:
    sadece gün verilmişse o günün SONUNA kadar (Türkiye saatiyle 23:59:59) geçerli sayılır.
    """
    if not value:
        return None
    day = _as_calendar_day(value)
    if day is not None:
        return datetime.combine(day, dt_time.max, tzinfo=TR_TZ)
    return parse_dt_safe(value)


def parse_start_dt(value) -> Optional[datetime]:
    """Başlangıç tarihleri için: sadece gün verilmişse o gün Türkiye saatiyle 00:00'dan itibaren."""
    if not value:
        return None
    day = _as_calendar_day(value)
    if day is not None:
        return datetime.combine(day, dt_time.min, tzinfo=TR_TZ)
    return parse_dt_safe(value)


def latest_expiry_by_type(documents: list) -> dict:
    """
    Aynı kişide aynı evrak türünden birden fazla kayıt olabilir (eski + yenilenmiş).
    Her (personnel_id, document_type_id) için EN GEÇ bitiş tarihini döndürür.
    Tarihi okunamayan kayıt None sayılır (geçerli bir kayıt varsa onu ezmez).
    """
    latest: dict = {}
    for d in documents:
        key = (d.get("personnel_id"), d.get("document_type_id"))
        exp = parse_end_dt(d.get("expiry_date"))
        if key not in latest:
            latest[key] = exp
        elif exp is not None and (latest[key] is None or exp > latest[key]):
            latest[key] = exp
    return latest


def is_manually_blocked(p: dict) -> bool:
    return p.get("entry_blocked") is True or p.get("is_blocked") is True or p.get("blocked") is True


async def compute_can_enter_map(personnel_list: list) -> dict:
    """
    Kişi girebilir mi?
    - yönetici engeli varsa => giremez
    - görevlendirme başlamamış / bitmişse => giremez
    - her zorunlu evrak türü için EN GÜNCEL kaydın süresi dolmuşsa ya da hiç kayıt yoksa => giremez
    - aksi halde => girebilir
    """
    now = datetime.now(timezone.utc)

    doc_types = await db.document_types.find(
        {},
        {"_id": 0, "id": 1, "is_mandatory": 1}
    ).to_list(1000)
    mandatory_type_ids = {dt["id"] for dt in doc_types if dt.get("is_mandatory")}

    ids = [p.get("id") for p in personnel_list if p.get("id")]
    if not ids:
        return {}

    latest: dict = {}
    if mandatory_type_ids:
        mandatory_list = list(mandatory_type_ids)
        MAX_BATCH_SIZE = 500
        for i in range(0, len(ids), MAX_BATCH_SIZE):
            batch_ids = ids[i:i + MAX_BATCH_SIZE]
            docs = await db.personnel_documents.find(
                {
                    "personnel_id": {"$in": batch_ids},
                    "document_type_id": {"$in": mandatory_list},
                },
                {"_id": 0, "personnel_id": 1, "document_type_id": 1, "expiry_date": 1},
            ).to_list(None)  # sınır yok: mükerrer kayıtlar yüzünden kişi atlanmasın
            latest.update(latest_expiry_by_type(docs))

    result = {}
    for p in personnel_list:
        pid = p.get("id")
        if not pid:
            continue

        if is_manually_blocked(p):
            result[pid] = False
            continue

        assignment_start = parse_start_dt(p.get("assignment_start"))
        if assignment_start and assignment_start > now:
            result[pid] = False
            continue

        assignment_end = parse_end_dt(p.get("assignment_end"))
        if assignment_end and assignment_end < now:
            result[pid] = False
            continue

        ok = True
        for type_id in mandatory_type_ids:
            key = (pid, type_id)
            if key not in latest:          # zorunlu evrak hiç yok
                ok = False
                break
            exp = latest[key]
            if exp is None or exp < now:   # en güncel kayıt bile geçersiz/süresi dolmuş
                ok = False
                break
        result[pid] = ok

    return result

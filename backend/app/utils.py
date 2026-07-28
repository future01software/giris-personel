import re
from uuid import uuid4
from datetime import datetime, timezone
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
            dt = datetime.fromisoformat(s)

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


async def compute_can_enter_map(personnel_list: list) -> dict:
    """
    Mevcut mantığı BOZMADAN optimize:
    - assignment_end geçmişse => cannot
    - zorunlu evraklardan herhangi biri expired/parse error => cannot
    - aksi halde => can
    Not: zorunlu evrak hiç yoksa 'can' sayar (has_expired False kalır).
    """
    now = datetime.now(timezone.utc)

    # 1) zorunlu doc type id'leri
    doc_types = await db.document_types.find(
        {},
        {"_id": 0, "id": 1, "is_mandatory": 1}
    ).to_list(1000)
    mandatory_type_ids = {dt["id"] for dt in doc_types if dt.get("is_mandatory")}

    # Eğer zorunlu evrak tanımı hiç yoksa herkes "can" (assignment hariç)
    # (mevcut davranışa en yakın)
    ids = [p.get("id") for p in personnel_list if p.get("id")]
    if not ids:
        return {}

    # 2) Sadece EXPIRED zorunlu evrakları çek (tam liste yerine)
    # Bu şekilde 100K yerine sadece expired olanlar gelir = çok az bellek
    expired_personnel_ids = set()
    present_mandatory_types = {}

    if mandatory_type_ids:
        now_iso = now.isoformat()
        mandatory_list = list(mandatory_type_ids)

        MAX_BATCH_SIZE = 500
        for i in range(0, len(ids), MAX_BATCH_SIZE):
            batch_ids = ids[i:i + MAX_BATCH_SIZE]
            expired_docs = await db.personnel_documents.find(
                {
                    "personnel_id": {"$in": batch_ids},
                    "document_type_id": {"$in": mandatory_list},
                    "expiry_date": {"$lt": now_iso},
                },
                {"_id": 0, "personnel_id": 1},
            ).to_list(len(batch_ids))

            for d in expired_docs:
                expired_personnel_ids.add(d["personnel_id"])

            mandatory_docs = await db.personnel_documents.find(
                {
                    "personnel_id": {"$in": batch_ids},
                    "document_type_id": {"$in": mandatory_list},
                },
                {"_id": 0, "personnel_id": 1, "document_type_id": 1},
            ).to_list(len(batch_ids) * max(1, len(mandatory_list)))
            for d in mandatory_docs:
                present_mandatory_types.setdefault(d["personnel_id"], set()).add(d["document_type_id"])

    # 3) Sonuç
    result = {}
    for p in personnel_list:
        pid = p.get("id")
        if not pid:
            continue

        if p.get("entry_blocked") is True or p.get("is_blocked") is True or p.get("blocked") is True:
            result[pid] = False
            continue

        # assignment kontrol
        assignment_start = parse_dt_safe(p.get("assignment_start"))
        if assignment_start and assignment_start > now:
            result[pid] = False
            continue

        assignment_end = parse_dt_safe(p.get("assignment_end"))
        if assignment_end and assignment_end < now:
            result[pid] = False
            continue

        if mandatory_type_ids and not mandatory_type_ids.issubset(present_mandatory_types.get(pid, set())):
            result[pid] = False
            continue

        # zorunlu evrak expiry kontrol (önceden toplu çekildi)
        result[pid] = pid not in expired_personnel_ids

    return result

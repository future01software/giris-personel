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
            import re
            pattern += re.escape(char)
            
    return pattern

def new_id(prefix: str) -> str:
    return f"{prefix}_{int(datetime.now(timezone.utc).timestamp() * 1000)}"


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

    # 2) Zorunlu evrakları sadece bu kişiler için çek (batch)
    # 1000 kişi için çok hızlı olur, ama büyürse de patlamasın diye batch var.
    docs_by_personnel = {}

    if mandatory_type_ids:
        MAX_BATCH_SIZE = 500
        mandatory_list = list(mandatory_type_ids)

        for i in range(0, len(ids), MAX_BATCH_SIZE):
            batch_ids = ids[i:i + MAX_BATCH_SIZE]
            docs = await db.personnel_documents.find(
                {
                    "personnel_id": {"$in": batch_ids},
                    "document_type_id": {"$in": mandatory_list},
                },
                {"_id": 0, "personnel_id": 1, "expiry_date": 1, "document_type_id": 1},
            ).to_list(100000)

            for d in docs:
                docs_by_personnel.setdefault(d["personnel_id"], []).append(d)

    # 3) Sonuç
    result = {}
    for p in personnel_list:
        pid = p.get("id")
        if not pid:
            continue

        # assignment kontrol
        assignment_end = parse_dt_safe(p.get("assignment_end"))
        if assignment_end and assignment_end < now:
            result[pid] = False
            continue

        # zorunlu evrak expiry kontrol
        has_expired = False
        for d in docs_by_personnel.get(pid, []):
            expiry = parse_dt_safe(d.get("expiry_date"))
            if not expiry:
                has_expired = True
                break
            if expiry < now:
                has_expired = True
                break

        result[pid] = (not has_expired)

    return result

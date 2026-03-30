from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException

from app.db import db
from app.deps import get_current_user, require_role
from app.services.mailer import send_email

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/expiring-documents")
async def get_expiring_documents(days: int = 30, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin", "supervisor"])

    now = datetime.now(timezone.utc)
    threshold_date = (now + timedelta(days=days)).isoformat()

    doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
    doc_types_map = {dt["id"]: dt for dt in doc_types}

    # Sadece threshold içindeki dokümanları çek (10000 yerine)
    all_documents = await db.personnel_documents.find(
        {"expiry_date": {"$lte": threshold_date}},
        {"_id": 0}
    ).to_list(5000)

    # threshold içindekiler (expired dahil) — eski davranış korunur
    expiring_personnel = {}

    # tüm evraklar üzerinden expired sayısı
    expired_count_by_person = {}

    # threshold içinde expired olmayan (yaklaşan) sayısı
    expiring_count_by_person = {}

    for doc in all_documents:
        doc_type = doc_types_map.get(doc.get("document_type_id"))
        if not doc_type:
            continue

        expiry_str = doc.get("expiry_date")
        if not expiry_str:
            continue

        personnel_id = doc.get("personnel_id")
        if not personnel_id:
            continue

        try:
            expiry = datetime.fromisoformat(expiry_str) if isinstance(expiry_str, str) else expiry_str
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)

            days_until = (expiry - now).days

            # ✅ expired sayacı (tüm evraklar)
            if days_until < 0:
                expired_count_by_person[personnel_id] = expired_count_by_person.get(personnel_id, 0) + 1

            # ✅ threshold içindeyse (days param)
            if days_until <= days:
                expiring_personnel.setdefault(personnel_id, []).append({
                    "document_type": doc_type.get("name_tr"),
                    "document_type_en": doc_type.get("name_en"),
                    "expiry_date": expiry_str,
                    "days_until_expiry": days_until,
                    "is_expired": days_until < 0,
                    "is_mandatory": doc_type.get("is_mandatory")
                })

                # ✅ threshold içinde ama expired değilse yaklaşan say
                if days_until >= 0:
                    expiring_count_by_person[personnel_id] = expiring_count_by_person.get(personnel_id, 0) + 1

        except Exception:
            continue

    personnel_ids = list(expiring_personnel.keys())
    if not personnel_ids:
        return {"alerts": [], "total": 0, "threshold_days": days}

    all_personnel = await db.personnel.find(
        {"id": {"$in": personnel_ids}},
        {"_id": 0}
    ).to_list(len(personnel_ids))

    personnel_map = {p["id"]: p for p in all_personnel}

    alerts = []
    for p_id, docs in expiring_personnel.items():
        personnel = personnel_map.get(p_id)
        if not personnel:
            continue

        docs.sort(key=lambda x: x["days_until_expiry"])

        expired_count = expired_count_by_person.get(p_id, 0)
        expiring_count = expiring_count_by_person.get(p_id, 0)

        alerts.append({
            "personnel_id": p_id,
            "full_name": personnel.get("full_name"),
            "company": personnel.get("company"),
            "phone": personnel.get("phone"),
            "expiring_documents": docs,
            "most_urgent_days": docs[0]["days_until_expiry"],

            # ✅ Dashboard filtresi için yeni alanlar
            "expired_count": expired_count,
            "has_any_expired": expired_count > 0,
            "expiring_count": expiring_count,
        })

    alerts.sort(key=lambda x: x["most_urgent_days"])
    return {"alerts": alerts, "total": len(alerts), "threshold_days": days}


# ✅ CANLI DOSYA KONTROL (AUTH YOK) — 404 görürsen deploy etmiyor demektir
@router.get("/ping-mail")
async def ping_mail():
    return {"ok": True, "msg": "alerts router updated (backend/app/router/alerts.py)"}


# ✅ SADECE BACKEND TEST – SİTEYİ ETKİLEMEZ
@router.post("/test-mail")
async def test_mail(current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin", "supervisor"])

    try:
        send_email(
            subject="✅ Clear2Work Mail Test",
            html="<h3>Test başarılı</h3><p>Bu mail canlı backend üzerinden gönderildi.</p>"
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

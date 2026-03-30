from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
import pandas as pd
import io
from datetime import datetime, timezone, timedelta

from app.models import PersonnelCreate, BulkDeleteRequest
from app.db import db, DEMO_MODE
from app.deps import get_current_user, require_role
from app.utils import new_id, compute_can_enter_map, prepare_turkish_search

router = APIRouter(prefix="/personnel", tags=["personnel"])


@router.post("")
async def create_personnel(data: PersonnelCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    personnel_doc = {
        "id": new_id("personnel"),
        "full_name": data.full_name,
        "tc_number": data.tc_number,
        "company": data.company,
        "phone": data.phone,
        "license_plate": data.license_plate,
        "photo_url": data.photo_url,
        "assignment_start": data.assignment_start,
        "assignment_end": data.assignment_end,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.personnel.insert_one(personnel_doc)
    return {"message": "Personnel created", "id": personnel_doc["id"]}


@router.get("")
async def get_personnel(
    page: int = 1,
    limit: int = 50,
    search: str = None,
    status: str = None,   # "can" | "cannot" | "all"
    company: str = None,  # ✅ EKLENDI
    current_user: dict = Depends(get_current_user),
):
    if DEMO_MODE:
        mock_data = [
            {
                "id": f"demo_p_{i}",
                "full_name": name,
                "tc_number": f"123456789{i:02d}",
                "company": "Demolife İnşaat",
                "phone": "+90 555 111 22 33",
                "can_enter": True if i % 4 != 0 else False,
                "assignment_end": (datetime.now() + timedelta(days=30)).isoformat()
            }
            for i, name in enumerate(["Ahmet Yılmaz", "Mehmet Demir", "Ayşe Kaya", "Fatma Çelik", "Can Özkan"])
        ]
        return {
            "data": mock_data,
            "total": len(mock_data),
            "page": 1,
            "limit": 50,
            "pages": 1
        }

    status = (status or "").strip().lower()
    if status not in ["", "all", "can", "cannot"]:
        status = ""

    query = {}

    # ✅ Company filtresi (backend pagination doğru çalışsın diye)
    if company:
        company = company.strip()
        if company:
            query["company"] = company

    if search:
        # Search varsa, özel regex fonksiyonunu kullan (fonksiyon yukarıda tanımlandı kabul ediyoruz, 
        # aslında aynı dosyada ama search_personnel içinde tanımlamıştık, dışarı almamız lazım.
        # Düzeltme: helper'ı yukarıda global tanımladım, burada sadece çağırıyorum.
        regex_pattern = prepare_turkish_search(search)
        query["$or"] = [
            {"full_name": {"$regex": regex_pattern, "$options": "i"}},
            {"tc_number": {"$regex": regex_pattern, "$options": "i"}},
            {"company": {"$regex": regex_pattern, "$options": "i"}},
        ]

    if status in ["", "all"]:
        skip = (page - 1) * limit
        total = await db.personnel.count_documents(query)
        
        # Projection to limit fields returned
        projection = {
            "_id": 0,
            "id": 1,
            "full_name": 1,
            "tc_number": 1,
            "company": 1,
            "phone": 1,
            "license_plate": 1,
            "photo_url": 1,
            "assignment_start": 1,
            "assignment_end": 1,
            "created_at": 1
        }
        
        personnel_list = await db.personnel.find(query, projection).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

        can_map = await compute_can_enter_map(personnel_list)
        for p in personnel_list:
            pid = p.get("id")
            p["can_enter"] = bool(can_map.get(pid, True))

        return {
            "data": personnel_list,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }

    # status=can/cannot
    all_candidates = await db.personnel.find(query, {"_id": 0, "id": 1, "assignment_end": 1}).sort("created_at", -1).to_list(200000)
    can_map = await compute_can_enter_map(all_candidates)

    want = True if status == "can" else False
    filtered_ids = [p["id"] for p in all_candidates if can_map.get(p["id"], True) == want]

    total = len(filtered_ids)
    pages = (total + limit - 1) // limit if total > 0 else 1

    start = (page - 1) * limit
    end = start + limit
    page_ids = filtered_ids[start:end]

    if not page_ids:
        return {"data": [], "total": total, "page": page, "limit": limit, "pages": pages}

    personnel_list = await db.personnel.find({"id": {"$in": page_ids}}, {"_id": 0}).to_list(limit)

    order = {pid: i for i, pid in enumerate(page_ids)}
    personnel_list.sort(key=lambda x: order.get(x.get("id"), 10**9))

    for p in personnel_list:
        pid = p.get("id")
        p["can_enter"] = bool(can_map.get(pid, True))

    return {"data": personnel_list, "total": total, "page": page, "limit": limit, "pages": pages}


@router.get("/search")
async def search_personnel(
    q: str = None, 
    name: str = None, 
    surname: str = None, 
    tc: str = None, 
    current_user: dict = Depends(get_current_user)
):
    if DEMO_MODE:
        demo_personnel = [
            {"id": "demo_p_0", "full_name": "Ahmet Yılmaz", "tc_number": "12345678900", "company": "Demolife İnşaat", "phone": "+90 555 111 22 33", "overall_status": "green", "assignment_end": (datetime.now() + timedelta(days=60)).isoformat()},
            {"id": "demo_p_1", "full_name": "Mehmet Demir", "tc_number": "12345678901", "company": "Demolife İnşaat", "phone": "+90 555 222 33 44", "overall_status": "green", "assignment_end": (datetime.now() + timedelta(days=45)).isoformat()},
            {"id": "demo_p_2", "full_name": "Ayşe Kaya", "tc_number": "12345678902", "company": "Yıldız Liman", "phone": "+90 555 333 44 55", "overall_status": "yellow", "assignment_end": (datetime.now() + timedelta(days=10)).isoformat()},
            {"id": "demo_p_3", "full_name": "Fatma Çelik", "tc_number": "12345678903", "company": "Yıldız Liman", "phone": "+90 555 444 55 66", "overall_status": "red", "assignment_end": (datetime.now() - timedelta(days=5)).isoformat()},
            {"id": "demo_p_4", "full_name": "Can Özkan", "tc_number": "12345678904", "company": "Atlas Tersane", "phone": "+90 555 555 66 77", "overall_status": "green", "assignment_end": (datetime.now() + timedelta(days=90)).isoformat()},
        ]
        search_term = (q or name or surname or tc or "").lower()
        if search_term:
            return [p for p in demo_personnel if search_term in p["full_name"].lower() or search_term in p["tc_number"] or search_term in p["company"].lower()]
        return demo_personnel

    clauses = []

    # 1) Eski genel arama (q)
    if q:
        regex_q = prepare_turkish_search(q)
        clauses.append({
            "$or": [
                {"full_name": {"$regex": regex_q, "$options": "i"}},
                {"tc_number": {"$regex": regex_q, "$options": "i"}},
                {"company": {"$regex": regex_q, "$options": "i"}},
                {"license_plate": {"$regex": regex_q, "$options": "i"}},
            ]
        })

    # 2) Gelişmiş arama alanları (name, surname, tc)
    if name:
        regex_name = prepare_turkish_search(name)
        clauses.append({"full_name": {"$regex": regex_name, "$options": "i"}})
    
    if surname:
        regex_surname = prepare_turkish_search(surname)
        clauses.append({"full_name": {"$regex": regex_surname, "$options": "i"}})

    if tc:
        regex_tc = prepare_turkish_search(tc)
        clauses.append({"tc_number": {"$regex": regex_tc, "$options": "i"}})

    if not clauses:
        return []

    query = {"$and": clauses} if len(clauses) > 1 else clauses[0]
    
    results = await db.personnel.find(query, {"_id": 0}).to_list(100)
    return results


@router.get("/companies")
async def get_personnel_companies(current_user: dict = Depends(get_current_user)):
    companies = await db.personnel.distinct("company")
    companies = [str(c).strip() for c in companies if c and str(c).strip()]
    companies.sort()
    return {"companies": companies}


@router.get("/{personnel_id}")
async def get_personnel_detail(personnel_id: str, current_user: dict = Depends(get_current_user)):
    if DEMO_MODE:
        demo_map = {
            "demo_p_0": {"id": "demo_p_0", "full_name": "Ahmet Yılmaz", "tc_number": "12345678900", "company": "Demolife İnşaat", "phone": "+90 555 111 22 33", "assignment_end": (datetime.now() + timedelta(days=60)).isoformat()},
            "demo_p_1": {"id": "demo_p_1", "full_name": "Mehmet Demir", "tc_number": "12345678901", "company": "Demolife İnşaat", "phone": "+90 555 222 33 44", "assignment_end": (datetime.now() + timedelta(days=45)).isoformat()},
            "demo_p_2": {"id": "demo_p_2", "full_name": "Ayşe Kaya", "tc_number": "12345678902", "company": "Yıldız Liman", "phone": "+90 555 333 44 55", "assignment_end": (datetime.now() + timedelta(days=10)).isoformat()},
            "demo_p_3": {"id": "demo_p_3", "full_name": "Fatma Çelik", "tc_number": "12345678903", "company": "Yıldız Liman", "phone": "+90 555 444 55 66", "assignment_end": (datetime.now() - timedelta(days=5)).isoformat()},
            "demo_p_4": {"id": "demo_p_4", "full_name": "Can Özkan", "tc_number": "12345678904", "company": "Atlas Tersane", "phone": "+90 555 555 66 77", "assignment_end": (datetime.now() + timedelta(days=90)).isoformat()},
        }
        personnel = demo_map.get(personnel_id)
        if not personnel:
            raise HTTPException(status_code=404, detail="Personnel not found")

        now = datetime.now(timezone.utc)
        assignment_expired = False
        if personnel.get("assignment_end"):
            ae = datetime.fromisoformat(personnel["assignment_end"])
            if ae.tzinfo is None:
                ae = ae.replace(tzinfo=timezone.utc)
            if ae < now:
                assignment_expired = True

        demo_docs = [
            {
                "id": f"doc_{personnel_id}_1",
                "personnel_id": personnel_id,
                "document_type_id": "dt_1",
                "expiry_date": (now + timedelta(days=120)).isoformat(),
                "notes": "Demo belge",
                "document_type": {"id": "dt_1", "name_tr": "İş Güvenliği Eğitimi", "name_en": "Safety Training", "is_mandatory": True, "warning_days": 30},
                "status": "valid",
                "days_until_expiry": 120
            },
            {
                "id": f"doc_{personnel_id}_2",
                "personnel_id": personnel_id,
                "document_type_id": "dt_2",
                "expiry_date": (now + timedelta(days=200)).isoformat(),
                "notes": "Demo belge",
                "document_type": {"id": "dt_2", "name_tr": "Sağlık Raporu", "name_en": "Health Report", "is_mandatory": True, "warning_days": 30},
                "status": "valid",
                "days_until_expiry": 200
            },
        ]

        overall_status = "red" if assignment_expired else "green"
        status_reason = "assignment_expired" if assignment_expired else "all_valid"

        return {
            "personnel": personnel,
            "documents": demo_docs,
            "overall_status": overall_status,
            "status_reason": status_reason,
            "assignment_expired": assignment_expired
        }

    personnel = await db.personnel.find_one({"id": personnel_id}, {"_id": 0})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")

    documents = await db.personnel_documents.find({"personnel_id": personnel_id}, {"_id": 0}).to_list(100)

    doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
    doc_types_map = {dt["id"]: dt for dt in doc_types}

    now = datetime.now(timezone.utc)
    enriched_docs = []
    for doc in documents:
        doc_type = doc_types_map.get(doc["document_type_id"])
        if doc_type:
            expiry = datetime.fromisoformat(doc["expiry_date"]) if isinstance(doc["expiry_date"], str) else doc["expiry_date"]
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            days_until_expiry = (expiry - now).days

            if days_until_expiry < 0:
                status_ = "expired"
            elif days_until_expiry <= doc_type["warning_days"]:
                status_ = "warning"
            else:
                status_ = "valid"

            enriched_docs.append({
                **doc,
                "document_type": doc_type,
                "status": status_,
                "days_until_expiry": days_until_expiry
            })

    assignment_expired = False
    if personnel.get("assignment_end"):
        assignment_end = datetime.fromisoformat(personnel["assignment_end"]) if isinstance(personnel["assignment_end"], str) else personnel["assignment_end"]
        if assignment_end.tzinfo is None:
            assignment_end = assignment_end.replace(tzinfo=timezone.utc)
        if assignment_end < now:
            assignment_expired = True

    if assignment_expired:
        overall_status = "red"
        status_reason = "assignment_expired"
    else:
        mandatory_docs = [d for d in enriched_docs if d["document_type"]["is_mandatory"]]
        has_expired = any(d["status"] == "expired" for d in mandatory_docs)
        has_warning = any(d["status"] == "warning" for d in mandatory_docs)

        if has_expired:
            overall_status = "red"
            status_reason = "expired_documents"
        elif has_warning:
            overall_status = "yellow"
            status_reason = "warning_documents"
        else:
            overall_status = "green"
            status_reason = "all_valid"

    return {
        "personnel": personnel,
        "documents": enriched_docs,
        "overall_status": overall_status,
        "status_reason": status_reason,
        "assignment_expired": assignment_expired
    }


@router.put("/{personnel_id}")
async def update_personnel(personnel_id: str, data: PersonnelCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    update_data = data.dict(exclude_none=True)
    result = await db.personnel.update_one({"id": personnel_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return {"message": "Personnel updated"}


@router.delete("/{personnel_id}")
async def delete_personnel(personnel_id: str, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    result = await db.personnel.delete_one({"id": personnel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")

    await db.personnel_documents.delete_many({"personnel_id": personnel_id})
    return {"message": "Personnel deleted"}


@router.post("/bulk-import")
async def bulk_import_personnel(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="File must be Excel or CSV format")

    try:
        contents = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents), sep=None, engine="python")
        else:
            df = pd.read_excel(io.BytesIO(contents))

        df = df.dropna(how="all")

        doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
        doc_type_map_tr = {dt["name_tr"]: dt["id"] for dt in doc_types}
        doc_type_map_en = {dt["name_en"]: dt["id"] for dt in doc_types}

        required_columns = ["Ad Soyad", "Şirket"]
        for col in required_columns:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing required column: {col}")

        imported_count = 0
        skipped_count = 0
        errors = []

        def convert_date(date_str):
            if not date_str or date_str == "nan":
                return None
            if "00.01.1900" in date_str or "01.01.1900" in date_str:
                return None
            try:
                if "." in date_str:
                    parts = date_str.split(".")
                    if len(parts) == 3:
                        day, month, year = parts
                        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                return date_str
            except Exception:
                return None

        personnel_batch = []
        document_batch = []
        BATCH_SIZE = 100

        for index, row in df.iterrows():
            try:
                full_name = str(row.get("Ad Soyad", "")).strip()
                company = str(row.get("Şirket", "")).strip()

                if not full_name or not company or full_name == "nan" or company == "nan":
                    skipped_count += 1
                    continue

                assignment_start = str(row.get("Görev Başlangıç", "")).strip() if pd.notna(row.get("Görev Başlangıç")) else None
                assignment_end = str(row.get("Görev Bitiş", "")).strip() if pd.notna(row.get("Görev Bitiş")) else None
                assignment_start = convert_date(assignment_start) if assignment_start else None
                assignment_end = convert_date(assignment_end) if assignment_end else None

                tc_number = str(row.get("TC Kimlik No", "")).strip()
                if not tc_number:
                    tc_number = f"AUTO_{int(datetime.now(timezone.utc).timestamp() * 1000)}_{index}"

                personnel_id = f"{new_id('personnel')}_{index}"
                personnel_doc = {
                    "id": personnel_id,
                    "full_name": full_name,
                    "tc_number": tc_number,
                    "company": company,
                    "phone": str(row.get("Telefon", "")).strip() if pd.notna(row.get("Telefon")) else None,
                    "license_plate": str(row.get("Plaka", "")).strip() if pd.notna(row.get("Plaka")) else None,
                    "photo_url": str(row.get("Fotoğraf URL", "")).strip() if pd.notna(row.get("Fotoğraf URL")) else None,
                    "assignment_start": assignment_start,
                    "assignment_end": assignment_end,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }

                existing = await db.personnel.find_one({"full_name": full_name, "company": company})
                if existing:
                    errors.append(f"Row {index + 2}: {full_name} already exists")
                    skipped_count += 1
                    continue

                personnel_batch.append(personnel_doc)

                for col in df.columns:
                    if col not in required_columns and col not in ["Ad Soyad", "TC Kimlik No", "Telefon", "Plaka", "Fotoğraf URL", "Görev Başlangıç", "Görev Bitiş"]:
                        doc_type_id = doc_type_map_tr.get(col) or doc_type_map_en.get(col)
                        if doc_type_id and pd.notna(row.get(col)):
                            expiry_date_raw = str(row[col]).strip()
                            if expiry_date_raw and expiry_date_raw != "" and expiry_date_raw.lower() != "nan":
                                expiry_date = convert_date(expiry_date_raw)
                                if expiry_date:
                                    document_batch.append({
                                        "id": f"{new_id('doc')}_{index}_{col}",
                                        "personnel_id": personnel_id,
                                        "document_type_id": doc_type_id,
                                        "expiry_date": expiry_date,
                                        "notes": "Imported from Excel",
                                        "created_at": datetime.now(timezone.utc).isoformat()
                                    })

                imported_count += 1

                # Batch insert (her 100 kayıtta bir yaz)
                if len(personnel_batch) >= BATCH_SIZE:
                    await db.personnel.insert_many(personnel_batch)
                    personnel_batch = []
                if len(document_batch) >= BATCH_SIZE:
                    await db.personnel_documents.insert_many(document_batch)
                    document_batch = []

            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
                continue

        # Kalan batch'leri yaz
        if personnel_batch:
            await db.personnel.insert_many(personnel_batch)
        if document_batch:
            await db.personnel_documents.insert_many(document_batch)

        return {"message": "Import completed", "imported": imported_count, "skipped": skipped_count, "errors": errors}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/bulk-delete")
async def bulk_delete_personnel(payload: BulkDeleteRequest, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    if not payload.ids:
        return {"deleted_count": 0}

    personnel_result = await db.personnel.delete_many({"id": {"$in": payload.ids}})
    await db.personnel_documents.delete_many({"personnel_id": {"$in": payload.ids}})
    return {"deleted_count": personnel_result.deleted_count}

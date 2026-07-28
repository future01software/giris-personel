from fastapi import APIRouter, HTTPException, Depends

from app.models import DocumentTypeCreate, PersonnelDocumentCreate
from app.db import db
from app.deps import get_current_user, require_role
from app.utils import new_id
from datetime import datetime, timezone

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/types")
async def create_document_type(data: DocumentTypeCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    doc_type = {
        "id": new_id("doctype"),
        "name_tr": data.name_tr,
        "name_en": data.name_en,
        "is_mandatory": data.is_mandatory,
        "warning_days": data.warning_days,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.document_types.insert_one(doc_type)
    return {"message": "Document type created", "id": doc_type["id"]}


@router.get("/types")
async def get_document_types(current_user: dict = Depends(get_current_user)):
    doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
    return doc_types


@router.delete("/types/{type_id}")
async def delete_document_type(type_id: str, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    result = await db.document_types.delete_one({"id": type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document type not found")
    return {"message": "Document type deleted"}


@router.post("")
async def create_personnel_document(data: PersonnelDocumentCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    doc = {
        "id": new_id("doc"),
        "personnel_id": data.personnel_id,
        "document_type_id": data.document_type_id,
        "expiry_date": data.expiry_date,
        "notes": data.notes,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.personnel_documents.insert_one(doc)
    return {"message": "Document created", "id": doc["id"]}


@router.get("/{personnel_id}")
async def get_personnel_documents(personnel_id: str, current_user: dict = Depends(get_current_user)):
    documents = await db.personnel_documents.find({"personnel_id": personnel_id}, {"_id": 0}).to_list(100)
    return documents


@router.put("/{doc_id}")
async def update_document(doc_id: str, data: PersonnelDocumentCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    update_data = {"expiry_date": data.expiry_date, "notes": data.notes}
    result = await db.personnel_documents.update_one({
        "id": doc_id,
        "personnel_id": data.personnel_id,
        "document_type_id": data.document_type_id,
    }, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document updated"}


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    personnel_id: str | None = None,
    document_type_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    await require_role(current_user, ["admin"])

    query = {"id": doc_id}
    if personnel_id:
        query["personnel_id"] = personnel_id
    if document_type_id:
        query["document_type_id"] = document_type_id
    result = await db.personnel_documents.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}

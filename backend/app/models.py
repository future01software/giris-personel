from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime



class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: Optional[str] = None
    email: str
    full_name: str
    role: str  # admin, security, supervisor
    created_at: datetime


class UserCreate(BaseModel):
    username: Optional[str] = None
    email: EmailStr
    password: str
    full_name: str
    role: str = "security"


class UserLogin(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str
    new_password: str


class Personnel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    full_name: str
    tc_number: Optional[str] = None
    company: str
    phone: Optional[str] = None
    license_plate: Optional[str] = None
    photo_url: Optional[str] = None
    assignment_start: Optional[datetime] = None
    assignment_end: Optional[datetime] = None
    created_at: datetime


class PersonnelCreate(BaseModel):
    full_name: str
    tc_number: Optional[str] = None
    company: str
    phone: Optional[str] = None
    license_plate: Optional[str] = None
    photo_url: Optional[str] = None
    assignment_start: Optional[str] = None
    assignment_end: Optional[str] = None


class DocumentType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name_tr: str
    name_en: str
    is_mandatory: bool
    warning_days: int
    created_at: datetime


class DocumentTypeCreate(BaseModel):
    name_tr: str
    name_en: str
    is_mandatory: bool = True
    warning_days: int = 30


class PersonnelDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    personnel_id: str
    document_type_id: str
    expiry_date: datetime
    notes: Optional[str] = None
    created_at: datetime


class PersonnelDocumentCreate(BaseModel):
    personnel_id: str
    document_type_id: str
    expiry_date: str
    notes: Optional[str] = None


class EntryLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    personnel_id: str
    decision: str
    reason: Optional[str] = None
    checked_by: str
    checked_by_name: str
    timestamp: datetime


class EntryDecision(BaseModel):
    model_config = ConfigDict(extra="ignore")  # ✅ ekstra alanlar sorun çıkarmasın
    personnel_id: str
    decision: str
    reason: Optional[str] = None
    gate: Optional[str] = None  # ✅ EKLENDİ


class SMSMessage(BaseModel):
    phone: str
    message: str


class BulkDeleteRequest(BaseModel):
    ids: List[str]


from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from twilio.rest import Client
import pandas as pd
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
security = HTTPBearer()

# Twilio (optional)
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_PHONE = os.environ.get("TWILIO_PHONE_NUMBER")
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except Exception as e:
        logging.warning(f"Twilio initialization failed: {e}")

app = FastAPI()
api_router = APIRouter(prefix="/api")

@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}


# =========================
# Models
# =========================
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    full_name: str
    role: str  # admin, security, supervisor
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "security"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Personnel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    full_name: str
    tc_number: str
    company: str
    phone: Optional[str] = None
    license_plate: Optional[str] = None
    photo_url: Optional[str] = None
    assignment_start: Optional[datetime] = None
    assignment_end: Optional[datetime] = None
    created_at: datetime


class PersonnelCreate(BaseModel):
    full_name: str
    tc_number: str
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
    personnel_id: str
    decision: str
    reason: Optional[str] = None


class SMSMessage(BaseModel):
    phone: str
    message: str


class BulkDeleteRequest(BaseModel):
    ids: List[str]


# =========================
# Helper functions
# =========================
def norm_email(e: str) -> str:
    return (e or "").strip().lower()


def new_id(prefix: str) -> str:
    return f"{prefix}_{int(datetime.now(timezone.utc).timestamp() * 1000)}"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def parse_dt_safe(value):
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
    Dashboard/stats ile aynı mantık:
    - assignment_end geçmişse => cannot
    - zorunlu evraklardan herhangi biri expired/parse error => cannot
    - aksi halde => can
    Not: zorunlu evrak hiç yoksa dashboard gibi 'can' sayar (has_expired=False kalır).
    """
    now = datetime.now(timezone.utc)

    # 1) zorunlu doc type id'lerini al
    doc_types = await db.document_types.find({}, {"_id": 0, "id": 1, "is_mandatory": 1}).to_list(1000)
    mandatory_type_ids = {dt["id"] for dt in doc_types if dt.get("is_mandatory")}

    # 2) bu sayfadaki personnel id'leri
    ids = [p["id"] for p in personnel_list if p.get("id")]
    if not ids:
        return {}

    # 3) yalnızca bu kişiler + yalnızca zorunlu dokümanlar
    docs = await db.personnel_documents.find(
        {"personnel_id": {"$in": ids}, "document_type_id": {"$in": list(mandatory_type_ids)}},
        {"_id": 0, "personnel_id": 1, "expiry_date": 1, "document_type_id": 1},
    ).to_list(200000)

    docs_by_personnel = {}
    for d in docs:
        docs_by_personnel.setdefault(d["personnel_id"], []).append(d)

    result = {}

    for p in personnel_list:
        pid = p.get("id")
        if not pid:
            continue

        # assignment check
        assignment_end = parse_dt_safe(p.get("assignment_end"))
        if assignment_end and assignment_end < now:
            result[pid] = False
            continue

        # mandatory docs expiry check
        has_expired = False
        for d in docs_by_personnel.get(pid, []):
            expiry = parse_dt_safe(d.get("expiry_date"))
            if not expiry:
                has_expired = True
                break
            if (expiry - now).days < 0:
                has_expired = True
                break

        result[pid] = (not has_expired)

    return result

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_role(user: dict, allowed_roles: List[str]):
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Permission denied")


async def ensure_indexes():
    try:
        await db.users.create_index("email", unique=True)
    except Exception:
        pass
    try:
        await db.users.create_index("id", unique=True)
    except Exception:
        pass


@app.on_event("startup")
async def startup():
    await ensure_indexes()


# =========================
# Auth endpoints
# =========================
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    email = norm_email(str(user_data.email))

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "id": new_id("user"),
        "email": email,
        "password": hash_password(user_data.password),
        "full_name": user_data.full_name.strip(),
        "role": (user_data.role or "security").strip(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    return {"message": "User registered successfully"}


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    email = norm_email(str(credentials.email))

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    hashed = user.get("password") or ""
    if not isinstance(hashed, str) or not hashed.startswith("$2"):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(credentials.password, hashed):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user["id"], "role": user.get("role", "security")})
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    }


@api_router.get("/auth/seed-admin")
async def seed_admin():
    try:
        email = norm_email("ilker.bocek@gmail.com")
        plain_password = "123456"

        existing = await db.users.find_one({"email": email})
        if existing:
            return {"status": "already exists", "email": email}

        user = {
            "id": "1",
            "email": email,
            "full_name": "Admin",
            "password": hash_password(plain_password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        await db.users.insert_one(user)
        return {"status": "created", "email": email, "password": plain_password}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"seed-admin error: {repr(e)}")


@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user["role"]
    }


@api_router.post("/auth/normalize-emails")
async def normalize_emails(current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    users = await db.users.find({}, {"_id": 0, "id": 1, "email": 1}).to_list(10000)
    updated = 0
    for u in users:
        old = u.get("email", "")
        new = norm_email(old)
        if new and new != old:
            await db.users.update_one({"id": u["id"]}, {"$set": {"email": new}})
            updated += 1
    return {"status": "ok", "updated": updated}


# =========================
# User Management (Admin only)
# =========================
@api_router.get("/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return users


@api_router.post("/users")
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    email = norm_email(str(user_data.email))

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "id": new_id("user"),
        "email": email,
        "password": hash_password(user_data.password),
        "full_name": user_data.full_name.strip(),
        "role": (user_data.role or "security").strip(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    return {"message": "User created successfully", "id": user_doc["id"]}


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    email = norm_email(str(user_data.email))

    email_exists = await db.users.find_one({"email": email, "id": {"$ne": user_id}})
    if email_exists:
        raise HTTPException(status_code=400, detail="Email already in use")

    update_data = {
        "email": email,
        "full_name": user_data.full_name.strip(),
        "role": (user_data.role or "security").strip()
    }

    if user_data.password and user_data.password.strip():
        update_data["password"] = hash_password(user_data.password)

    await db.users.update_one({"id": user_id}, {"$set": update_data})
    return {"message": "User updated"}


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}


# =========================
# Personnel endpoints
# =========================
@api_router.post("/personnel")
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


@api_router.get("/personnel")
async def get_personnel(
    page: int = 1,
    limit: int = 50,
    search: str = None,
    status: str = None,  # "can" | "cannot" | "all"
    current_user: dict = Depends(get_current_user)
):
    # status normalize
    status = (status or "").strip().lower()
    if status not in ["", "all", "can", "cannot"]:
        status = ""  # bilinmeyen gelirse yok say

    query = {}

    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"tc_number": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}}
        ]

    # ✅ Eğer status istenmiyorsa: hızlı yol
    if status in ["", "all"]:
        skip = (page - 1) * limit
        total = await db.personnel.count_documents(query)

        personnel_list = await db.personnel.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)

        # can_enter hesapla (frontend gerekirse kullanır)
        can_map = await compute_can_enter_map(personnel_list)
        for p in personnel_list:
            pid = p.get("id")
            p["can_enter"] = bool(can_map.get(pid, True))  # default True (dashboard mantığı)

        return {
            "data": personnel_list,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }

    # ✅ status=can/cannot ise: total/pages doğru olsun diye filtreli pagination yap
    # 1) önce tüm aday id + assignment_end çek (search filtresine göre)
    all_candidates = await db.personnel.find(query, {"_id": 0, "id": 1, "assignment_end": 1}).to_list(200000)

    # 2) can_enter hesapla
    can_map = await compute_can_enter_map(all_candidates)

    want = True if status == "can" else False
    filtered_ids = [p["id"] for p in all_candidates if can_map.get(p["id"], True) == want]

    total = len(filtered_ids)
    pages = (total + limit - 1) // limit if total > 0 else 1

    # 3) bu sayfanın id'lerini al
    start = (page - 1) * limit
    end = start + limit
    page_ids = filtered_ids[start:end]

    if not page_ids:
        return {"data": [], "total": total, "page": page, "limit": limit, "pages": pages}

    # 4) detayları çek
    personnel_list = await db.personnel.find({"id": {"$in": page_ids}}, {"_id": 0}).to_list(limit)

    # 5) sıralama: filtered_ids sırasını koru
    order = {pid: i for i, pid in enumerate(page_ids)}
    personnel_list.sort(key=lambda x: order.get(x.get("id"), 10**9))

    # 6) can_enter alanını ekle
    for p in personnel_list:
        pid = p.get("id")
        p["can_enter"] = bool(can_map.get(pid, True))

    return {
        "data": personnel_list,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }
    
@api_router.get("/personnel/search")
async def search_personnel(q: str, current_user: dict = Depends(get_current_user)):
    query = {
        "$or": [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"tc_number": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"license_plate": {"$regex": q, "$options": "i"}}
        ]
    }
    results = await db.personnel.find(query, {"_id": 0}).to_list(100)
    return results


@api_router.get("/personnel/companies")
async def get_personnel_companies(current_user: dict = Depends(get_current_user)):
    companies = await db.personnel.distinct("company")
    companies = [str(c).strip() for c in companies if c and str(c).strip()]
    companies.sort()
    return {"companies": companies}


@api_router.get("/personnel/{personnel_id}")
async def get_personnel_detail(personnel_id: str, current_user: dict = Depends(get_current_user)):
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


@api_router.put("/personnel/{personnel_id}")
async def update_personnel(personnel_id: str, data: PersonnelCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    update_data = data.model_dump()
    result = await db.personnel.update_one({"id": personnel_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return {"message": "Personnel updated"}


@api_router.delete("/personnel/{personnel_id}")
async def delete_personnel(personnel_id: str, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    result = await db.personnel.delete_one({"id": personnel_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")

    await db.personnel_documents.delete_many({"personnel_id": personnel_id})
    return {"message": "Personnel deleted"}


@api_router.post("/personnel/bulk-import")
async def bulk_import_personnel(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="File must be Excel or CSV format")

    try:
        contents = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
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

                await db.personnel.insert_one(personnel_doc)

                for col in df.columns:
                    if col not in required_columns and col not in ["Ad Soyad", "TC Kimlik No", "Telefon", "Plaka", "Fotoğraf URL", "Görev Başlangıç", "Görev Bitiş"]:
                        doc_type_id = doc_type_map_tr.get(col) or doc_type_map_en.get(col)
                        if doc_type_id and pd.notna(row.get(col)):
                            expiry_date_raw = str(row[col]).strip()
                            if expiry_date_raw and expiry_date_raw != "" and expiry_date_raw.lower() != "nan":
                                expiry_date = convert_date(expiry_date_raw)
                                if expiry_date:
                                    doc = {
                                        "id": f"{new_id('doc')}_{index}_{col}",
                                        "personnel_id": personnel_id,
                                        "document_type_id": doc_type_id,
                                        "expiry_date": expiry_date,
                                        "notes": "Imported from Excel",
                                        "created_at": datetime.now(timezone.utc).isoformat()
                                    }
                                    await db.personnel_documents.insert_one(doc)

                imported_count += 1

            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
                continue

        return {"message": "Import completed", "imported": imported_count, "skipped": skipped_count, "errors": errors}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@api_router.post("/personnel/bulk-delete")
async def bulk_delete_personnel(payload: BulkDeleteRequest, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    if not payload.ids:
        return {"deleted_count": 0}

    personnel_result = await db.personnel.delete_many({"id": {"$in": payload.ids}})
    await db.personnel_documents.delete_many({"personnel_id": {"$in": payload.ids}})
    return {"deleted_count": personnel_result.deleted_count}


# =========================
# Document Type endpoints
# =========================
@api_router.post("/documents/types")
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


@api_router.get("/documents/types")
async def get_document_types(current_user: dict = Depends(get_current_user)):
    doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
    return doc_types


@api_router.delete("/documents/types/{type_id}")
async def delete_document_type(type_id: str, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    result = await db.document_types.delete_one({"id": type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document type not found")
    return {"message": "Document type deleted"}


# =========================
# Personnel Document endpoints
# =========================
@api_router.post("/documents")
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


@api_router.get("/documents/{personnel_id}")
async def get_personnel_documents(personnel_id: str, current_user: dict = Depends(get_current_user)):
    documents = await db.personnel_documents.find({"personnel_id": personnel_id}, {"_id": 0}).to_list(100)
    return documents


@api_router.put("/documents/{doc_id}")
async def update_document(doc_id: str, data: PersonnelDocumentCreate, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    update_data = {"expiry_date": data.expiry_date, "notes": data.notes}
    result = await db.personnel_documents.update_one({"id": doc_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document updated"}


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    result = await db.personnel_documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}


# =========================
# Entry Log endpoints
# =========================
@api_router.post("/entry/decision")
async def make_entry_decision(decision: EntryDecision, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    log = {
        "id": new_id("log"),
        "personnel_id": decision.personnel_id,
        "decision": decision.decision,
        "reason": decision.reason,
        "checked_by": current_user["id"],
        "checked_by_name": current_user["full_name"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.entry_logs.insert_one(log)

    if twilio_client and decision.decision == "rejected":
        try:
            personnel = await db.personnel.find_one({"id": decision.personnel_id})
            if personnel and personnel.get("phone"):
                message = f"Entry rejected: {decision.reason or 'Document issue'}"
                twilio_client.messages.create(body=message, from_=TWILIO_PHONE, to=personnel["phone"])
        except Exception as e:
            logging.error(f"SMS send failed: {e}")

    return {"message": "Entry decision recorded", "id": log["id"]}


@api_router.get("/entry/logs")
async def get_entry_logs(limit: int = 100, current_user: dict = Depends(get_current_user)):
    logs = await db.entry_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)

    personnel_ids = list(set(log["personnel_id"] for log in logs))
    all_personnel = await db.personnel.find({"id": {"$in": personnel_ids}}, {"_id": 0}).to_list(len(personnel_ids))
    personnel_map = {p["id"]: p for p in all_personnel}

    enriched_logs = []
    for log in logs:
        personnel = personnel_map.get(log["personnel_id"])
        enriched_logs.append({**log, "personnel": personnel})

    return enriched_logs


# =========================
# Dashboard stats
# =========================
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_personnel = await db.personnel.count_documents({})
    total_entries_today = await db.entry_logs.count_documents({
        "timestamp": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
    })
    approved_today = await db.entry_logs.count_documents({
        "timestamp": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()},
        "decision": "approved"
    })
    rejected_today = await db.entry_logs.count_documents({
        "timestamp": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()},
        "decision": "rejected"
    })

    all_personnel = await db.personnel.find({}, {"_id": 0, "id": 1, "assignment_end": 1}).to_list(1000)
    doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
    doc_types_map = {dt["id"]: dt for dt in doc_types}

    all_documents = await db.personnel_documents.find({}, {"_id": 0, "personnel_id": 1, "document_type_id": 1, "expiry_date": 1}).to_list(10000)
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
        "cannot_enter": cannot_enter
    }


# =========================
# Alerts endpoint
# =========================
@api_router.get("/alerts/expiring-documents")
async def get_expiring_documents(days: int = 30, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin", "supervisor"])

    now = datetime.now(timezone.utc)

    doc_types = await db.document_types.find({}, {"_id": 0}).to_list(100)
    doc_types_map = {dt["id"]: dt for dt in doc_types}

    all_documents = await db.personnel_documents.find({}, {"_id": 0}).to_list(10000)

    expiring_personnel = {}

    for doc in all_documents:
        doc_type = doc_types_map.get(doc["document_type_id"])
        if not doc_type:
            continue

        expiry_str = doc.get("expiry_date")
        if not expiry_str:
            continue

        try:
            expiry = datetime.fromisoformat(expiry_str) if isinstance(expiry_str, str) else expiry_str
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)

            days_until = (expiry - now).days
            if days_until <= days:
                personnel_id = doc["personnel_id"]
                expiring_personnel.setdefault(personnel_id, []).append({
                    "document_type": doc_type["name_tr"],
                    "document_type_en": doc_type["name_en"],
                    "expiry_date": expiry_str,
                    "days_until_expiry": days_until,
                    "is_expired": days_until < 0,
                    "is_mandatory": doc_type["is_mandatory"]
                })
        except (ValueError, AttributeError):
            continue

    personnel_ids = list(expiring_personnel.keys())
    if not personnel_ids:
        return {"alerts": [], "total": 0}

    all_personnel = await db.personnel.find({"id": {"$in": personnel_ids}}, {"_id": 0}).to_list(len(personnel_ids))
    personnel_map = {p["id"]: p for p in all_personnel}

    alerts = []
    for p_id, docs in expiring_personnel.items():
        personnel = personnel_map.get(p_id)
        if personnel:
            docs.sort(key=lambda x: x["days_until_expiry"])
            alerts.append({
                "personnel_id": p_id,
                "full_name": personnel.get("full_name"),
                "company": personnel.get("company"),
                "phone": personnel.get("phone"),
                "expiring_documents": docs,
                "most_urgent_days": docs[0]["days_until_expiry"] if docs else None
            })

    alerts.sort(key=lambda x: x["most_urgent_days"] if x["most_urgent_days"] is not None else 999)
    return {"alerts": alerts, "total": len(alerts), "threshold_days": days}


# =========================
# Entry logs with pagination
# =========================
@api_router.get("/entry/logs/paginated")
async def get_entry_logs_paginated(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    skip = (page - 1) * limit
    total = await db.entry_logs.count_documents({})
    logs = await db.entry_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)

    personnel_ids = list(set(log["personnel_id"] for log in logs))
    all_personnel = await db.personnel.find({"id": {"$in": personnel_ids}}, {"_id": 0}).to_list(len(personnel_ids))
    personnel_map = {p["id"]: p for p in all_personnel}

    enriched_logs = []
    for log in logs:
        personnel = personnel_map.get(log["personnel_id"])
        enriched_logs.append({**log, "personnel": personnel})

    return {
        "data": enriched_logs,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


# =========================
# SMS endpoint
# =========================
@api_router.post("/sms/send")
async def send_sms(sms: SMSMessage, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    if not twilio_client:
        raise HTTPException(status_code=503, detail="SMS service not configured")

    try:
        message = twilio_client.messages.create(body=sms.message, from_=TWILIO_PHONE, to=sms.phone)
        return {"message": "SMS sent", "sid": message.sid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# Include router + CORS
# =========================
app.include_router(api_router)

cors_env = os.environ.get("CORS_ORIGINS", "*").strip()
if cors_env == "*" or cors_env == "":
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in cors_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@app.get("/")
async def root():
    return {
        "service": "clear2work-api",
        "status": "running",
        "time": datetime.now(timezone.utc).isoformat()
    }

@app.get("/health")
async def health_check():
    try:
        await db.command("ping")
        mongo = "ok"
    except Exception as e:
        mongo = f"error: {str(e)}"

    return {
        "status": "ok",
        "mongo": mongo,
        "time": datetime.now(timezone.utc).isoformat()
    }

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

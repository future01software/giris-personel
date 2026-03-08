from fastapi import APIRouter, HTTPException, Depends

from app.models import UserCreate, UserLogin
from app.db import db
from app.security import hash_password, verify_password, create_access_token, norm_email
from app.deps import get_current_user, require_role
from app.utils import new_id
from datetime import datetime, timezone

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
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


@router.post("/login")
async def login(credentials: UserLogin):
    # Support both username and email fields during transition
    identity = (credentials.username or credentials.email or "").strip().lower()
    if not identity:
        raise HTTPException(status_code=422, detail="Username or email is required")

    user = await db.users.find_one({"email": identity}, {"_id": 0})
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


@router.get("/seed-admin")
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


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user["role"]
    }


@router.post("/normalize-emails")
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

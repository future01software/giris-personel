from fastapi import APIRouter, HTTPException, Depends

from app.models import UserCreate
from app.db import db
from app.deps import get_current_user, require_role
from app.security import hash_password, norm_email
from app.utils import new_id
from datetime import datetime, timezone

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def get_users(current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return users


@router.post("")
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


@router.put("/{user_id}")
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


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

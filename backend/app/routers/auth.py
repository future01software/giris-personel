from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import secrets

from app.db import db
from app.models import UserCreate, UserLogin
from app.security import norm_email, hash_password, verify_password, create_access_token
from app.deps import get_current_user, require_role
from app.utils import new_id
from app.services.mailer import send_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(user_data: UserCreate):
    email = norm_email(str(user_data.email))
    username = user_data.username.strip().lower()

    existing_email = await db.users.find_one({"email": email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_user = await db.users.find_one({"username": username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    user_doc = {
        "id": new_id("user"),
        "username": username,
        "email": email,
        "password": hash_password(user_data.password),
        "full_name": user_data.full_name.strip(),
        "role": (user_data.role or "security").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return {"message": "User registered successfully"}


@router.post("/login")
async def login(credentials: UserLogin):
    username = credentials.username.strip().lower()

    # Try finding by username first, fallback to email if needed (for transition)
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if not user:
        user = await db.users.find_one({"email": username}, {"_id": 0})

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
            "username": user.get("username", user["email"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
        },
    }


# ✅ BU ENDPOINT ŞART: frontend bunu çağırıyor
@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user.get("username", current_user["email"]),
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user["role"],
    }


@router.get("/seed-admin")
async def seed_admin():
    email = norm_email("ilker.bocek@gmail.com")
    username = "admin"
    plain_password = "123456"

    # email varsa dokunma
    existing_by_email = await db.users.find_one({"email": email})
    if existing_by_email:
        # ensure username exists
        if not existing_by_email.get("username"):
            await db.users.update_one({"email": email}, {"$set": {"username": username}})
        return {"status": "already exists", "email": email, "username": existing_by_email.get("username", username)}

    # id=1 varsa update et
    existing_by_id = await db.users.find_one({"id": "1"})
    if existing_by_id:
        await db.users.update_one(
            {"id": "1"},
            {"$set": {
                "username": username,
                "email": email,
                "full_name": "Admin",
                "password": hash_password(plain_password),
                "role": "admin",
            }}
        )
        return {"status": "updated id=1", "email": email, "username": username, "password": plain_password}

    # yoksa oluştur
    user = {
        "id": "1",
        "username": username,
        "email": email,
        "full_name": "Admin",
        "password": hash_password(plain_password),
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    return {"status": "created", "email": email, "username": username, "password": plain_password}


@router.post("/forgot-password")
async def forgot_password(data: dict):
    email = norm_email(data.get("email", ""))
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
        
    user = await db.users.find_one({"email": email})
    if not user:
        # Don't reveal if user exists or not for security
        return {"message": "If an account exists with this email, a reset link has been sent."}
        
    token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.users.update_one(
        {"email": email},
        {"$set": {
            "reset_token": token,
            "reset_token_expiry": expiry.isoformat()
        }}
    )
    
    # Dynamic Frontend URL for Reset Link
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000") 
    reset_link = f"{frontend_url}/reset-password?token={token}"
    
    subject = "Clear2Work Şifre Sıfırlama"
    
    mail_from_name = os.environ.get("MAIL_FROM_NAME", "Clear2Work")
    from_email = os.environ.get("MAIL_FROM", "no-reply@example.com")
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2563eb;">Şifre Sıfırlama Talebi</h2>
        <p>Merhaba,</p>
        <p>Hesabınız için bir şifre sıfırlama talebi aldık. Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Şifremi Sıfırla</a>
        </div>
        <p>Bu bağlantı 1 saat süreyle geçerlidir. Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">{mail_from_name} Güvenlik Ekibi</p>
    </div>
    """
    
    try:
        send_email(subject, html, [email])
    except Exception as e:
        # Log error but don't fail the request to not leak user existence
        print(f"FAILED TO SEND EMAIL: {e}")
    
    return {"message": "If an account exists with this email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(data: dict):
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required")
        
    user = await db.users.find_one({"reset_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
        
    expiry_str = user.get("reset_token_expiry")
    if not expiry_str:
        raise HTTPException(status_code=400, detail="Invalid token state")
        
    expiry = datetime.fromisoformat(expiry_str)
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
        
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="Token has expired")
        
    # Update password and clear token
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"password": hash_password(new_password)},
            "$unset": {"reset_token": 1, "reset_token_expiry": 1}
        }
    )
    
    return {"message": "Password reset successfully"}


@router.post("/migrate-usernames")
async def migrate_usernames(current_user: dict = Depends(get_current_user)):
    await require_role(current_user, ["admin"])

    users = await db.users.find({"username": {"$exists": False}}).to_list(1000)
    updated = 0
    for u in users:
        email = u.get("email", "")
        if email:
            # Derived username from email prefix
            new_username = email.split("@")[0].lower()
            # check if exists
            exists = await db.users.find_one({"username": new_username})
            if exists:
                new_username = f"{new_username}_{u['id'][-4:]}"
                
            await db.users.update_one({"id": u["id"]}, {"$set": {"username": new_username}})
            updated += 1
            
    return {"status": "ok", "updated": updated}


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

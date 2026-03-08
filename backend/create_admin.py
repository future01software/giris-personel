import asyncio
from app.db import db
import bcrypt

async def create_admin():
    email = "admin@gatekeeper.com"
    password = "admin123"
    
    # Simple bcrypt hash
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Check if user exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"User {email} already exists, updating password...")
        result = await db.users.update_one(
            {"email": email},
            {"$set": {"password": hashed}}
        )
        print(f"Updated: {result.modified_count} user(s)")
    else:
        print(f"Creating new user {email}...")
        await db.users.insert_one({
            "id": "admin-001",
            "email": email,
            "password": hashed,
            "full_name": "System Administrator",
            "role": "admin",
            "created_at": "2026-01-31T00:00:00Z"
        })
        print("Admin user created successfully!")

if __name__ == "__main__":
    asyncio.run(create_admin())

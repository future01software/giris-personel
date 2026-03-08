import asyncio
from app.db import db
from app.security import hash_password

async def reset_password():
    email = "ilker.bocek@gmail.com"
    new_pass = "123456"
    print(f"Resetting password for {email}...")
    
    hashed = hash_password(new_pass)
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"password": hashed}}
    )
    
    if result.modified_count > 0:
        print(f"SUCCESS: Password updated to '{new_pass}'")
    else:
        print("WARNING: User found but not modified (password might be same) or user not found.")
        # Check if user exists
        user = await db.users.find_one({"email": email})
        if user:
            print("User exists.")
        else:
            print("ERROR: User not found!")

if __name__ == "__main__":
    asyncio.run(reset_password())

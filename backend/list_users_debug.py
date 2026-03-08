import asyncio
from app.db import db

async def list_users():
    print("Fetching users...")
    users = await db.users.find().to_list(100)
    for u in users:
        print(f"User: {u.get('email')} | Role: {u.get('role')} | Name: {u.get('full_name')}")

if __name__ == "__main__":
    asyncio.run(list_users())

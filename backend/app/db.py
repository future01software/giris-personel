import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "demo_db")

DEMO_MODE = False
db = None
client = None

if not mongo_url:
    print("\n" + "!" * 50)
    print("WARNING: MONGO_URL not set. STARTING IN DEMO MODE.")
    print("Database features will use mock data.")
    print("!" * 50 + "\n")
    DEMO_MODE = True
    # Create a mock object that won't crash on attribute access
    class MockDB:
        def __getattr__(self, name):
            return self
        def __getitem__(self, name):
            return self
        async def find_one(self, *args, **kwargs): return None
        async def find(self, *args, **kwargs):
            class MockCursor:
                async def to_list(self, *args, **kwargs): return []
                def sort(self, *args, **kwargs): return self
                def limit(self, *args, **kwargs): return self
            return MockCursor()
        async def insert_one(self, *args, **kwargs): return None
        async def update_one(self, *args, **kwargs): return None
        async def delete_one(self, *args, **kwargs): return None
        async def count_documents(self, *args, **kwargs): return 0
    
    db = MockDB()
    client = MockDB()
else:
    client = AsyncIOMotorClient(
        mongo_url,
        maxPoolSize=100,
        minPoolSize=10,
        maxIdleTimeMS=45000,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=45000,
    )
    db = client[db_name]


async def ensure_indexes():
    try: await db.users.create_index("email", unique=True)
    except Exception: pass
    try: await db.users.create_index("id", unique=True)
    except Exception: pass

    try: await db.personnel.create_index("id", unique=True)
    except Exception: pass
    try: await db.personnel.create_index("company")
    except Exception: pass
    try: await db.personnel.create_index("tc_number")
    except Exception: pass
    try: await db.personnel.create_index("full_name")
    except Exception: pass
    # Compound index for common queries
    try: await db.personnel.create_index([("company", 1), ("assignment_end", 1)])
    except Exception: pass

    try:
        await db.personnel_documents.create_index([("personnel_id", 1), ("document_type_id", 1)])
    except Exception:
        pass
    try: await db.personnel_documents.create_index("personnel_id")
    except Exception: pass
    try: await db.personnel_documents.create_index("document_type_id")
    except Exception: pass
    # Index for expiry queries
    try: await db.personnel_documents.create_index("expiry_date")
    except Exception: pass

    try: await db.entry_logs.create_index([("timestamp", -1)])
    except Exception: pass
    try: await db.entry_logs.create_index([("created_at", -1)])
    except Exception: pass
    try: await db.entry_logs.create_index("personnel_id")
    except Exception: pass
    try: await db.entry_logs.create_index("person_id")
    except Exception: pass
    # Compound indexes for timestamp queries
    try: await db.entry_logs.create_index([("created_at_ts", -1)])
    except Exception: pass
    try: await db.entry_logs.create_index([("timestamp_ts", -1)])
    except Exception: pass
    # Compound index for person + timestamp queries
    try: await db.entry_logs.create_index([("person_id", 1), ("created_at_ts", -1)])
    except Exception: pass
    # Compound index for action + timestamp (inside count, dashboard filtering)
    try: await db.entry_logs.create_index([("action", 1), ("timestamp_ts", -1)])
    except Exception: pass

    try: await db.document_types.create_index("id", unique=True)
    except Exception: pass

    # Text index for personnel search (faster than $regex)
    try: await db.personnel.create_index([
        ("full_name", "text"),
        ("tc_number", "text"),
        ("company", "text")
    ], default_language="turkish")
    except Exception: pass

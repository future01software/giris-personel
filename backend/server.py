import traceback
import importlib
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.websocket import manager
from app.db import ensure_indexes

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, maybe listen for pings
            # We mostly use this channel for server -> client broadcast
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

origins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://0.0.0.0:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "https://clear2work-484405.web.app",
  "https://clear2work-484405.firebaseapp.com",
  "https://clear2workport.net",
  "https://www.clear2workport.net",
  "https://easy.clear2workport.net",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Initializing database indexes...")
        await ensure_indexes()
        logger.info("Database indexes initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database indexes: {e}")
        print(traceback.format_exc())

# =========================
# SAFE ROUTER LOADING
# =========================
ROUTER_IMPORT_ERROR: str | None = None
ROUTER_IMPORT_ERRORS: dict[str, str] = {}  # her router'ın hatası ayrı görülsün

def _load_router(module_path: str, attr_name: str = "router"):
    """
    Router'ı güvenli şekilde import eder.
    Hata olursa ROUTER_IMPORT_ERRORS içine yazar ve devam eder.
    """
    global ROUTER_IMPORT_ERROR
    try:
        mod = importlib.import_module(module_path)
        router = getattr(mod, attr_name)
        return router
    except Exception:
        err = traceback.format_exc()
        ROUTER_IMPORT_ERRORS[module_path] = err
        ROUTER_IMPORT_ERROR = err  # en az bir hata varsa health/router_ok false olsun
        print(f"ROUTER IMPORT FAILED ({module_path}):\n{err}")
        return None

def _include_if_ok(module_path: str):
    router = _load_router(module_path, "router")
    if router is not None:
        app.include_router(router, prefix="/api")  # hepsi /api/... altında
        return True
    return False

# =========================
# ROUTERS (HEPSI BURADA)
# =========================
_include_if_ok("app.routers.auth")        # /api/auth/...
_include_if_ok("app.routers.users")       # /api/users/...
_include_if_ok("app.routers.personnel")   # /api/personnel/...
_include_if_ok("app.routers.documents")   # /api/documents/...
_include_if_ok("app.routers.entry")       # /api/entry/...
_include_if_ok("app.routers.entry_logs")  # /api/entry-logs/... (router içindeki prefix neyse)
_include_if_ok("app.routers.dashboard")   # /api/dashboard/...
_include_if_ok("app.routers.alerts")      # /api/alerts/...
_include_if_ok("app.routers.sms")         # /api/sms/...

# =========================
# HEALTH
# =========================
@app.get("/health")
async def health():
    db_status = "offline"
    try:
        # Simple ping to check connection
        from app.db import client
        await client.admin.command('ping')
        db_status = "online"
    except Exception:
        db_status = "offline"

    return {
        "status": "ok",
        "database_status": db_status,
        "router_ok": len(ROUTER_IMPORT_ERRORS) == 0,
        "loaded_routers": [
            "auth", "users", "personnel", "documents", "entry",
            "entry_logs", "dashboard", "alerts", "sms"
        ],
        "failed_routers": list(ROUTER_IMPORT_ERRORS.keys()),
    }

# =========================
# ROUTER ERROR VIEW
# =========================
@app.get("/router-error")
def router_error():
    return {
        "ok": len(ROUTER_IMPORT_ERRORS) == 0,
        "errors": ROUTER_IMPORT_ERRORS or {"none": "no error"},
    }

# =========================
# GLOBAL EXCEPTION HANDLER
# =========================
@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    print("UNHANDLED ERROR:", repr(exc))
    print(traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

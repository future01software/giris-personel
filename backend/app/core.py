import os
import logging
from datetime import datetime, timezone

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from .db import client, db, ensure_indexes


def create_app() -> FastAPI:
    # Logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    logger = logging.getLogger("clear2work")

    app = FastAPI()

    # Health (GET + HEAD) — Render/UptimeRobot uyumlu
    @app.api_route("/health", methods=["GET", "HEAD"])
    def health():
        return {"status": "ok"}

    # Root
    @app.get("/")
    async def root():
        return {
            "service": "clear2work-api",
            "status": "running",
            "time": datetime.now(timezone.utc).isoformat()
        }

    # DB Health
    @app.get("/health/db")
    async def health_db():
        try:
            await db.command("ping")
            mongo = "ok"
        except Exception as e:
            mongo = f"error: {str(e)}"
            logger.error(f"MongoDB health check failed: {e}")

        return {
            "status": "ok",
            "mongo": mongo,
            "time": datetime.now(timezone.utc).isoformat()
        }

    # CORS
    cors_env = os.environ.get("CORS_ORIGINS", "*").strip()
    if cors_env == "*" or cors_env == "":
        allow_origins = ["*"]
        logger.warning("⚠️  CORS set to allow all origins (*) - NOT RECOMMENDED FOR PRODUCTION")
    else:
        allow_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
        logger.info(f"✅ CORS origins configured: {allow_origins}")

    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=allow_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Startup
    @app.on_event("startup")
    async def startup():
        await ensure_indexes()
        logger.info("🚀 Application started successfully")

    # Shutdown
    @app.on_event("shutdown")
    async def shutdown_db_client():
        logger.info("Shutting down application...")
        client.close()
        logger.info("MongoDB connection closed")

    return app

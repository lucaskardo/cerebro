"""
CEREBRO v7 — FastAPI Entry Point
Mounts routers and middleware only. Business logic lives in routers/.
"""
import sys
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

from packages.core import config, get_logger
from apps.api.app.middleware.logging_mw import RequestLoggingMiddleware

logger = get_logger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CEREBRO API starting...")
    logger.info(f"Budget: ${config.DAILY_BUDGET}/day | Domain: {config.PRIMARY_DOMAIN}")
    auth_status = "configured" if config.API_SECRET_KEY else "⚠ NOT SET"
    logger.info(f"Auth: {auth_status} | Flags: auto_publish={config.AUTO_PUBLISH}")

    # Seed prompt versions to DB (idempotent)
    try:
        from packages.content.prompt_store import seed_prompts
        await seed_prompts()
        logger.info("Prompt versions seeded")
    except Exception as e:
        logger.warning(f"Prompt seed failed (non-fatal): {e}")

    # Start job worker in background
    from packages.jobs import run_worker
    worker_task = asyncio.create_task(run_worker(interval_seconds=30))
    logger.info("Job worker started")

    yield

    worker_task.cancel()
    logger.info("CEREBRO API shutting down")


app = FastAPI(title="CEREBRO", version="7.0.0", lifespan=lifespan)

# ─── CORS ────────────────────────────────────────────────────────────────────
_extra_origins = [o.strip() for o in config.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        f"https://{config.PRIMARY_DOMAIN}",
        *_extra_origins,
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request logging (injects request_id) ────────────────────────────────────
app.add_middleware(RequestLoggingMiddleware)


# ─── Structured error handler ────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "request_id": request_id, "detail": str(exc)},
    )


# ─── Routers ─────────────────────────────────────────────────────────────────
from apps.api.app.routers import system, content, leads, strategy, personas, attribution

app.include_router(system.router)
app.include_router(content.router)
app.include_router(leads.router)
app.include_router(strategy.router)
app.include_router(personas.router)
app.include_router(attribution.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

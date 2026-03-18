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
from fastapi.openapi.utils import get_openapi

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

from packages.core import config, get_logger
from apps.api.app.middleware.logging_mw import RequestLoggingMiddleware
from apps.api.app.middleware.auth import AuthMiddleware
from apps.api.app.middleware.rate_limit import RateLimitMiddleware

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

    # Start job worker + maintenance scheduler in background
    from packages.jobs import run_worker, run_scheduler
    worker_task    = asyncio.create_task(run_worker(interval_seconds=30))
    scheduler_task = asyncio.create_task(run_scheduler(interval_seconds=3600))
    logger.info("Job worker + maintenance scheduler started")

    yield

    worker_task.cancel()
    scheduler_task.cancel()
    logger.info("CEREBRO API shutting down")


_OPENAPI_TAGS = [
    {"name": "System",      "description": "Health, budget, alerts, sites, missions."},
    {"name": "Content",     "description": "SEO content generation pipeline: generate → review → approve → publish."},
    {"name": "Leads",       "description": "Lead capture, qualification, lifecycle transitions, and outcomes."},
    {"name": "Strategy",    "description": "Goals and AI-generated strategies for demand generation."},
    {"name": "Execution",   "description": "Opportunities, experiments, tasks, and approval queue."},
    {"name": "Attribution", "description": "Funnel tracking: visitor → lead → conversion. UTM attribution reports."},
    {"name": "Personas",    "description": "Digital personas, platform identities, and social content schedule."},
    {"name": "Loop",        "description": "Continuous strategy loop: run cycles, view history, monitor status."},
]

app = FastAPI(
    title="CEREBRO API",
    version="7.0.0",
    summary="AI Demand Generation Engine",
    description="""
## CEREBRO v7

Autonomous demand generation: **Goals → Strategies → Skills → Leads → Attribution**.

### Authentication
All endpoints except the public whitelist require `X-API-Key` header.

```
X-API-Key: <your-secret-key>
```

### Rate Limits
| Tier | Limit |
|------|-------|
| Authenticated | 300 req / 60s per IP |
| Public (unauthenticated) | 60 req / 60s per IP |
| Lead capture | 10 req / 60s per IP |

Rate limit headers are returned on every response:
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Versioning
Current API version: **v1** (stable). Breaking changes will be introduced at `/api/v2/`.
The response header `X-API-Version: 1` is set on all responses.

### Error Format
```json
{"error": "string", "detail": "string", "request_id": "uuid"}
```
""",
    lifespan=lifespan,
    openapi_tags=_OPENAPI_TAGS,
    contact={"name": "CEREBRO", "url": f"https://{config.PRIMARY_DOMAIN}"},
    license_info={"name": "Private — All rights reserved"},
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

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

# ─── Rate limiting ───────────────────────────────────────────────────────────
app.add_middleware(RateLimitMiddleware)

# ─── Auth (enforces X-API-Key on all non-public routes) ─────────────────────
app.add_middleware(AuthMiddleware)

# ─── Request logging (injects request_id) ────────────────────────────────────
app.add_middleware(RequestLoggingMiddleware)


# ─── Version header on all responses ─────────────────────────────────────────
@app.middleware("http")
async def add_version_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-API-Version"] = "1"
    return response


# ─── Structured error handler ────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{request_id}] Unhandled error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "request_id": request_id, "detail": str(exc)},
        headers={"X-API-Version": "1"},
    )


# ─── Routers ─────────────────────────────────────────────────────────────────
from apps.api.app.routers import system, content, leads, strategy, personas, attribution, execution, loop

app.include_router(system.router)
app.include_router(content.router)
app.include_router(leads.router)
app.include_router(strategy.router)
app.include_router(personas.router)
app.include_router(attribution.router)
app.include_router(execution.router)
app.include_router(loop.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

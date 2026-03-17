"""
CEREBRO — Auth Middleware
X-API-Key required for ALL endpoints except the explicit public whitelist.
This includes GET endpoints (leads, personas, goals, etc. are dashboard-only).
Logs every mutative action to audit_log.
"""
import secrets
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from packages.core import db, config, get_logger

logger = get_logger("auth")

# Exact (method, path) pairs that require no auth
PUBLIC_ROUTES: set[tuple[str, str]] = {
    ("GET",  "/health"),
    ("GET",  "/api/status"),
    ("GET",  "/api/sites"),
    ("GET",  "/api/sitemap"),
    ("GET",  "/api/health/business"),
    ("GET",  "/api/loop/status"),
    ("POST", "/api/leads/capture"),
    ("POST", "/api/attribution/event"),
    ("POST", "/api/tracking/visitor"),
    ("POST", "/api/tracking/session"),
    ("POST", "/api/tracking/event"),
}

# GET path prefixes that are always public (public article renderer)
PUBLIC_GET_PREFIXES: tuple[str, ...] = (
    "/api/content/by-slug/",
    "/api/content/",     # public article read for site renderer
)


def _is_public(method: str, path: str) -> bool:
    if (method, path) in PUBLIC_ROUTES:
        return True
    if method == "GET":
        for prefix in PUBLIC_GET_PREFIXES:
            if path.startswith(prefix):
                return True
    return False


class AuthMiddleware(BaseHTTPMiddleware):
    """
    HTTP middleware — enforces X-API-Key on all non-public routes.
    Runs before FastAPI routing so it covers ALL endpoints including GETs
    that don't declare Depends(require_auth).
    """
    async def dispatch(self, request: Request, call_next):
        method = request.method
        path = request.url.path

        if _is_public(method, path):
            return await call_next(request)

        if not config.API_SECRET_KEY:
            logger.warning("API_SECRET_KEY not set — all routes are unprotected!")
            return await call_next(request)

        provided = request.headers.get("x-api-key", "")
        if not provided or not secrets.compare_digest(provided, config.API_SECRET_KEY):
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized", "detail": "Valid X-API-Key header required"},
            )

        return await call_next(request)


async def require_auth(request: Request) -> str:
    """FastAPI dependency — kept for backward compat and audit logging on mutations.
    Auth is already enforced by AuthMiddleware; this just returns the auth status."""
    method = request.method
    path = request.url.path
    if _is_public(method, path):
        return "public"
    if not config.API_SECRET_KEY:
        return "unconfigured"
    provided = request.headers.get("x-api-key", "")
    if not provided or not secrets.compare_digest(provided, config.API_SECRET_KEY):
        raise HTTPException(
            status_code=401,
            detail={"error": "Unauthorized", "detail": "Valid X-API-Key header required"},
        )
    return "authenticated"


async def audit(
    request: Request,
    action: str,
    entity_type: str = None,
    entity_id: str = None,
    payload_summary: dict = None,
):
    """Write an entry to audit_log. Fire-and-forget — never raises."""
    try:
        actor = request.headers.get("x-api-key", "public")[:8] + "..."
        ip = request.client.host if request.client else "unknown"
        request_id = getattr(request.state, "request_id", "unknown")
        await db.insert("audit_log", {
            "actor": actor,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "ip": ip,
            "payload_summary": payload_summary or {"request_id": request_id},
        })
    except Exception as e:
        logger.warning(f"audit_log write failed: {e}")

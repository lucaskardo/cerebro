"""
CEREBRO — Auth Middleware
X-API-Key required for all POST/PUT/PATCH/DELETE.
Public GETs and explicit public POSTs are exempt.
Logs every mutative action to audit_log.
"""
import secrets
from fastapi import Request, HTTPException
from packages.core import db, config, get_logger

logger = get_logger("auth")

# GETs that require no auth (all other GETs require auth via dashboard)
# POSTs that are public (lead capture form, tracking events)
PUBLIC_ROUTES: set[tuple[str, str]] = {
    ("GET",    "/health"),
    ("GET",    "/api/status"),
    ("GET",    "/api/sites"),
    ("GET",    "/api/sitemap"),
    ("GET",    "/api/health/business"),
    ("POST",   "/api/leads/capture"),
    ("POST",   "/api/attribution/event"),
    ("POST",   "/api/tracking/visitor"),
    ("POST",   "/api/tracking/session"),
    ("POST",   "/api/tracking/event"),
}

# Path prefixes that are always public (GET)
PUBLIC_GET_PREFIXES = (
    "/api/content/by-slug/",
    "/api/content/",
    "/api/leads",
    "/api/alerts",
    "/api/budget",
    "/api/missions",
    "/api/clusters",
    "/api/demand",
    "/api/goals",
    "/api/strategies",
    "/api/attribution",
    "/api/personas",
    "/api/social/queue",
    "/api/knowledge",
    "/api/approvals",
    "/api/reports",
    "/api/channels",
)


def _is_public(method: str, path: str) -> bool:
    if (method, path) in PUBLIC_ROUTES:
        return True
    if method == "GET":
        return True   # All GETs are public (dashboard reads)
    return False


async def require_auth(request: Request) -> str:
    """FastAPI dependency — raises 401 if X-API-Key missing/invalid on mutations."""
    method = request.method
    path = request.url.path

    if _is_public(method, path):
        return "public"

    if not config.API_SECRET_KEY:
        logger.warning("API_SECRET_KEY not set — all mutations are unprotected!")
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

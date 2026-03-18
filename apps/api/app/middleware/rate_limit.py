"""
CEREBRO — Rate Limiting Middleware
Simple in-process sliding-window rate limiter (no external dependency).

Limits:
  - Authenticated requests  : 300 req / 60s per IP
  - Public/unauthenticated  : 60 req / 60s per IP
  - Lead capture endpoint   : 10 req / 60s per IP (anti-spam)

Headers returned:
  X-RateLimit-Limit     — requests allowed in the window
  X-RateLimit-Remaining — requests left in current window
  X-RateLimit-Reset     — epoch seconds when window resets

Returns 429 JSON when limit exceeded.
"""
import time
from collections import defaultdict, deque
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Window size in seconds
_WINDOW = 60

# (limit, window_seconds) per tier
_LIMITS = {
    "authenticated": (300, _WINDOW),
    "public":        (60,  _WINDOW),
    "lead_capture":  (10,  _WINDOW),   # stricter for /api/leads/capture
}

# {tier: {ip: deque of timestamps}}
_buckets: dict[str, dict[str, deque]] = defaultdict(lambda: defaultdict(deque))


def _get_tier(method: str, path: str, is_authenticated: bool) -> str:
    if path == "/api/leads/capture":
        return "lead_capture"
    return "authenticated" if is_authenticated else "public"


def _check_rate(tier: str, ip: str) -> tuple[bool, int, int, int]:
    """
    Sliding-window check.
    Returns (allowed, limit, remaining, reset_epoch).
    """
    limit, window = _LIMITS[tier]
    now = time.time()
    window_start = now - window
    bucket = _buckets[tier][ip]

    # Drop timestamps outside current window
    while bucket and bucket[0] < window_start:
        bucket.popleft()

    count = len(bucket)
    reset_epoch = int(bucket[0] + window) if bucket else int(now + window)

    if count >= limit:
        return False, limit, 0, reset_epoch

    bucket.append(now)
    remaining = limit - count - 1
    return True, limit, remaining, reset_epoch


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Starlette middleware — applied to all routes."""

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        method = request.method
        path = request.url.path

        # Skip rate limiting for internal health checks
        if path == "/health":
            return await call_next(request)

        is_authenticated = bool(request.headers.get("x-api-key"))
        tier = _get_tier(method, path, is_authenticated)
        allowed, limit, remaining, reset = _check_rate(tier, ip)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "detail": f"Maximum {limit} requests per {_WINDOW}s. Retry after {reset - int(time.time())}s.",
                    "retry_after": reset - int(time.time()),
                },
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset),
                    "Retry-After": str(reset - int(time.time())),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset)
        return response

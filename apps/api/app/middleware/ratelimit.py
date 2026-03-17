"""
Simple sliding-window rate limiter.
In-process only — fine for single Railway instance.
"""
import time
from collections import defaultdict, deque
from fastapi import Request, HTTPException

# { ip: deque of timestamps }
_windows: dict[str, deque] = defaultdict(deque)


def rate_limit(max_requests: int = 60, window_seconds: int = 60):
    """
    FastAPI dependency factory.
    Usage: Depends(rate_limit(60, 60))  → 60 req/min per IP
    """
    async def _check(request: Request):
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        cutoff = now - window_seconds
        q = _windows[ip]

        # Evict old timestamps
        while q and q[0] < cutoff:
            q.popleft()

        if len(q) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Too many requests",
                    "detail": f"Max {max_requests} requests per {window_seconds}s",
                },
            )
        q.append(now)

    return _check

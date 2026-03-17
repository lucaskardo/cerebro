"""
CEREBRO — Logging Middleware
Injects request_id (UUID) into every request.
Logs method, path, status, duration.
"""
import uuid
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("cerebro.api")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start = time.monotonic()
        try:
            response = await call_next(request)
        except Exception as exc:
            duration = round((time.monotonic() - start) * 1000)
            logger.error(f"[{request_id}] {request.method} {request.url.path} ERROR {duration}ms — {exc}")
            raise

        duration = round((time.monotonic() - start) * 1000)
        status = response.status_code
        level = logging.WARNING if status >= 400 else logging.INFO
        logger.log(level, f"[{request_id}] {request.method} {request.url.path} {status} {duration}ms")

        response.headers["X-Request-ID"] = request_id
        return response

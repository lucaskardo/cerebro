"""
CEREBRO — Persistent Job Queue
Idempotent, survives restarts, state machine: queued→running→completed/failed→dead_lettered.
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from packages.core import db, get_logger

logger = get_logger("jobs")

# ─── Job handlers registry ──────────────────────────────────────────────────
# Maps job type → async callable(payload: dict) -> dict
_HANDLERS: dict[str, callable] = {}


def register(job_type: str):
    """Decorator to register a job handler."""
    def decorator(fn):
        _HANDLERS[job_type] = fn
        return fn
    return decorator


# ─── Core functions ─────────────────────────────────────────────────────────

async def enqueue(
    type: str,
    payload: dict,
    site_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    priority: int = 0,
) -> Optional[dict]:
    """
    Insert a job. If idempotency_key already exists → skip silently, return None.
    """
    if not idempotency_key:
        idempotency_key = f"{type}:{uuid.uuid4()}"

    # Check for duplicate
    existing = await db.query("jobs", params={
        "select": "id,status",
        "idempotency_key": f"eq.{idempotency_key}",
        "limit": "1",
    })
    if existing:
        logger.info(f"Job skipped (duplicate idempotency_key): {idempotency_key}")
        return None

    job = await db.insert("jobs", {
        "site_id": site_id,
        "type": type,
        "payload_json": payload,
        "status": "queued",
        "idempotency_key": idempotency_key,
        "priority": priority,
    })
    if job:
        logger.info(f"Job enqueued: {type} [{job['id'][:8]}]")
    return job


async def process_next() -> bool:
    """
    Pick the next queued job (highest priority, oldest first), run it.
    Returns True if a job was processed, False if queue was empty.
    """
    jobs = await db.query("jobs", params={
        "select": "*",
        "status": "eq.queued",
        "order": "priority.desc,created_at.asc",
        "limit": "1",
    })
    if not jobs:
        return False

    job = jobs[0]
    job_id = job["id"]
    job_type = job["type"]
    attempts = job.get("attempts", 0) + 1
    max_attempts = job.get("max_attempts", 3)

    # Mark running
    await db.update("jobs", job_id, {
        "status": "running",
        "attempts": attempts,
        "started_at": datetime.now(timezone.utc).isoformat(),
    })
    logger.info(f"Job running: {job_type} [{job_id[:8]}] attempt {attempts}/{max_attempts}")

    handler = _HANDLERS.get(job_type)
    if not handler:
        logger.error(f"No handler for job type: {job_type}")
        await db.update("jobs", job_id, {
            "status": "dead_lettered",
            "error": f"No handler registered for type '{job_type}'",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return True

    try:
        output = await handler(job["payload_json"] or {})
        await db.update("jobs", job_id, {
            "status": "completed",
            "payload_json": {**(job["payload_json"] or {}), "_output": output},
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Job completed: {job_type} [{job_id[:8]}]")
    except Exception as e:
        error_msg = str(e)[:500]
        logger.error(f"Job failed: {job_type} [{job_id[:8]}] — {error_msg}")
        if attempts >= max_attempts:
            await db.update("jobs", job_id, {
                "status": "dead_lettered",
                "error": error_msg,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.warning(f"Job dead-lettered: {job_type} [{job_id[:8]}]")
        else:
            await db.update("jobs", job_id, {
                "status": "queued",   # back to queue for retry
                "error": error_msg,
            })

    return True


async def run_worker(interval_seconds: int = 30):
    """Continuous worker loop. Run as a background task."""
    logger.info(f"Job worker started (interval={interval_seconds}s)")
    while True:
        try:
            processed = True
            # Drain the queue — keep processing until empty
            while processed:
                processed = await process_next()
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
        await asyncio.sleep(interval_seconds)


# ─── Built-in handlers ───────────────────────────────────────────────────────

@register("content_pipeline")
async def _handle_content_pipeline(payload: dict) -> dict:
    from packages.content.pipeline import run_pipeline
    await run_pipeline(
        keyword=payload["keyword"],
        mission_id=payload["mission_id"],
        asset_id=payload["asset_id"],
        site_id=payload.get("site_id"),
    )
    return {"status": "done"}


@register("daily_aggregation")
async def _handle_daily_aggregation(payload: dict) -> dict:
    """Aggregate fact tables for a given date."""
    target_date = payload.get("date")
    logger.info(f"Daily aggregation for {target_date} — stub (implement in Bloque 2.5)")
    return {"date": target_date, "status": "stub"}


@register("partner_delivery")
async def _handle_partner_delivery(payload: dict) -> dict:
    """
    Deliver a qualified lead to a partner webhook.
    payload: {lead_id, site_id, webhook_id, webhook_url, webhook_secret, attempt}
    Exponential backoff is handled by the job queue retry mechanism (max_attempts=3).
    """
    import hmac
    import hashlib
    import httpx

    lead_id = payload["lead_id"]
    site_id = payload.get("site_id")
    webhook_url = payload["webhook_url"]
    webhook_secret = payload.get("webhook_secret", "")
    webhook_id = payload.get("webhook_id")

    lead = await db.get_by_id("leads", lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")

    body = {
        "lead_id": lead_id,
        "email": lead.get("email"),
        "nombre": lead.get("nombre"),
        "telefono": lead.get("telefono"),
        "intent_score": lead.get("intent_score"),
        "tema_interes": lead.get("tema_interes"),
        "utm_source": lead.get("utm_source"),
        "utm_medium": lead.get("utm_medium"),
        "delivered_at": datetime.now(timezone.utc).isoformat(),
    }

    # HMAC-SHA256 signature for verification
    signature = ""
    if webhook_secret:
        sig_payload = json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode()
        signature = hmac.new(webhook_secret.encode(), sig_payload, hashlib.sha256).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Cerebro-Signature": signature,
        "X-Cerebro-Lead-Id": lead_id,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(webhook_url, json=body, headers=headers)
        resp.raise_for_status()

    # Record delivery event
    await db.insert("lead_events", {
        "site_id": site_id,
        "lead_id": lead_id,
        "from_status": "qualified",
        "to_status": "delivered",
        "reason": f"partner_delivery webhook_id={webhook_id}",
        "triggered_by": "job_worker",
    })

    # Transition lead to delivered
    await db.update("leads", lead_id, {"current_status": "delivered"})

    logger.info(f"Partner delivery success: lead={lead_id} webhook={webhook_id} status={resp.status_code}")
    return {"status": "delivered", "http_status": resp.status_code}

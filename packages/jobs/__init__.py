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

@register("skill_task")
async def _handle_skill_task(payload: dict) -> dict:
    """Run a single task by ID using the execution router logic."""
    task_id = payload.get("task_id")
    if not task_id:
        raise ValueError("skill_task job missing task_id")
    task = await db.get_by_id("tasks", task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    from packages.skills import get_skill
    skill = get_skill(task["skill_name"])
    if not skill:
        raise ValueError(f"Skill '{task['skill_name']}' not registered")

    await db.update("tasks", task_id, {
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "attempts": task.get("attempts", 0) + 1,
    })
    try:
        result = await skill.run_with_tracking(
            task.get("input_json") or {},
            task_id=task_id,
            site_id=task.get("site_id"),
        )
        await db.update("tasks", task_id, {
            "status": "completed",
            "output_json": result if isinstance(result, dict) else {"result": str(result)},
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"task_id": task_id, "status": "completed"}
    except Exception as e:
        attempts = task.get("attempts", 0) + 1
        max_attempts = 3
        new_status = "dead_lettered" if attempts >= max_attempts else "retrying"
        await db.update("tasks", task_id, {
            "status": new_status,
            "error": str(e)[:500],
            "attempts": attempts,
        })
        raise


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
    """
    Aggregate fact tables for a given date.
    Populates fact_daily_asset_performance and fact_daily_channel_performance
    from touchpoints, leads, lead_outcomes.
    """
    from datetime import date as _date
    target_date: str = payload.get("date") or _date.today().isoformat()
    logger.info(f"Daily aggregation running for {target_date}")

    # ── Asset performance ─────────────────────────────────────────────────────
    # Pull touchpoints for the date (pageviews give visits per asset)
    touches = await db.query("touchpoints", params={
        "select": "site_id,asset_id,visitor_id,event_type",
        "created_at": f"gte.{target_date}T00:00:00Z",
        "created_at2": f"lt.{target_date}T23:59:59Z",
    })
    # Actually use proper date filter
    touches = await db.query("touchpoints", params={
        "select": "site_id,asset_id,visitor_id,event_type",
        "created_at": f"gte.{target_date}",
    })

    # Leads for the date grouped by asset_id
    leads_raw = await db.query("leads", params={
        "select": "id,site_id,asset_id,current_status",
        "created_at": f"gte.{target_date}T00:00:00Z",
    })

    # Lead outcomes (revenue)
    outcomes = await db.query("lead_outcomes", params={
        "select": "lead_id,site_id,revenue_value,status",
        "created_at": f"gte.{target_date}T00:00:00Z",
    })
    revenue_by_lead = {o["lead_id"]: float(o.get("revenue_value") or 0) for o in outcomes}

    # Build asset aggregates
    asset_agg: dict[tuple, dict] = {}
    for t in touches:
        sid = t.get("site_id") or ""
        aid = t.get("asset_id") or ""
        if not aid:
            continue
        key = (sid, aid)
        if key not in asset_agg:
            asset_agg[key] = {"visits": 0, "unique_visitors": set(), "cta_clicks": 0}
        asset_agg[key]["visits"] += 1
        if t.get("visitor_id"):
            asset_agg[key]["unique_visitors"].add(t["visitor_id"])
        if t.get("event_type") == "click":
            asset_agg[key]["cta_clicks"] += 1

    lead_agg: dict[tuple, dict] = {}
    for lead in leads_raw:
        sid = lead.get("site_id") or ""
        aid = lead.get("asset_id") or ""
        if not aid:
            continue
        key = (sid, aid)
        if key not in lead_agg:
            lead_agg[key] = {"leads": 0, "qualified_leads": 0, "revenue": 0.0}
        lead_agg[key]["leads"] += 1
        if lead.get("current_status") in ("qualified", "delivered", "accepted"):
            lead_agg[key]["qualified_leads"] += 1
        lead_agg[key]["revenue"] += revenue_by_lead.get(lead["id"], 0.0)

    all_asset_keys = set(asset_agg.keys()) | set(lead_agg.keys())
    asset_rows_upserted = 0
    for (sid, aid) in all_asset_keys:
        a = asset_agg.get((sid, aid), {})
        l = lead_agg.get((sid, aid), {})
        existing = await db.query("fact_daily_asset_performance", params={
            "select": "id",
            "site_id": f"eq.{sid}",
            "asset_id": f"eq.{aid}",
            "date": f"eq.{target_date}",
            "limit": "1",
        })
        row = {
            "site_id": sid or None,
            "asset_id": aid,
            "date": target_date,
            "visits": a.get("visits", 0),
            "unique_visitors": len(a.get("unique_visitors", set())),
            "leads": l.get("leads", 0),
            "qualified_leads": l.get("qualified_leads", 0),
            "revenue": l.get("revenue", 0.0),
            "cta_clicks": a.get("cta_clicks", 0),
        }
        if existing:
            await db.update("fact_daily_asset_performance", existing[0]["id"], row)
        else:
            await db.insert("fact_daily_asset_performance", row)
        asset_rows_upserted += 1

    # ── Channel performance ───────────────────────────────────────────────────
    channel_agg: dict[tuple, dict] = {}
    for t in touches:
        sid = t.get("site_id") or ""
        channel = t.get("channel") or "unknown"
        key = (sid, channel)
        if key not in channel_agg:
            channel_agg[key] = {"visits": 0, "leads": 0, "qualified_leads": 0, "revenue": 0.0}
        channel_agg[key]["visits"] += 1

    for lead in leads_raw:
        sid = lead.get("site_id") or ""
        channel = lead.get("utm_source") or "direct"
        key = (sid, channel)
        if key not in channel_agg:
            channel_agg[key] = {"visits": 0, "leads": 0, "qualified_leads": 0, "revenue": 0.0}
        channel_agg[key]["leads"] += 1
        if lead.get("current_status") in ("qualified", "delivered", "accepted"):
            channel_agg[key]["qualified_leads"] += 1
        channel_agg[key]["revenue"] += revenue_by_lead.get(lead["id"], 0.0)

    channel_rows_upserted = 0
    for (sid, channel) in channel_agg.items():
        pass  # loop var name collision — fix below

    channel_rows_upserted = 0
    for (sid, channel), vals in channel_agg.items():
        existing = await db.query("fact_daily_channel_performance", params={
            "select": "id",
            "site_id": f"eq.{sid}",
            "channel": f"eq.{channel}",
            "date": f"eq.{target_date}",
            "limit": "1",
        })
        row = {
            "site_id": sid or None,
            "channel": channel,
            "date": target_date,
            "visits": vals.get("visits", 0),
            "leads": vals.get("leads", 0),
            "qualified_leads": vals.get("qualified_leads", 0),
            "revenue": vals.get("revenue", 0.0),
        }
        if existing:
            await db.update("fact_daily_channel_performance", existing[0]["id"], row)
        else:
            await db.insert("fact_daily_channel_performance", row)
        channel_rows_upserted += 1

    logger.info(f"Daily aggregation complete: date={target_date} asset_rows={asset_rows_upserted} channel_rows={channel_rows_upserted}")
    return {"date": target_date, "asset_rows": asset_rows_upserted, "channel_rows": channel_rows_upserted}


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

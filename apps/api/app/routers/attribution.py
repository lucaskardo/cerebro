"""Attribution events, visitor/session tracking, reports."""
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from packages.core import db, get_logger
from apps.api.app.middleware.ratelimit import rate_limit

logger = get_logger("router.attribution")
router = APIRouter(tags=["Attribution"])


class AttributionEvent(BaseModel):
    event_type: str
    visitor_id: Optional[str] = None
    session_id: Optional[str] = None
    asset_id: Optional[str] = None
    asset_type: Optional[str] = None
    channel: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    metadata: dict = {}
    site_id: Optional[str] = None


class VisitorCreate(BaseModel):
    site_id: str
    fingerprint_hash: Optional[str] = None


class SessionCreate(BaseModel):
    site_id: str
    visitor_id: Optional[str] = None
    source: Optional[str] = None
    medium: Optional[str] = None
    campaign: Optional[str] = None
    content: Optional[str] = None
    referrer: Optional[str] = None
    landed_on: Optional[str] = None


# ─── Tracking (public, lightweight) ─────────────────────────────────────────

_rl60 = rate_limit(60, 60)   # 60 req/min per IP for all tracking endpoints


@router.post("/api/tracking/visitor")
async def track_visitor(req: VisitorCreate, _rl=Depends(_rl60)):
    """Create or return visitor by fingerprint."""
    if req.fingerprint_hash:
        existing = await db.query("visitors", params={
            "select": "id",
            "site_id": f"eq.{req.site_id}",
            "fingerprint_hash": f"eq.{req.fingerprint_hash}",
            "limit": "1",
        })
        if existing:
            from datetime import datetime, timezone
            await db.update("visitors", existing[0]["id"],
                            {"last_seen": datetime.now(timezone.utc).isoformat()})
            return {"id": existing[0]["id"], "existing": True}

    visitor = await db.insert("visitors", {
        "site_id": req.site_id,
        "fingerprint_hash": req.fingerprint_hash,
    })
    return {"id": visitor["id"] if visitor else None, "existing": False}


@router.post("/api/tracking/session")
async def track_session(req: SessionCreate, _rl=Depends(_rl60)):
    """Create a new session."""
    session = await db.insert("sessions", {
        "site_id": req.site_id,
        "visitor_id": req.visitor_id,
        "source": req.source,
        "medium": req.medium,
        "campaign": req.campaign,
        "content": req.content,
        "referrer": req.referrer,
        "landed_on": req.landed_on,
    })
    return {"id": session["id"] if session else None}


@router.post("/api/tracking/event")
async def track_event_new(body: dict, _rl=Depends(_rl60)):
    """Create a touchpoint. Public, lightweight."""
    required = {"site_id", "event_type"}
    if not required.issubset(body.keys()):
        raise HTTPException(400, f"Required fields: {required}")

    valid_types = ("page_view","cta_click","calculator_complete","quiz_complete",
                   "form_start","form_submit","email_capture")
    if body["event_type"] not in valid_types:
        raise HTTPException(400, f"event_type must be one of {valid_types}")

    tp = await db.insert("touchpoints", {
        "site_id": body.get("site_id"),
        "session_id": body.get("session_id"),
        "event_type": body["event_type"],
        "asset_id": body.get("asset_id"),
        "cta_id": body.get("cta_id"),
        "page_url": body.get("page_url"),
        "metadata_json": body.get("metadata", {}),
    })
    return {"id": tp["id"] if tp else None}


# ─── Legacy attribution endpoint ─────────────────────────────────────────────

@router.post("/api/attribution/event")
async def attribution_event(req: AttributionEvent):
    from packages.attribution import track_event
    return await track_event(
        event_type=req.event_type,
        visitor_id=req.visitor_id,
        session_id=req.session_id,
        asset_id=req.asset_id,
        asset_type=req.asset_type,
        channel=req.channel,
        utm_source=req.utm_source,
        utm_medium=req.utm_medium,
        utm_campaign=req.utm_campaign,
        metadata=req.metadata,
    )


@router.get("/api/attribution/funnel")
async def attribution_funnel(days: int = 30):
    from packages.attribution import get_funnel
    return await get_funnel(days)


@router.get("/api/attribution/report")
async def attribution_report(days: int = 30):
    from packages.attribution import get_attribution_report
    return await get_attribution_report(days)


# ─── Reports ─────────────────────────────────────────────────────────────────

@router.get("/api/reports/leads-by-asset")
async def leads_by_asset(site_id: Optional[str] = None, days: int = 30):
    from datetime import date, timedelta
    since = (date.today() - timedelta(days=days)).isoformat()
    params = {"select": "asset_id,current_status", "created_at": f"gte.{since}T00:00:00Z"}
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    leads = await db.query("leads", params=params)
    counts: dict = {}
    for l in leads:
        aid = l.get("asset_id") or "unknown"
        if aid not in counts:
            counts[aid] = {"asset_id": aid, "total": 0, "qualified": 0}
        counts[aid]["total"] += 1
        if l.get("current_status") in ("qualified","delivered","accepted"):
            counts[aid]["qualified"] += 1
    return sorted(counts.values(), key=lambda x: x["total"], reverse=True)


@router.get("/api/reports/leads-by-brand")
async def leads_by_brand(days: int = 30):
    from datetime import date, timedelta
    since = (date.today() - timedelta(days=days)).isoformat()
    leads = await db.query("leads", params={
        "select": "site_id,current_status",
        "created_at": f"gte.{since}T00:00:00Z",
    })
    counts: dict = {}
    for l in leads:
        sid = l.get("site_id") or "unknown"
        if sid not in counts:
            counts[sid] = {"site_id": sid, "total": 0, "qualified": 0}
        counts[sid]["total"] += 1
        if l.get("current_status") in ("qualified","delivered","accepted"):
            counts[sid]["qualified"] += 1
    return sorted(counts.values(), key=lambda x: x["total"], reverse=True)


@router.get("/api/reports/funnel")
async def funnel_report(site_id: Optional[str] = None, days: int = 30):
    try:
        from datetime import date, timedelta
        since = (date.today() - timedelta(days=days)).isoformat()

        visitors_q = {"select": "id", "created_at": f"gte.{since}T00:00:00Z"}
        sessions_q = {"select": "id", "started_at": f"gte.{since}T00:00:00Z"}
        leads_q = {"select": "id,current_status", "created_at": f"gte.{since}T00:00:00Z"}

        if site_id:
            visitors_q["site_id"] = f"eq.{site_id}"
            sessions_q["site_id"] = f"eq.{site_id}"
            leads_q["site_id"] = f"eq.{site_id}"

        visitors = await db.query("visitors", params=visitors_q)
        sessions = await db.query("sessions", params=sessions_q)
        leads = await db.query("leads", params=leads_q)

        qualified = sum(1 for l in leads if l.get("current_status") in ("qualified","delivered","accepted","closed"))
        accepted = sum(1 for l in leads if l.get("current_status") in ("accepted",))

        total_leads = len(leads)
        total_sessions = len(sessions)
        return {
            "period_days": days,
            "visitors": len(visitors),
            "sessions": total_sessions,
            "leads": total_leads,
            "qualified": qualified,
            "accepted": accepted,
            "lead_rate": round(total_leads / total_sessions * 100, 2) if total_sessions else 0,
            "qualify_rate": round(qualified / total_leads * 100, 2) if total_leads else 0,
        }
    except Exception as e:
        logger.error(f"funnel_report error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e), "period_days": days, "visitors": 0, "sessions": 0, "leads": 0, "qualified": 0, "accepted": 0, "lead_rate": 0, "qualify_rate": 0})


@router.get("/api/reports/revenue-by-asset")
async def revenue_by_asset(site_id: Optional[str] = None):
    outcomes = await db.query("lead_outcomes", params={
        "select": "lead_id,revenue_value,status",
        "status": "eq.accepted",
    })
    if not outcomes:
        return []
    lead_ids = [o["lead_id"] for o in outcomes]
    revenue_map = {o["lead_id"]: float(o.get("revenue_value") or 0) for o in outcomes}

    leads = await db.query("leads", params={"select": "id,asset_id,site_id"})
    lead_map = {l["id"]: l for l in leads}

    asset_rev: dict = {}
    for lead_id, rev in revenue_map.items():
        lead = lead_map.get(lead_id, {})
        if site_id and lead.get("site_id") != site_id:
            continue
        aid = lead.get("asset_id") or "unknown"
        asset_rev[aid] = asset_rev.get(aid, 0) + rev

    return [{"asset_id": k, "revenue": round(v, 2)}
            for k, v in sorted(asset_rev.items(), key=lambda x: x[1], reverse=True)]


@router.get("/api/reports/leads-by-cta")
async def leads_by_cta(site_id: Optional[str] = None, days: int = 30):
    from datetime import date, timedelta
    since = (date.today() - timedelta(days=days)).isoformat()
    params = {"select": "cta_variant,current_status", "created_at": f"gte.{since}T00:00:00Z"}
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    leads = await db.query("leads", params=params)
    counts: dict = {}
    for l in leads:
        cta = l.get("cta_variant") or "unknown"
        if cta not in counts:
            counts[cta] = {"cta_variant": cta, "total": 0, "qualified": 0}
        counts[cta]["total"] += 1
        if l.get("current_status") in ("qualified", "delivered", "accepted"):
            counts[cta]["qualified"] += 1
    return sorted(counts.values(), key=lambda x: x["total"], reverse=True)


@router.get("/api/channels/performance")
async def channel_performance(site_id: Optional[str] = None, days: int = 30):
    from datetime import date, timedelta
    since = (date.today() - timedelta(days=days)).isoformat()
    params = {"select": "*", "date": f"gte.{since}", "order": "date.desc", "limit": "200"}
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return await db.query("channel_performance", params=params)

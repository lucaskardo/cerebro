"""Lead capture, listing, lifecycle transitions, outcomes."""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from typing import Optional

from packages.core import db, create_alert, get_logger, SupabaseError
from packages.core.scoring import calculate_intent_score
from apps.api.app.middleware.auth import require_auth, audit
from apps.api.app.schemas.leads import LeadCapture, LeadTransition, LeadOutcomeCreate

logger = get_logger("router.leads")
router = APIRouter(tags=["Leads"])

# Valid lead state machine transitions
VALID_TRANSITIONS: dict[str, list[str]] = {
    "new":       ["confirmed", "nurturing", "qualified", "closed"],
    "confirmed": ["nurturing", "qualified", "closed"],
    "nurturing": ["qualified", "closed"],
    "qualified": ["delivered", "closed"],
    "delivered": ["accepted", "rejected", "closed"],
    "accepted":  ["closed"],
    "rejected":  ["closed"],
    "closed":    [],
}


@router.get("/api/leads")
async def list_leads(limit: int = 50, site_id: Optional[str] = None,
                     status: Optional[str] = None):
    try:
        params = {"select": "*", "order": "created_at.desc", "limit": str(limit)}
        if site_id:
            params["site_id"] = f"eq.{site_id}"
        if status:
            params["current_status"] = f"eq.{status}"
        return await db.query("leads", params=params)
    except Exception as e:
        logger.error(f"list_leads error: {e}")
        return []


@router.get("/api/leads/{lid}")
async def get_lead(lid: str):
    lead = await db.get_by_id("leads", lid)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@router.post("/api/leads/capture")
async def capture_lead(lead: LeadCapture, bg: BackgroundTasks, request: Request):
    """Public endpoint — no auth required."""
    mission_id = lead.mission_id
    if not mission_id:
        missions = await db.get("missions", status="eq.active", limit="1")
        mission_id = missions[0]["id"] if missions else None

    site_id = lead.site_id
    if not site_id and lead.origen_url:
        # Try to match site by domain
        for site in await db.get("domain_sites", status="eq.active"):
            if site["domain"] in (lead.origen_url or ""):
                site_id = site["id"]
                break

    # Dedupe: same email + site_id in last 24h
    if site_id:
        from datetime import datetime, timedelta, timezone
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        existing = await db.query("leads", params={
            "select": "id",
            "email": f"eq.{lead.email}",
            "site_id": f"eq.{site_id}",
            "created_at": f"gte.{since}",
            "limit": "1",
        })
        if existing:
            logger.info(f"Duplicate lead suppressed: {lead.email}")
            return {"status": "duplicate", "id": existing[0]["id"]}

    quiz = lead.quiz_responses or {}
    if lead.calculator_data:
        quiz["calculator"] = lead.calculator_data

    intent_score = calculate_intent_score({
        "cta_variant":    lead.cta_variant,
        "quiz_responses": quiz,
        "telefono":       lead.telefono,
        "nombre":         lead.nombre,
        "utm_source":     lead.utm_source,
    })

    try:
        result = await db.insert("leads", {
            "mission_id": mission_id,
            "site_id": site_id,
            "email": lead.email,
            "nombre": lead.nombre,
            "telefono": lead.telefono,
            "origen_url": lead.origen_url,
            "utm_source": lead.utm_source,
            "utm_medium": lead.utm_medium,
            "utm_content": lead.utm_content,
            "utm_campaign": lead.utm_campaign,
            "tema_interes": lead.tema_interes,
            "intent_score": intent_score,
            "quiz_responses": quiz,
            "visitor_id": lead.visitor_id,
            "session_id": lead.session_id,
            "asset_id": lead.asset_id,
            "cta_variant": lead.cta_variant,
            "current_status": "new",
        })
    except SupabaseError as e:
        logger.error(f"Lead capture DB error for {lead.email}: {e}")
        raise HTTPException(500, {"error": "Database error", "detail": "Could not save lead. Please retry."})

    if result:
        await create_alert(
            "new_lead",
            f"Nuevo lead: {lead.email} (score: {intent_score})",
            action_url="/leads",
        )
        bg.add_task(_send_lead_email, lead)

    return {"status": "captured", "id": result["id"] if result else None}


async def _send_lead_email(lead: LeadCapture):
    from packages.email import send_welcome_email, send_calculator_results_email
    try:
        calc = lead.calculator_data
        if calc and calc.get("monto_mensual"):
            await send_calculator_results_email(
                email=lead.email,
                nombre=lead.nombre,
                monto_mensual=float(calc.get("monto_mensual", 0)),
                metodo=calc.get("metodo", "método actual"),
                perdida_anual=float(calc.get("perdida_anual", 0)),
                ahorro_potencial=float(calc.get("ahorro_potencial", 0)),
            )
        else:
            await send_welcome_email(email=lead.email, nombre=lead.nombre, tema=lead.tema_interes)
    except Exception as e:
        logger.error(f"Email send failed for {lead.email}: {e}")


@router.post("/api/leads/{lid}/transition")
async def transition_lead(lid: str, body: LeadTransition,
                           request: Request, _auth=Depends(require_auth)):
    lead = await db.get_by_id("leads", lid)
    if not lead:
        raise HTTPException(404, "Lead not found")

    from_status = lead.get("current_status", "new")
    to_status = body.to_status
    allowed = VALID_TRANSITIONS.get(from_status, [])

    if to_status not in allowed:
        raise HTTPException(400, {
            "error": "Invalid transition",
            "detail": f"'{from_status}' → '{to_status}' not allowed. Allowed: {allowed}",
        })

    await db.update("leads", lid, {"current_status": to_status})
    await db.insert("lead_events", {
        "site_id": lead.get("site_id"),
        "lead_id": lid,
        "from_status": from_status,
        "to_status": to_status,
        "reason": body.reason,
        "triggered_by": body.triggered_by,
    })
    await audit(request, "lead_transition", "leads", lid,
                {"from": from_status, "to": to_status, "reason": body.reason})

    # Trigger partner delivery when a lead becomes qualified
    if to_status == "qualified" and lead.get("site_id"):
        await _enqueue_partner_deliveries(lid, lead["site_id"])

    return {"status": "ok", "from": from_status, "to": to_status}


async def _enqueue_partner_deliveries(lead_id: str, site_id: str):
    """Enqueue one delivery job per active webhook for the site."""
    from packages.jobs import enqueue
    try:
        webhooks = await db.query("partner_webhooks", params={
            "select": "id,url,secret",
            "site_id": f"eq.{site_id}",
            "active": "eq.true",
        })
        for wh in webhooks:
            await enqueue(
                type="partner_delivery",
                payload={
                    "lead_id": lead_id,
                    "site_id": site_id,
                    "webhook_id": wh["id"],
                    "webhook_url": wh["url"],
                    "webhook_secret": wh.get("secret", ""),
                },
                site_id=site_id,
                idempotency_key=f"partner_delivery:{lead_id}:{wh['id']}",
            )
        logger.info(f"Partner delivery jobs enqueued: lead={lead_id} webhooks={len(webhooks)}")
    except Exception as e:
        logger.error(f"Failed to enqueue partner deliveries for lead {lead_id}: {e}")


@router.get("/api/leads/{lid}/outcome")
async def get_lead_outcome(lid: str):
    results = await db.query("lead_outcomes", params={"select": "*", "lead_id": f"eq.{lid}"})
    if not results:
        raise HTTPException(404, "No outcome recorded")
    return results[0]


@router.post("/api/leads/{lid}/outcome")
async def set_lead_outcome(lid: str, body: LeadOutcomeCreate,
                            request: Request, _auth=Depends(require_auth)):
    lead = await db.get_by_id("leads", lid)
    if not lead:
        raise HTTPException(404, "Lead not found")

    from datetime import datetime, timezone
    existing = await db.query("lead_outcomes", params={"select": "id", "lead_id": f"eq.{lid}"})
    if existing:
        item = await db.update("lead_outcomes", existing[0]["id"], {
            "status": body.status,
            "revenue_value": body.revenue_value,
            "partner": body.partner,
            "reason": body.reason,
            "source": body.source,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        item = await db.insert("lead_outcomes", {
            "site_id": lead.get("site_id"),
            "lead_id": lid,
            "status": body.status,
            "revenue_value": body.revenue_value,
            "partner": body.partner,
            "reason": body.reason,
            "source": body.source,
        })

    await audit(request, "set_lead_outcome", "leads", lid,
                {"status": body.status, "revenue": body.revenue_value})
    return item

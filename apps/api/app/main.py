"""
CEREBRO v7 — FastAPI Backend
"""
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import date

# Add packages to path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

from packages.core import db, cost_tracker, config, get_logger, create_alert

logger = get_logger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CEREBRO API starting...")
    logger.info(f"Budget: ${config.DAILY_BUDGET}/day | Domain: {config.PRIMARY_DOMAIN}")
    logger.info(f"Flags: auto_publish={config.AUTO_PUBLISH} demand={config.DEMAND_ENGINE} autoloop={config.AUTOLOOP}")
    yield
    logger.info("CEREBRO API shutting down")


app = FastAPI(title="CEREBRO", version="7.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        f"https://{config.PRIMARY_DOMAIN}",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# MODELS
# ============================================
class ContentGenerate(BaseModel):
    mission_id: str
    keyword: str
    topic_type: str = "spoke"
    cluster_id: Optional[str] = None

class ContentApprove(BaseModel):
    action: str  # "approve" | "reject" | "edit"
    notes: Optional[str] = None

class LeadCapture(BaseModel):
    email: str
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    origen_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    tema_interes: Optional[str] = None
    intent_score: int = 0
    quiz_responses: dict = {}
    mission_id: Optional[str] = None
    # Calculator-specific fields
    calculator_data: Optional[dict] = None

class GoalCreate(BaseModel):
    description: str
    target_metric: str
    target_value: float
    mission_id: Optional[str] = None

class AttributionEvent(BaseModel):
    event_type: str  # pageview, click, form_start, lead_capture, conversion
    visitor_id: Optional[str] = None
    session_id: Optional[str] = None
    asset_id: Optional[str] = None
    asset_type: Optional[str] = None
    channel: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    metadata: dict = {}


# ============================================
# HEALTH & STATUS
# ============================================
@app.get("/health")
async def health():
    return {"status": "ok", "version": "7.0.0"}

@app.get("/api/status")
async def status():
    budget = await cost_tracker.check_budget()
    
    # Content counts
    assets = await db.get("content_assets", select="id,status")
    counts = {}
    for a in assets:
        s = a["status"]
        counts[s] = counts.get(s, 0) + 1
    
    # Leads today
    today = date.today().isoformat()
    leads = await db.query("leads", params={"select": "id", "created_at": f"gte.{today}T00:00:00Z"})
    
    return {
        "budget": budget,
        "content": counts,
        "leads_today": len(leads),
        "features": {
            "auto_publish": config.AUTO_PUBLISH,
            "demand_engine": config.DEMAND_ENGINE,
            "autoloop": config.AUTOLOOP,
            "social_engine": config.SOCIAL_ENGINE,
        },
    }


# ============================================
# MISSIONS
# ============================================
@app.get("/api/missions")
async def list_missions():
    return await db.get("missions", order="created_at.desc")

@app.get("/api/missions/{mid}")
async def get_mission(mid: str):
    m = await db.get_by_id("missions", mid)
    if not m:
        raise HTTPException(404, "Mission not found")
    return m


# ============================================
# CONTENT
# ============================================
@app.post("/api/content/generate")
async def generate_content(req: ContentGenerate, bg: BackgroundTasks):
    """Trigger content pipeline in background."""
    budget = await cost_tracker.check_budget()
    if budget["blocked"]:
        raise HTTPException(429, "Daily LLM budget exceeded")
    
    from packages.content.pipeline import _slugify
    asset = await db.insert("content_assets", {
        "mission_id": req.mission_id,
        "title": f"[GENERATING] {req.keyword}",
        "slug": _slugify(req.keyword),
        "keyword": req.keyword,
        "status": "generating",
    })
    
    bg.add_task(_run_pipeline_bg, req.keyword, req.mission_id, asset["id"])
    
    return {"asset_id": asset["id"], "status": "generating", "keyword": req.keyword}


async def _run_pipeline_bg(keyword: str, mission_id: str, asset_id: str):
    from packages.content.pipeline import run_pipeline
    try:
        await run_pipeline(keyword, mission_id, asset_id)
    except Exception as e:
        logger.error(f"Background pipeline failed: {e}")


@app.get("/api/content")
async def list_content(status: Optional[str] = None, limit: int = 50):
    params = {"select": "id,title,slug,keyword,status,quality_score,humanization_score,created_at,updated_at",
              "order": "created_at.desc", "limit": str(limit)}
    if status:
        params["status"] = f"eq.{status}"
    return await db.query("content_assets", params=params)

@app.get("/api/content/by-slug/{slug}")
async def get_content_by_slug(slug: str):
    # Public: serve approved; fallback to review for preview
    results = await db.query("content_assets", params={
        "select": "*", "slug": f"eq.{slug}",
        "status": "eq.approved"
    })
    if not results:
        results = await db.query("content_assets", params={
            "select": "*", "slug": f"eq.{slug}",
            "status": "in.(review,approved)"
        })
    if not results:
        raise HTTPException(404, "Article not found")
    return results[0]

@app.get("/api/content/{aid}")
async def get_content(aid: str):
    a = await db.get_by_id("content_assets", aid)
    if not a:
        raise HTTPException(404, "Content not found")
    return a

@app.post("/api/content/{aid}/review")
async def review_content(aid: str, action: ContentApprove):
    a = await db.get_by_id("content_assets", aid)
    if not a:
        raise HTTPException(404)
    
    if action.action == "approve":
        await db.update("content_assets", aid, {"status": "approved"})
        logger.info(f"Content approved: {a['title']}")
    elif action.action == "reject":
        await db.update("content_assets", aid, {"status": "draft"})
    
    return {"status": action.action}


# ============================================
# LEADS
# ============================================
@app.get("/api/leads")
async def list_leads(limit: int = 50):
    return await db.query("leads", params={
        "select": "*", "order": "created_at.desc", "limit": str(limit)
    })

@app.post("/api/leads/capture")
async def capture_lead(lead: LeadCapture, bg: BackgroundTasks):
    """Public endpoint for lead capture forms. Triggers welcome email."""
    mission_id = lead.mission_id
    if not mission_id:
        missions = await db.get("missions", status="eq.active", limit="1")
        mission_id = missions[0]["id"] if missions else None

    quiz = lead.quiz_responses or {}
    if lead.calculator_data:
        quiz["calculator"] = lead.calculator_data

    result = await db.insert("leads", {
        "mission_id": mission_id,
        "email": lead.email,
        "nombre": lead.nombre,
        "telefono": lead.telefono,
        "origen_url": lead.origen_url,
        "utm_source": lead.utm_source,
        "utm_medium": lead.utm_medium,
        "tema_interes": lead.tema_interes,
        "intent_score": lead.intent_score,
        "quiz_responses": quiz,
    })

    if result:
        await create_alert(
            "new_lead",
            f"Nuevo lead: {lead.email} (score: {lead.intent_score})",
            action_url="/dashboard/leads",
        )
        # Fire-and-forget email in background
        bg.add_task(_send_lead_email, lead)

    return {"status": "captured", "id": result["id"] if result else None}


async def _send_lead_email(lead: LeadCapture):
    """Send appropriate welcome email based on lead source."""
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
            await send_welcome_email(
                email=lead.email,
                nombre=lead.nombre,
                tema=lead.tema_interes,
            )
    except Exception as e:
        logger.error(f"Email send failed for {lead.email}: {e}")


# ============================================
# ALERTS
# ============================================
@app.get("/api/alerts")
async def list_alerts():
    return await db.query("operator_alerts", params={
        "select": "*", "dismissed": "eq.false", "order": "created_at.desc", "limit": "20"
    })

@app.post("/api/alerts/{aid}/dismiss")
async def dismiss_alert(aid: str):
    await db.update("operator_alerts", aid, {"dismissed": True})
    return {"status": "dismissed"}


# ============================================
# BUDGET
# ============================================
@app.get("/api/budget")
async def get_budget():
    return await cost_tracker.check_budget()

@app.get("/api/budget/history")
async def budget_history(days: int = 7):
    """Cost history for the last N days."""
    results = await db.query("daily_cost_summary", params={
        "select": "*", "limit": str(days), "order": "date.desc"
    })
    return results


# ============================================
# CLUSTERS
# ============================================
@app.get("/api/clusters")
async def list_clusters():
    return await db.get("clusters", order="created_at.desc")


# ============================================
# DEMAND SIGNALS  
# ============================================
@app.get("/api/demand")
async def list_demand_signals(processed: Optional[bool] = None):
    params = {"select": "*", "order": "detected_at.desc", "limit": "30"}
    if processed is not None:
        params["processed"] = f"eq.{str(processed).lower()}"
    return await db.query("demand_signals", params=params)


@app.get("/api/sitemap")
async def sitemap():
    """Public article list for sitemap generation."""
    results = await db.query("content_assets", params={
        "select": "slug,updated_at",
        "status": "in.(approved,review)",
        "asset_type": "eq.article",
        "order": "updated_at.desc",
    })
    return results


# ============================================
# GOALS
# ============================================
@app.post("/api/goals")
async def create_goal(req: GoalCreate):
    mission_id = req.mission_id
    if not mission_id:
        missions = await db.get("missions", status="eq.active", limit="1")
        mission_id = missions[0]["id"] if missions else None
    goal = await db.insert("goals", {
        "mission_id": mission_id,
        "description": req.description,
        "target_metric": req.target_metric,
        "target_value": req.target_value,
        "status": "active",
    })
    return goal

@app.get("/api/goals")
async def list_goals():
    return await db.query("goals", params={"select": "*", "order": "created_at.desc"})


# ============================================
# STRATEGIES
# ============================================
@app.post("/api/strategies/generate")
async def generate_strategies_endpoint(goal_id: str):
    budget = await cost_tracker.check_budget()
    if budget["blocked"]:
        raise HTTPException(429, "Daily LLM budget exceeded")
    from packages.strategy import generate_strategies
    return await generate_strategies(goal_id)

@app.get("/api/strategies")
async def list_strategies(goal_id: Optional[str] = None, status: Optional[str] = None):
    params = {"select": "*", "order": "created_at.desc"}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    if status:
        params["status"] = f"eq.{status}"
    return await db.query("strategies", params=params)

@app.post("/api/strategies/{sid}/approve")
async def approve_strategy_endpoint(sid: str):
    from packages.strategy import approve_strategy
    s = await approve_strategy(sid)
    if not s:
        raise HTTPException(404, "Strategy not found")
    return s

@app.post("/api/strategies/{sid}/run")
async def run_strategy(sid: str, bg: BackgroundTasks):
    from packages.strategy import execute_strategy
    bg.add_task(execute_strategy, sid)
    return {"status": "running", "strategy_id": sid}


# ============================================
# ATTRIBUTION
# ============================================
@app.post("/api/attribution/event")
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

@app.get("/api/attribution/funnel")
async def attribution_funnel(days: int = 30):
    from packages.attribution import get_funnel
    return await get_funnel(days)

@app.get("/api/attribution/report")
async def attribution_report(days: int = 30):
    from packages.attribution import get_attribution_report
    return await get_attribution_report(days)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

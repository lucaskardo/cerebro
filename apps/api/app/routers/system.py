"""System, health, budget, alerts, missions, sites, clusters, demand."""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional
from datetime import date, timedelta, timezone, datetime

from packages.core import db, cost_tracker, config, create_alert, get_logger
from apps.api.app.middleware.auth import require_auth, audit

logger = get_logger("router.system")
router = APIRouter()


# ─── Health ──────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok", "version": "7.0.0"}


@router.get("/api/status")
async def status():
    budget = await cost_tracker.check_budget()
    assets = await db.get("content_assets", select="id,status")
    counts: dict = {}
    for a in assets:
        s = a["status"]
        counts[s] = counts.get(s, 0) + 1
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


@router.get("/api/health/business")
async def business_health():
    """Key business metrics — no auth required."""
    today = date.today().isoformat()
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    day_ago = (date.today() - timedelta(days=1)).isoformat()

    from asyncio import gather
    (
        leads_today, leads_week, qualified_week, articles_week,
        jobs_total, knowledge_week, last_cycle_rows,
        worst_exp_rows, budget,
    ) = await gather(
        db.query("leads", params={"select": "id", "created_at": f"gte.{today}T00:00:00Z"}),
        db.query("leads", params={"select": "id", "created_at": f"gte.{week_ago}T00:00:00Z"}),
        db.query("leads", params={"select": "id", "current_status": "eq.qualified",
                                   "created_at": f"gte.{week_ago}T00:00:00Z"}),
        db.query("content_assets", params={"select": "id,title", "status": "eq.approved",
                                            "updated_at": f"gte.{week_ago}T00:00:00Z"}),
        db.query("jobs", params={"select": "id,status", "created_at": f"gte.{day_ago}T00:00:00Z"}),
        db.query("knowledge_entries", params={"select": "id", "created_at": f"gte.{week_ago}T00:00:00Z"}),
        db.query("cycle_runs", params={"select": "*", "order": "created_at.desc", "limit": "1"}),
        db.query("experiments", params={"select": "id,hypothesis,outcome_json",
                                         "status": "eq.evaluated",
                                         "order": "evaluated_at.desc", "limit": "10"}),
        cost_tracker.check_budget(),
    )

    # Error rate (last 24h)
    failed = sum(1 for j in jobs_total if j.get("status") in ("failed", "dead_lettered"))
    total_jobs = len(jobs_total)
    error_rate = round(failed / total_jobs * 100, 1) if total_jobs > 0 else 0.0

    # Revenue last 7 days from fact table
    revenue_rows = await db.query("fact_daily_channel_performance", params={
        "select": "revenue", "date": f"gte.{week_ago}",
    })
    revenue_7d = sum(float(r.get("revenue") or 0) for r in revenue_rows)

    # Conversion rate 7d: qualified / total leads
    total_leads_w = len(leads_week)
    qualified_w = len(qualified_week)
    conversion_rate_7d = round(qualified_w / total_leads_w * 100, 1) if total_leads_w > 0 else 0.0

    # Worst experiment this week
    worst_exp = None
    for exp in worst_exp_rows:
        outcome = exp.get("outcome_json") or {}
        if isinstance(outcome, str):
            try:
                import json as _j; outcome = _j.loads(outcome)
            except Exception:
                outcome = {}
        if outcome.get("decision") == "kill":
            worst_exp = exp.get("hypothesis", "")[:80]
            break

    # Top opportunity
    top_opp_rows = await db.query("opportunities", params={
        "select": "query,pain_point,expected_value,confidence",
        "execution_status": "eq.detected",
        "order": "expected_value.desc",
        "limit": "1",
    })
    top_opp = (top_opp_rows[0].get("query") or top_opp_rows[0].get("pain_point")) if top_opp_rows else None

    last_cycle = last_cycle_rows[0] if last_cycle_rows else None

    return {
        "leads_today": len(leads_today),
        "leads_this_week": len(leads_week),
        "qualified_leads_week": qualified_w,
        "conversion_rate_7d": conversion_rate_7d,
        "articles_published_week": len(articles_week),
        "error_rate_24h": error_rate,
        "cost_today": budget["spent"],
        "revenue_7d": revenue_7d,
        "top_performing_asset_title": articles_week[0]["title"] if articles_week else None,
        "top_opportunity": top_opp,
        "worst_experiment": worst_exp,
        "knowledge_entries_this_week": len(knowledge_week),
        "budget_remaining": budget["remaining"],
        "budget_warning": budget["warning"],
        "last_cycle_at": last_cycle["created_at"] if last_cycle else None,
        "last_cycle_status": last_cycle["status"] if last_cycle else None,
    }


# ─── Budget ──────────────────────────────────────────────────────────────────

@router.get("/api/budget")
async def get_budget():
    return await cost_tracker.check_budget()


@router.get("/api/budget/history")
async def budget_history(days: int = 7):
    return await db.query("daily_cost_summary", params={
        "select": "*", "limit": str(days), "order": "date.desc"
    })


# ─── Alerts ──────────────────────────────────────────────────────────────────

@router.get("/api/alerts")
async def list_alerts():
    return await db.query("operator_alerts", params={
        "select": "*", "dismissed": "eq.false",
        "order": "created_at.desc", "limit": "20"
    })


@router.post("/api/alerts/{aid}/dismiss")
async def dismiss_alert(aid: str, request: Request, _auth=Depends(require_auth)):
    await db.update("operator_alerts", aid, {"dismissed": True})
    await audit(request, "dismiss_alert", "operator_alerts", aid)
    return {"status": "dismissed"}


# ─── Missions ────────────────────────────────────────────────────────────────

@router.get("/api/missions")
async def list_missions():
    return await db.get("missions", order="created_at.desc")


@router.get("/api/missions/{mid}")
async def get_mission(mid: str):
    m = await db.get_by_id("missions", mid)
    if not m:
        raise HTTPException(404, "Mission not found")
    return m


# ─── Sites ───────────────────────────────────────────────────────────────────

@router.get("/api/sites")
async def list_sites():
    return await db.query("domain_sites", params={
        "select": "*", "status": "eq.active", "order": "created_at.asc"
    })


@router.get("/api/sites/{sid}")
async def get_site(sid: str):
    s = await db.get_by_id("domain_sites", sid)
    if not s:
        raise HTTPException(404, "Site not found")
    return s


# ─── Clusters ────────────────────────────────────────────────────────────────

@router.get("/api/clusters")
async def list_clusters():
    return await db.get("clusters", order="created_at.desc")


# ─── Demand signals ──────────────────────────────────────────────────────────

@router.get("/api/demand")
async def list_demand_signals(processed: Optional[bool] = None):
    params = {"select": "*", "order": "detected_at.desc", "limit": "30"}
    if processed is not None:
        params["processed"] = f"eq.{str(processed).lower()}"
    return await db.query("demand_signals", params=params)


# ─── Sitemap ─────────────────────────────────────────────────────────────────

@router.get("/api/sitemap")
async def sitemap():
    return await db.query("content_assets", params={
        "select": "slug,updated_at",
        "status": "in.(approved,review)",
        "asset_type": "eq.article",
        "order": "updated_at.desc",
    })


# ─── Feature flags ───────────────────────────────────────────────────────────

@router.get("/api/flags")
async def list_flags(site_id: Optional[str] = None):
    params = {"select": "*", "order": "flag_name.asc"}
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return await db.query("feature_flags", params=params)


@router.patch("/api/flags/{fid}")
async def update_flag(fid: str, body: dict, request: Request, _auth=Depends(require_auth)):
    item = await db.update("feature_flags", fid, {"enabled": body.get("enabled", False)})
    if not item:
        raise HTTPException(404, "Flag not found")
    await audit(request, "update_flag", "feature_flags", fid, body)
    return item


# Approvals endpoints live in execution.py (canonical location)

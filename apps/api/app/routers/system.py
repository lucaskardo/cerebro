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

    leads_today = await db.query("leads", params={
        "select": "id", "created_at": f"gte.{today}T00:00:00Z"
    })
    leads_week = await db.query("leads", params={
        "select": "id", "created_at": f"gte.{week_ago}T00:00:00Z"
    })
    articles_week = await db.query("content_assets", params={
        "select": "id,title",
        "status": "eq.approved",
        "updated_at": f"gte.{week_ago}T00:00:00Z",
    })
    budget = await cost_tracker.check_budget()

    # Jobs error rate (last 24h)
    day_ago = (date.today() - timedelta(days=1)).isoformat()
    jobs_total = await db.query("jobs", params={
        "select": "id,status",
        "created_at": f"gte.{day_ago}T00:00:00Z",
    })
    failed = sum(1 for j in jobs_total if j.get("status") == "failed")
    total = len(jobs_total)
    error_rate = round(failed / total * 100, 1) if total > 0 else 0.0

    top_asset = articles_week[0]["title"] if articles_week else None

    return {
        "leads_today": len(leads_today),
        "leads_this_week": len(leads_week),
        "articles_published_week": len(articles_week),
        "error_rate_24h": error_rate,
        "cost_today": budget["spent"],
        "top_performing_asset_title": top_asset,
        "budget_remaining": budget["remaining"],
        "budget_warning": budget["warning"],
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


# ─── Approvals ───────────────────────────────────────────────────────────────

@router.get("/api/approvals")
async def list_approvals(status: Optional[str] = "pending", site_id: Optional[str] = None):
    params = {"select": "*", "order": "created_at.desc", "limit": "50"}
    if status:
        params["status"] = f"eq.{status}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return await db.query("approvals", params=params)


@router.post("/api/approvals/{aid}/resolve")
async def resolve_approval(aid: str, body: dict, request: Request, _auth=Depends(require_auth)):
    action = body.get("action")  # "approved" | "rejected"
    if action not in ("approved", "rejected"):
        raise HTTPException(400, "action must be 'approved' or 'rejected'")
    from datetime import datetime
    item = await db.update("approvals", aid, {
        "status": action,
        "notes": body.get("notes"),
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    })
    if not item:
        raise HTTPException(404, "Approval not found")
    await audit(request, f"approval_{action}", "approvals", aid, body)
    return item

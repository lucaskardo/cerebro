"""Goals, strategies, knowledge."""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from typing import Optional

from packages.core import db, cost_tracker, get_logger
from apps.api.app.middleware.auth import require_auth, audit
from apps.api.app.schemas.strategy import GoalCreate

logger = get_logger("router.strategy")
router = APIRouter(tags=["Strategy"])


@router.post("/api/goals")
async def create_goal(req: GoalCreate, request: Request, _auth=Depends(require_auth)):
    mission_id = req.mission_id
    if not mission_id:
        missions = await db.get("missions", status="eq.active", limit="1")
        mission_id = missions[0]["id"] if missions else None

    goal = await db.insert("goals", {
        "mission_id": mission_id,
        "site_id": req.site_id,
        "description": req.description,
        "target_metric": req.target_metric,
        "target_value": req.target_value,
        "status": "active",
    })
    if not goal:
        raise HTTPException(500, "Failed to create goal")
    await audit(request, "create_goal", "goals", goal["id"], {"description": req.description})
    return goal


@router.get("/api/goals")
async def list_goals(site_id: Optional[str] = None):
    params = {"select": "*", "order": "created_at.desc"}
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return await db.query("goals", params=params)


@router.post("/api/strategies/generate")
async def generate_strategies_endpoint(goal_id: str, request: Request,
                                        _auth=Depends(require_auth)):
    budget = await cost_tracker.check_budget()
    if budget["blocked"]:
        raise HTTPException(429, "Daily LLM budget exceeded")
    from packages.strategy import generate_strategies
    result = await generate_strategies(goal_id)
    await audit(request, "generate_strategies", "goals", goal_id)
    return result


@router.get("/api/strategies")
async def list_strategies(goal_id: Optional[str] = None, status: Optional[str] = None,
                           site_id: Optional[str] = None):
    params = {"select": "*", "order": "created_at.desc"}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    if status:
        params["status"] = f"eq.{status}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return await db.query("strategies", params=params)


@router.post("/api/strategies/{sid}/approve")
async def approve_strategy_endpoint(sid: str, request: Request, _auth=Depends(require_auth)):
    from packages.strategy import approve_strategy
    s = await approve_strategy(sid)
    if not s:
        raise HTTPException(404, "Strategy not found")
    await audit(request, "approve_strategy", "strategies", sid)
    return s


@router.post("/api/strategies/{sid}/run")
async def run_strategy(sid: str, bg: BackgroundTasks, request: Request,
                        _auth=Depends(require_auth)):
    from packages.strategy import execute_strategy
    bg.add_task(execute_strategy, sid)
    await audit(request, "run_strategy", "strategies", sid)
    return {"status": "running", "strategy_id": sid}


@router.get("/api/knowledge")
async def list_knowledge(site_id: Optional[str] = None, category: Optional[str] = None,
                          confidence: Optional[str] = None):
    params = {"select": "*", "order": "created_at.desc", "limit": "50"}
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    if category:
        params["category"] = f"eq.{category}"
    if confidence:
        params["confidence"] = f"eq.{confidence}"
    return await db.query("knowledge_entries", params=params)


@router.post("/api/knowledge")
async def create_knowledge(body: dict, request: Request, _auth=Depends(require_auth)):
    item = await db.insert("knowledge_entries", body)
    if not item:
        raise HTTPException(500, "Failed to insert knowledge entry")
    await audit(request, "create_knowledge", "knowledge_entries", item["id"],
                {"category": body.get("category")})
    return item


@router.get("/api/knowledge/insights")
async def top_insights(site_id: Optional[str] = None, limit: int = 10):
    try:
        params = {
            "select": "*", "confidence": "gte.0.7",
            "order": "confidence.desc", "limit": str(limit),
        }
        if site_id:
            params["site_id"] = f"eq.{site_id}"
        return await db.query("knowledge_entries", params=params)
    except Exception as e:
        logger.error(f"top_insights error: {e}")
        return []

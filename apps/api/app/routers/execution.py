"""Execution engine: opportunities, experiments, tasks, approvals."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse
from typing import Optional

from packages.core import db, get_logger
from apps.api.app.middleware.auth import require_auth, audit
from apps.api.app.schemas.execution import (
    OpportunityCreate, ExperimentCreate, TaskCreate, ApprovalResolve
)

logger = get_logger("router.execution")
router = APIRouter(tags=["Execution"])


# ─── Opportunities ────────────────────────────────────────────────────────────

@router.post("/api/opportunities")
async def create_opportunity(req: OpportunityCreate, request: Request, _auth=Depends(require_auth)):
    opp = await db.insert("opportunities", {
        "goal_id": req.goal_id,
        "site_id": req.site_id,
        "title": req.query,
        "keyword": req.query,
        "query": req.query,
        "pain_point": req.pain_point,
        "audience": req.audience,
        "channel": req.channel,
        "intent": req.intent,
        "expected_value": req.expected_value,
        "confidence": req.confidence,
        "execution_status": "detected",
        "status": "backlog",
    })
    if not opp:
        raise HTTPException(500, "Failed to create opportunity")
    await audit(request, "create_opportunity", "opportunities", opp["id"],
                {"query": req.query, "goal_id": req.goal_id})
    return opp


@router.get("/api/opportunities")
async def list_opportunities(
    goal_id: Optional[str] = None,
    site_id: Optional[str] = None,
    execution_status: Optional[str] = None,
):
    params = {"select": "*", "order": "created_at.desc", "limit": "100"}
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    if execution_status:
        params["execution_status"] = f"eq.{execution_status}"
    return await db.query("opportunities", params=params)


@router.get("/api/opportunities/{oid}")
async def get_opportunity(oid: str):
    opp = await db.get_by_id("opportunities", oid)
    if not opp:
        raise HTTPException(404, "Opportunity not found")
    return opp


@router.patch("/api/opportunities/{oid}/status")
async def update_opportunity_status(
    oid: str, body: dict, request: Request, _auth=Depends(require_auth)
):
    valid = ("detected", "evaluated", "planned", "executing", "measured")
    new_status = body.get("execution_status")
    if new_status not in valid:
        raise HTTPException(400, f"execution_status must be one of {valid}")
    updated = await db.update("opportunities", oid, {"execution_status": new_status})
    await audit(request, "update_opportunity_status", "opportunities", oid, {"execution_status": new_status})
    return updated


@router.post("/api/opportunities/plan")
async def plan_opportunities_endpoint(
    goal_id: str, site_id: Optional[str] = None,
    request: Request = None, _auth=Depends(require_auth),
):
    from packages.ai import BudgetExceededError
    from packages.strategy import plan_opportunities
    try:
        results = await plan_opportunities(goal_id, site_id=site_id)
        if request:
            await audit(request, "plan_opportunities", "goals", goal_id, {"count": len(results)})
        return results
    except BudgetExceededError:
        raise HTTPException(429, "Daily LLM budget exceeded")


# ─── Experiments ──────────────────────────────────────────────────────────────

@router.post("/api/experiments")
async def create_experiment(req: ExperimentCreate, request: Request, _auth=Depends(require_auth)):
    exp = await db.insert("experiments", {
        "site_id": req.site_id,
        "opportunity_id": req.opportunity_id,
        "hypothesis": req.hypothesis,
        "target_metric": req.target_metric,
        "variant_a_json": req.variant_a_json,
        "variant_b_json": req.variant_b_json,
        "run_window_days": req.run_window_days,
        "status": "planned",
    })
    if not exp:
        raise HTTPException(500, "Failed to create experiment")
    await audit(request, "create_experiment", "experiments", exp["id"],
                {"hypothesis": req.hypothesis})
    return exp


@router.get("/api/experiments")
async def list_experiments(
    site_id: Optional[str] = None,
    status: Optional[str] = None,
    opportunity_id: Optional[str] = None,
):
    try:
        params = {"select": "*", "order": "started_at.desc", "limit": "50"}
        if site_id:
            params["site_id"] = f"eq.{site_id}"
        if status:
            params["status"] = f"eq.{status}"
        if opportunity_id:
            params["opportunity_id"] = f"eq.{opportunity_id}"
        return await db.query("experiments", params=params)
    except Exception as e:
        logger.error(f"list_experiments error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e), "data": []})


@router.get("/api/experiments/{eid}")
async def get_experiment(eid: str):
    exp = await db.get_by_id("experiments", eid)
    if not exp:
        raise HTTPException(404, "Experiment not found")
    return exp


@router.post("/api/experiments/{eid}/evaluate")
async def evaluate_experiment_endpoint(eid: str, request: Request, _auth=Depends(require_auth)):
    from packages.strategy.evaluator import evaluate_experiment
    result = await evaluate_experiment(eid)
    await audit(request, "evaluate_experiment", "experiments", eid,
                {"decision": result.get("decision")})
    return result


@router.patch("/api/experiments/{eid}")
async def update_experiment(eid: str, body: dict, request: Request, _auth=Depends(require_auth)):
    exp = await db.get_by_id("experiments", eid)
    if not exp:
        raise HTTPException(404, "Experiment not found")
    allowed = {"status", "visits_a", "visits_b", "metric_baseline", "metric_variant",
                "winner", "learnings", "started_at", "completed_at"}
    update_data = {k: v for k, v in body.items() if k in allowed}
    if not update_data:
        raise HTTPException(400, f"No valid fields to update. Allowed: {allowed}")
    updated = await db.update("experiments", eid, update_data)
    await audit(request, "update_experiment", "experiments", eid, update_data)
    return updated


# ─── Tasks ────────────────────────────────────────────────────────────────────

@router.post("/api/tasks")
async def create_task(req: TaskCreate, request: Request, _auth=Depends(require_auth)):
    from packages.skills import get_skill
    skill = get_skill(req.skill_name)
    if not skill:
        raise HTTPException(400, f"Unknown skill: {req.skill_name}")

    task = await db.insert("tasks", {
        "experiment_id": req.experiment_id,
        "site_id": req.site_id,
        "skill_name": req.skill_name,
        "input_json": req.input_json,
        "depends_on": req.depends_on,
        "idempotency_key": req.idempotency_key,
        "estimated_cost": req.estimated_cost,
        "status": "pending",
    })
    if not task:
        raise HTTPException(500, "Failed to create task")
    await audit(request, "create_task", "tasks", task["id"], {"skill": req.skill_name})
    return task


@router.get("/api/tasks")
async def list_tasks(
    site_id: Optional[str] = None,
    experiment_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
):
    params = {"select": "*", "order": "created_at.desc", "limit": str(limit)}
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    if experiment_id:
        params["experiment_id"] = f"eq.{experiment_id}"
    if status:
        params["status"] = f"eq.{status}"
    return await db.query("tasks", params=params)


@router.get("/api/tasks/{tid}")
async def get_task(tid: str):
    task = await db.get_by_id("tasks", tid)
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@router.post("/api/tasks/{tid}/run")
async def run_task(tid: str, bg: BackgroundTasks, request: Request, _auth=Depends(require_auth)):
    task = await db.get_by_id("tasks", tid)
    if not task:
        raise HTTPException(404, "Task not found")
    if task["status"] not in ("pending", "failed", "retrying"):
        raise HTTPException(400, f"Task status is {task['status']}, cannot run")
    bg.add_task(_execute_task, tid)
    await audit(request, "run_task", "tasks", tid, {"skill": task["skill_name"]})
    return {"status": "queued", "task_id": tid}


async def _execute_task(task_id: str):
    """Background task executor with dependency check + retry + approval gating."""
    from packages.skills import get_skill

    task = await db.get_by_id("tasks", task_id)
    if not task:
        return

    # Dependency check
    if task.get("depends_on"):
        dep = await db.get_by_id("tasks", task["depends_on"])
        if not dep or dep["status"] != "completed":
            logger.info(f"Task {task_id[:8]} waiting for dependency {task['depends_on'][:8]}")
            return

    skill = get_skill(task["skill_name"])
    if not skill:
        await db.update("tasks", task_id, {
            "status": "failed",
            "error": f"Unknown skill: {task['skill_name']}",
        })
        return

    # Approval policy gate
    if skill.approval_policy == "requires_approval":
        existing = await db.query("approvals", params={
            "select": "id,status",
            "entity_type": "eq.task",
            "entity_id": f"eq.{task_id}",
            "status": "eq.pending",
            "limit": "1",
        })
        if not existing:
            await db.insert("approvals", {
                "site_id": task.get("site_id"),
                "entity_type": "task",
                "entity_id": task_id,
                "action": f"execute_{task['skill_name']}",
                "requested_by": "system",
                "status": "pending",
            })
            logger.info(f"Task {task_id[:8]} queued for approval ({task['skill_name']})")
        return

    # Execute
    attempts = (task.get("attempts") or 0) + 1
    await db.update("tasks", task_id, {
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "attempts": attempts,
    })

    try:
        result = await skill.run_with_tracking(
            task.get("input_json") or {},
            task_id=task_id,
            site_id=task.get("site_id"),
        )
        await db.update("tasks", task_id, {
            "status": "completed",
            "output_json": result,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Task {task_id[:8]} completed ({task['skill_name']})")
    except Exception as e:
        max_attempts = skill.retry_policy.get("max_attempts", 3)
        new_status = "retrying" if attempts < max_attempts else "dead_lettered"
        await db.update("tasks", task_id, {
            "status": new_status,
            "error": str(e)[:500],
        })
        logger.error(f"Task {task_id[:8]} failed (attempt {attempts}/{max_attempts}): {e}")


# ─── Approvals ────────────────────────────────────────────────────────────────

@router.get("/api/approvals")
async def list_approvals(
    status: Optional[str] = "pending",
    site_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 50,
):
    try:
        params = {"select": "*", "order": "created_at.asc", "limit": str(limit)}
        if status:
            params["status"] = f"eq.{status}"
        if site_id:
            params["site_id"] = f"eq.{site_id}"
        if entity_type:
            params["entity_type"] = f"eq.{entity_type}"
        return await db.query("approvals", params=params)
    except Exception as e:
        logger.error(f"list_approvals error: {e}")
        return []


@router.post("/api/approvals/{aid}/resolve")
async def resolve_approval(
    aid: str, body: ApprovalResolve, request: Request, _auth=Depends(require_auth)
):
    approval = await db.get_by_id("approvals", aid)
    if not approval:
        raise HTTPException(404, "Approval not found")
    if approval["status"] != "pending":
        raise HTTPException(400, f"Approval already {approval['status']}")
    if body.action not in ("approve", "reject"):
        raise HTTPException(400, "action must be 'approve' or 'reject'")

    new_status = "approved" if body.action == "approve" else "rejected"
    updated = await db.update("approvals", aid, {
        "status": new_status,
        "approved_by": "operator",
        "notes": body.notes,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    })
    await audit(request, f"approval_{body.action}", "approvals", aid,
                {"entity_type": approval.get("entity_type"), "entity_id": str(approval.get("entity_id"))})

    # If approved, execute associated entity
    if body.action == "approve":
        entity_type = approval.get("entity_type")
        entity_id = str(approval.get("entity_id") or "")
        if entity_type == "task" and entity_id:
            from fastapi.concurrency import run_in_threadpool
            import asyncio
            asyncio.create_task(_execute_task(entity_id))

    return updated

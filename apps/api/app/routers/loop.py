"""Loop router — manual trigger and cycle history."""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from typing import Optional

from packages.core import db, config, get_logger
from apps.api.app.middleware.auth import require_auth, audit
from apps.api.app.schemas.loop import LoopRunRequest

logger = get_logger("router.loop")
router = APIRouter()


@router.post("/api/loop/run")
async def trigger_loop(req: LoopRunRequest, bg: BackgroundTasks,
                       request: Request, _auth=Depends(require_auth)):
    """Manually trigger one loop cycle for a goal."""
    goal = await db.get_by_id("goals", req.goal_id)
    if not goal:
        raise HTTPException(404, "Goal not found")

    if req.dry_run:
        # Just validate kill switches without running
        from packages.loop import _check_kill_switches
        should_kill, reason = await _check_kill_switches(req.goal_id, None)
        return {
            "dry_run": True,
            "would_run": not should_kill,
            "kill_reason": reason if should_kill else None,
        }

    bg.add_task(_run_cycle_bg, req.goal_id)
    await audit(request, "loop_trigger", "goals", req.goal_id, {"goal_id": req.goal_id})
    return {"status": "started", "goal_id": req.goal_id, "message": "Cycle running in background"}


async def _run_cycle_bg(goal_id: str):
    from packages.loop import run_cycle
    try:
        result = await run_cycle(goal_id)
        logger.info(f"Background cycle completed: {result}")
    except Exception as e:
        logger.error(f"Background cycle failed for goal {goal_id}: {e}")


@router.get("/api/loop/history")
async def cycle_history(goal_id: Optional[str] = None, limit: int = 20):
    params: dict = {
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if goal_id:
        params["goal_id"] = f"eq.{goal_id}"
    return await db.query("cycle_runs", params=params)


@router.get("/api/loop/status")
async def loop_status():
    """Current loop health: last cycle, feature flag state, kill switch preview."""
    from packages.core import config as cfg

    last_cycles = await db.query("cycle_runs", params={
        "select": "*", "order": "created_at.desc", "limit": "5"
    })

    return {
        "scheduler_enabled": getattr(cfg, "LOOP_SCHEDULER_ENABLED", False),
        "last_cycle": last_cycles[0] if last_cycles else None,
        "recent_cycles": last_cycles,
    }

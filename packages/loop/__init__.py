"""
CEREBRO — Supervised Loop (Bloque 6)
run_cycle(goal_id): plan → score → experiment → auto-run safe tasks → queue approvals
Kill switches: budget > $30, error rate > 30% in 1h, 3 consecutive bad experiments.
"""
import json
from datetime import datetime, timezone, timedelta
from packages.core import db, cost_tracker, create_alert, get_logger

logger = get_logger("loop")

# ─── Heuristic simulator ─────────────────────────────────────────────────────

def _score_opportunity(opp: dict, facts: list[dict]) -> float:
    """
    Score 0-100 based on historical facts and opportunity attributes.
    Pure heuristic — no LLM, fast and deterministic.
    """
    score = 0.0

    # Base from confidence
    conf_map = {"high": 40, "medium": 25, "low": 10}
    score += conf_map.get(opp.get("confidence", "low"), 10)

    # Boost from channel historical performance
    channel = opp.get("channel", "")
    channel_facts = [f for f in facts if f.get("channel") == channel]
    if channel_facts:
        avg_leads = sum(f.get("leads", 0) for f in channel_facts) / len(channel_facts)
        if avg_leads >= 10:
            score += 30
        elif avg_leads >= 3:
            score += 15
        elif avg_leads >= 1:
            score += 5

    # Boost from expected_value
    ev = float(opp.get("expected_value") or 0)
    if ev >= 50:
        score += 20
    elif ev >= 20:
        score += 12
    elif ev >= 5:
        score += 6

    # Boost for decision-stage intent
    intent_map = {"decision": 10, "consideration": 5, "awareness": 0}
    score += intent_map.get(opp.get("intent", "awareness"), 0)

    return min(score, 100.0)


# ─── Kill switch checks ───────────────────────────────────────────────────────

async def _check_kill_switches(goal_id: str, site_id: str | None) -> tuple[bool, str]:
    """
    Returns (should_kill, reason).
    Checks: budget, error rate, consecutive bad experiments.
    """
    # 1. Budget guard
    budget = await cost_tracker.check_budget()
    if budget.get("blocked"):
        return True, f"Daily LLM budget exceeded (${budget.get('spent', 0):.2f}/${budget.get('limit', 30):.2f})"

    # 2. Error rate > 30% in last hour
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    recent_jobs = await db.query("jobs", params={
        "select": "id,status",
        "created_at": f"gte.{one_hour_ago}",
        "order": "created_at.desc",
        "limit": "100",
    })
    if len(recent_jobs) >= 5:
        failed = sum(1 for j in recent_jobs if j.get("status") in ("failed", "dead_lettered"))
        error_rate = failed / len(recent_jobs)
        if error_rate > 0.30:
            return True, f"Error rate {error_rate*100:.0f}% in last hour exceeds 30% threshold"

    # 3. Three consecutive experiments worse than baseline
    recent_exps = await db.query("experiments", params={
        "select": "id,outcome_json,status",
        "goal_id": f"eq.{goal_id}" if goal_id else None,
        "status": "eq.evaluated",
        "order": "evaluated_at.desc",
        "limit": "3",
    })
    # Filter out None params
    recent_exps_params: dict = {
        "select": "id,outcome_json,status,evaluated_at",
        "status": "eq.evaluated",
        "order": "evaluated_at.desc",
        "limit": "3",
    }
    if goal_id:
        recent_exps_params["goal_id"] = f"eq.{goal_id}"
    recent_exps = await db.query("experiments", params=recent_exps_params)

    if len(recent_exps) >= 3:
        bad_count = 0
        for exp in recent_exps:
            outcome = exp.get("outcome_json") or {}
            if isinstance(outcome, str):
                try:
                    outcome = json.loads(outcome)
                except Exception:
                    outcome = {}
            if outcome.get("decision") in ("kill", "inconclusive") or float(
                outcome.get("improvement_pct", 0)
            ) < 0:
                bad_count += 1
        if bad_count >= 3:
            return True, "3 consecutive experiments underperformed baseline — manual review required"

    return False, ""


# ─── Core cycle ──────────────────────────────────────────────────────────────

async def run_cycle(goal_id: str) -> dict:
    """
    Run one full demand generation cycle for a goal.
    Returns summary dict with counts and cycle_run_id.
    """
    goal = await db.get_by_id("goals", goal_id)
    if not goal:
        raise ValueError(f"Goal not found: {goal_id}")

    # Resolve site_id: goals don't have site_id directly, use first active site
    site_id = goal.get("site_id")
    if not site_id:
        sites = await db.query("domain_sites", params={"select": "id", "status": "eq.active", "limit": "1"})
        site_id = sites[0]["id"] if sites else None

    # Create cycle run record
    cycle = await db.insert("cycle_runs", {
        "goal_id": goal_id,
        "site_id": site_id,
        "status": "running",
    })
    cycle_id = cycle["id"] if cycle else None

    async def _finalize(status: str, kill_reason: str = None, error: str = None, **counts):
        update = {
            "status": status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            **counts,
        }
        if kill_reason:
            update["kill_reason"] = kill_reason
        if error:
            update["error"] = error
        if cycle_id:
            await db.update("cycle_runs", cycle_id, update)

    # ── Kill switch check ──
    should_kill, kill_reason = await _check_kill_switches(goal_id, site_id)
    if should_kill:
        logger.warning(f"Cycle killed before start: {kill_reason}")
        await create_alert("loop_kill_switch", kill_reason, severity="warning")
        await _finalize("paused", kill_reason=kill_reason)
        return {"cycle_id": cycle_id, "status": "paused", "kill_reason": kill_reason}

    opps_generated = 0
    experiments_created = 0
    tasks_auto_run = 0
    tasks_queued_approval = 0

    try:
        # ── a) Pull context ──
        facts_params: dict = {
            "select": "channel,date,visits,leads,qualified_leads,revenue",
            "order": "date.desc",
            "limit": "30",
        }
        if site_id:
            facts_params["site_id"] = f"eq.{site_id}"
        facts = await db.query("fact_daily_channel_performance", params=facts_params)

        # ── b) Plan opportunities ──
        from packages.strategy import plan_opportunities
        candidates = await plan_opportunities(goal_id, site_id=site_id)
        opps_generated = len(candidates)
        logger.info(f"Cycle {cycle_id[:8] if cycle_id else '?'}: {opps_generated} opportunities planned")

        if not candidates:
            await _finalize("completed",
                            opportunities_generated=0,
                            experiments_created=0,
                            tasks_auto_run=0,
                            tasks_queued_approval=0)
            return {"cycle_id": cycle_id, "status": "completed", "opportunities_generated": 0}

        # ── c) Score + pick top 2 ──
        scored = sorted(
            [(opp, _score_opportunity(opp, facts)) for opp in candidates],
            key=lambda x: x[1],
            reverse=True,
        )
        top_opps = [opp for opp, _ in scored[:2]]

        for opp in top_opps:
            # Mark as evaluated
            await db.update("opportunities", opp["id"], {"execution_status": "evaluated"})

            # ── d) Create experiment for each top opportunity ──
            exp_hypothesis = (
                f"Targeting '{opp.get('query') or opp.get('pain_point', '')}' "
                f"via {opp.get('channel')} will increase "
                f"{goal.get('target_metric', 'leads')} vs baseline."
            )
            exp = await db.insert("experiments", {
                "site_id": site_id,
                "opportunity_id": opp["id"],
                "hypothesis": exp_hypothesis,
                "target_metric": goal.get("target_metric", "leads"),
                "run_window_days": 14,
                "status": "planned",
                "variant_a_json": {"type": "control", "description": "Current baseline"},
                "variant_b_json": {
                    "type": "variant",
                    "channel": opp.get("channel"),
                    "query": opp.get("query"),
                    "pain_point": opp.get("pain_point"),
                },
            })
            if not exp:
                continue
            experiments_created += 1
            await db.update("opportunities", opp["id"], {"execution_status": "planned"})

            # ── e) Create tasks for this experiment ──
            channel = opp.get("channel", "seo")
            task_specs = _get_task_specs(channel, opp, exp["id"], site_id)

            for spec in task_specs:
                task = await db.insert("tasks", {
                    "experiment_id": exp["id"],
                    "site_id": site_id,
                    "skill_name": spec["skill_name"],
                    "input_json": spec["input"],
                    "status": "pending",
                    "estimated_cost": spec.get("estimated_cost", 0.01),
                })
                if not task:
                    continue

                # ── f/g) Auto-run or queue for approval based on skill policy ──
                from packages.skills import get_skill
                skill = get_skill(spec["skill_name"])
                policy = getattr(skill, "approval_policy", "requires_approval") if skill else "requires_approval"

                if policy == "auto_run":
                    # Enqueue as a job for the worker to pick up
                    from packages.jobs import enqueue
                    await enqueue(
                        type="skill_task",
                        payload={"task_id": task["id"]},
                        site_id=site_id,
                        idempotency_key=f"task:{task['id']}",
                    )
                    tasks_auto_run += 1
                else:
                    await db.insert("approvals", {
                        "site_id": site_id,
                        "entity_type": "task",
                        "entity_id": task["id"],
                        "action": f"run_{spec['skill_name']}",
                        "requested_by": "cycle_runner",
                        "status": "pending",
                        "notes": f"Experiment: {exp_hypothesis[:80]}",
                    })
                    tasks_queued_approval += 1

            await db.update("experiments", exp["id"], {"status": "running"})
            await db.update("opportunities", opp["id"], {"execution_status": "executing"})

        # ── Auto-evaluate stale experiments ──
        await _trigger_stale_evaluations(goal_id, site_id)

        await _finalize(
            "completed",
            opportunities_generated=opps_generated,
            experiments_created=experiments_created,
            tasks_auto_run=tasks_auto_run,
            tasks_queued_approval=tasks_queued_approval,
        )
        logger.info(
            f"Cycle completed: goal={goal_id[:8]} "
            f"opps={opps_generated} exps={experiments_created} "
            f"auto={tasks_auto_run} queued={tasks_queued_approval}"
        )
        return {
            "cycle_id": cycle_id,
            "status": "completed",
            "opportunities_generated": opps_generated,
            "experiments_created": experiments_created,
            "tasks_auto_run": tasks_auto_run,
            "tasks_queued_approval": tasks_queued_approval,
        }

    except Exception as e:
        logger.error(f"Cycle failed: {e}")
        await create_alert("loop_error", f"Cycle failed for goal {goal_id[:8]}: {e}", severity="critical")
        await _finalize("failed", error=str(e)[:500],
                        opportunities_generated=opps_generated,
                        experiments_created=experiments_created,
                        tasks_auto_run=tasks_auto_run,
                        tasks_queued_approval=tasks_queued_approval)
        raise


# ─── Task spec builder ───────────────────────────────────────────────────────

def _get_task_specs(channel: str, opp: dict, experiment_id: str, site_id: str | None) -> list[dict]:
    """Return task specs for a channel. Each spec has skill_name + input + estimated_cost."""
    base = {"experiment_id": experiment_id, "site_id": site_id}

    if channel == "seo":
        return [
            {
                "skill_name": "content_creation",
                "input": {**base, "keyword": opp.get("query", ""), "topic": opp.get("pain_point", "")},
                "estimated_cost": 0.05,
            },
        ]
    if channel == "social":
        return [
            {
                "skill_name": "social_distribution",
                "input": {**base, "topic": opp.get("query", ""), "pain_point": opp.get("pain_point", "")},
                "estimated_cost": 0.02,
            },
        ]
    if channel == "community":
        return [
            {
                "skill_name": "community_engagement",
                "input": {**base, "query": opp.get("query", ""), "pain_point": opp.get("pain_point", "")},
                "estimated_cost": 0.02,
            },
        ]
    if channel == "email":
        return [
            {
                "skill_name": "email_nurturing",
                "input": {**base, "topic": opp.get("pain_point", ""), "intent": opp.get("intent", "awareness")},
                "estimated_cost": 0.01,
            },
        ]
    # Default: content creation
    return [
        {
            "skill_name": "content_creation",
            "input": {**base, "keyword": opp.get("query", "")},
            "estimated_cost": 0.05,
        },
    ]


# ─── Stale experiment evaluator ──────────────────────────────────────────────

async def _trigger_stale_evaluations(goal_id: str, site_id: str | None):
    """Auto-evaluate experiments that have passed their run_window_days."""
    params: dict = {
        "select": "id,run_window_days,created_at,status",
        "status": "eq.running",
        "order": "created_at.asc",
        "limit": "20",
    }
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    running_exps = await db.query("experiments", params=params)

    now = datetime.now(timezone.utc)
    for exp in running_exps:
        try:
            created = datetime.fromisoformat(exp["created_at"].replace("Z", "+00:00"))
            window = int(exp.get("run_window_days") or 14)
            if (now - created).days >= window:
                from packages.strategy.evaluator import evaluate_experiment
                outcome = await evaluate_experiment(exp["id"])
                logger.info(f"Stale experiment {exp['id'][:8]} auto-evaluated: {outcome['decision']}")
        except Exception as e:
            logger.warning(f"Failed to auto-evaluate experiment {exp['id'][:8]}: {e}")

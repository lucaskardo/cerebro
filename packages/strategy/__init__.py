"""
CEREBRO — Strategy Generator + Opportunity Planner
Goal → Opportunity → Experiment → Task Graph → Skill Runs → Outcomes → Learnings
"""
import json
from packages.core import db, get_logger
from packages.ai import complete
from packages.skills import list_skills

logger = get_logger("strategy")


# ─── Opportunity Planner ──────────────────────────────────────────────────────

async def plan_opportunities(goal_id: str, site_id: str = None) -> list[dict]:
    """
    Generate 3-5 concrete opportunity candidates from goal + knowledge + facts.
    Uses LLM for reasoning but output is structured JSON, not narrative.
    """
    goal = await db.get_by_id("goals", goal_id)
    if not goal:
        raise ValueError(f"Goal not found: {goal_id}")

    # Pull knowledge (medium/high confidence only)
    knowledge = await db.query("knowledge_entries", params={
        "select": "category,insight,metric_name,metric_value,confidence,condition_json",
        "confidence": "in.(medium,high)",
        "order": "sample_size.desc",
        "limit": "10",
    })

    # Pull recent channel performance facts
    facts_params = {
        "select": "channel,date,visits,leads,qualified_leads,revenue",
        "order": "date.desc",
        "limit": "30",
    }
    if site_id:
        facts_params["site_id"] = f"eq.{site_id}"
    facts = await db.query("fact_daily_channel_performance", params=facts_params)

    # Get client intelligence for strategy context
    strategy_intel = ""
    if site_id:
        try:
            from packages.intelligence import ClientIntelligence
            intel = ClientIntelligence()
            strategy_intel = await intel.get_strategy_context(site_id)
        except Exception as e:
            logger.warning(f"Could not load strategy intelligence: {e}")

    result = await complete(
        prompt=f"""Generate 3-5 concrete demand generation opportunities.

GOAL: {goal['description']}
TARGET METRIC: {goal['target_metric']} = {goal['target_value']}
CURRENT VALUE: {goal.get('current_value', 0)}

{strategy_intel}

KNOWLEDGE (what has worked):
{json.dumps(knowledge[:5], indent=2, ensure_ascii=False) if knowledge else "No knowledge yet — propose experiments."}

CHANNEL PERFORMANCE (last 30 days):
{json.dumps(facts[:10], indent=2, ensure_ascii=False) if facts else "No channel data yet."}

AVAILABLE SKILLS: {json.dumps([s['name'] for s in list_skills()])}

For each opportunity return a JSON object with:
- query: specific search query or topic to target
- pain_point: the specific problem this addresses
- audience: who specifically this targets (1 line)
- channel: seo|social|community|email|outreach
- intent: awareness|consideration|decision
- expected_value: estimated monthly leads (integer)
- confidence: low|medium|high (based on data, not hope)
- rationale: why this, backed by data above (1-2 sentences)

JSON array of opportunities. No text outside JSON.""",
        system=(
            "You are a demand generation analyst. "
            "Base all recommendations on the data provided. "
            "If no data, say confidence=low. "
            "Output structured JSON only, no vague suggestions."
        ),
        model="haiku",
        json_mode=True,
        pipeline_step="plan_opportunities",
    )

    candidates = result.get("parsed") or []
    if isinstance(candidates, dict):
        candidates = candidates.get("opportunities", [candidates])

    saved = []
    for c in candidates[:5]:
        opp = await db.insert("opportunities", {
            "goal_id": goal_id,
            "site_id": site_id,
            "query": c.get("query", ""),
            "pain_point": c.get("pain_point", ""),
            "audience": c.get("audience", ""),
            "channel": c.get("channel", "seo"),
            "intent": c.get("intent", "awareness"),
            "expected_value": float(c.get("expected_value", 0)),
            "confidence": c.get("confidence", "low"),
            "execution_status": "detected",
            # Legacy required fields
            "title": c.get("query", "Opportunity"),
            "keyword": c.get("query", ""),
            "status": "backlog",
        })
        if opp:
            saved.append(opp)
            logger.info(
                f"Opportunity planned: {c.get('query', '')} "
                f"({c.get('channel')}, confidence={c.get('confidence')})"
            )

    return saved


# ─── Strategy Generator (existing) ───────────────────────────────────────────

async def generate_strategies(goal_id: str) -> list[dict]:
    """Generate 3-5 strategies for a goal using AI + available skills."""

    goal = await db.get_by_id("goals", goal_id)
    if not goal:
        raise ValueError(f"Goal not found: {goal_id}")

    mission = await db.get_by_id("missions", goal["mission_id"])
    if not mission:
        raise ValueError("Mission not found for goal")

    knowledge = await db.query("knowledge_entries", params={
        "select": "category,insight,confidence",
        "order": "confidence.desc",
        "limit": "10",
    })

    past_strategies = await db.query("strategies", params={
        "select": "name,channel,status,results,confidence_score",
        "goal_id": f"eq.{goal_id}",
        "order": "created_at.desc",
        "limit": "10",
    })

    # Get client intelligence for strategy context
    strategy_intel = ""
    goal_site_id = goal.get("site_id")
    if goal_site_id:
        try:
            from packages.intelligence import ClientIntelligence
            intel = ClientIntelligence()
            strategy_intel = await intel.get_strategy_context(goal_site_id)
        except Exception as e:
            logger.warning(f"Could not load strategy intelligence: {e}")

    available_skills = list_skills()

    result = await complete(
        prompt=f"""Generate 5 demand generation strategies for this goal.

GOAL: {goal['description']}
TARGET: {goal['target_metric']} = {goal['target_value']}
CURRENT: {goal.get('current_value', 0)}

MISSION CONTEXT:
- Country: {mission.get('country')}
- Partner: {mission.get('partner_name')}
- Audience: {json.dumps(mission.get('target_audience', {}), ensure_ascii=False)}
- Topics: {json.dumps(mission.get('core_topics', []), ensure_ascii=False)}

{strategy_intel}

AVAILABLE SKILLS:
{json.dumps(available_skills, indent=2)}

PAST KNOWLEDGE:
{json.dumps(knowledge[:5], indent=2, ensure_ascii=False) if knowledge else "No knowledge yet."}

PAST STRATEGIES:
{json.dumps(past_strategies[:5], indent=2, ensure_ascii=False) if past_strategies else "No past strategies."}

For each strategy: name, description, channel, skills_needed, estimated_leads, estimated_cost, confidence_score (0-100), reasoning.
JSON array of 5 strategies.""",
        system=(
            "You are a demand generation strategist. Design strategies that maximize qualified leads. "
            "Prioritize highest lead potential / lowest cost. Be specific and practical."
        ),
        model="sonnet",
        max_tokens=4096,
        json_mode=True,
        pipeline_step="strategy_generation",
    )

    strategies = result.get("parsed") or []
    if isinstance(strategies, dict):
        strategies = strategies.get("strategies", [strategies])

    saved = []
    for s in strategies[:5]:
        record = await db.insert("strategies", {
            "goal_id": goal_id,
            "name": s.get("name", "Unnamed"),
            "description": s.get("description", ""),
            "channel": s.get("channel", "seo"),
            "skills_needed": s.get("skills_needed", []),
            "estimated_leads": s.get("estimated_leads", 0),
            "estimated_cost": s.get("estimated_cost", 0),
            "confidence_score": s.get("confidence_score", 0),
            "status": "proposed",
            "results": {"reasoning": s.get("reasoning", "")},
        })
        if record:
            saved.append(record)
            logger.info(f"Strategy proposed: {record['name']} (confidence={record['confidence_score']})")

    return saved


async def approve_strategy(strategy_id: str) -> dict:
    return await db.update("strategies", strategy_id, {"status": "approved"})


async def execute_strategy(strategy_id: str) -> dict:
    from packages.skills import get_skill

    strategy = await db.get_by_id("strategies", strategy_id)
    if not strategy:
        raise ValueError("Strategy not found")
    if strategy["status"] != "approved":
        raise ValueError(f"Strategy not approved (status={strategy['status']})")

    await db.update("strategies", strategy_id, {"status": "running"})

    results = []
    for skill_name in strategy.get("skills_needed", []):
        skill = get_skill(skill_name)
        if skill:
            try:
                goal = await db.get_by_id("goals", strategy["goal_id"])
                result = await skill.run_with_tracking(
                    {
                        "mission_id": goal.get("mission_id") if goal else None,
                        "strategy_id": strategy_id,
                    },
                    site_id=strategy.get("site_id"),
                )
                results.append({"skill": skill_name, "result": result})
            except Exception as e:
                results.append({"skill": skill_name, "error": str(e)})
                logger.error(f"Skill {skill_name} failed: {e}")

    await db.update("strategies", strategy_id, {
        "status": "completed",
        "results": {"executions": results},
    })

    return {"strategy_id": strategy_id, "results": results}

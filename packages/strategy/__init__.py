"""
CEREBRO — Strategy Generator
Given a goal, generates strategies using available skills.
This is the brain of the demand generation engine.
"""
import json
from packages.core import db, get_logger
from packages.ai import complete
from packages.skills import list_skills

logger = get_logger("strategy")


async def generate_strategies(goal_id: str) -> list[dict]:
    """Generate 3-5 strategies for a goal using AI + available skills."""

    goal = await db.get_by_id("goals", goal_id)
    if not goal:
        raise ValueError(f"Goal not found: {goal_id}")

    mission = await db.get_by_id("missions", goal["mission_id"])
    if not mission:
        raise ValueError(f"Mission not found for goal")

    # Get existing knowledge
    knowledge = await db.query("knowledge_entries", params={
        "select": "category,insight,confidence",
        "order": "confidence.desc",
        "limit": "10",
    })

    # Get past strategy results
    past_strategies = await db.query("strategies", params={
        "select": "name,channel,status,results,confidence_score",
        "goal_id": f"eq.{goal_id}",
        "order": "created_at.desc",
        "limit": "10",
    })

    available_skills = list_skills()

    result = await complete(
        prompt=f"""Generate 5 demand generation strategies for this goal.

GOAL: {goal['description']}
TARGET: {goal['target_metric']} = {goal['target_value']}
CURRENT: {goal['current_value']}

MISSION CONTEXT:
- Country: {mission.get('country')}
- Partner: {mission.get('partner_name')}
- Audience: {json.dumps(mission.get('target_audience', {}), ensure_ascii=False)}
- Topics: {json.dumps(mission.get('core_topics', []), ensure_ascii=False)}

AVAILABLE SKILLS:
{json.dumps(available_skills, indent=2)}

PAST KNOWLEDGE (what we've learned):
{json.dumps(knowledge[:5], indent=2, ensure_ascii=False) if knowledge else "No knowledge yet."}

PAST STRATEGIES:
{json.dumps(past_strategies[:5], indent=2, ensure_ascii=False) if past_strategies else "No past strategies."}

For each strategy, provide:
- name: short name
- description: what it does
- channel: primary channel (seo, social, community, messaging, email, outreach)
- skills_needed: which skills from the available list
- estimated_leads: expected monthly leads
- estimated_cost: monthly cost in USD
- confidence_score: 0-100 how confident this will work
- reasoning: why this strategy should work

Return JSON array of 5 strategies.""",

        system="""You are a demand generation strategist. You design strategies that maximize qualified leads.
You think in terms of channels, funnels, and conversion rates.
You prioritize strategies with highest lead potential and lowest cost.
Be specific and practical, not generic.""",

        model="sonnet",
        max_tokens=4096,
        json_mode=True,
        pipeline_step="strategy_generation",
    )

    strategies = result.get("parsed") or []
    if isinstance(strategies, dict):
        strategies = strategies.get("strategies", [strategies])

    # Save to database
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
            logger.info(f"Strategy proposed: {record['name']} ({record['channel']}, confidence={record['confidence_score']})")

    return saved


async def approve_strategy(strategy_id: str) -> dict:
    """Human approves a strategy for execution."""
    return await db.update("strategies", strategy_id, {"status": "approved"})


async def execute_strategy(strategy_id: str) -> dict:
    """Execute an approved strategy using its required skills."""
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
                result = await skill.execute({
                    "mission_id": (await db.get_by_id("goals", strategy["goal_id"])).get("mission_id"),
                    "strategy_id": strategy_id,
                })
                results.append({"skill": skill_name, "result": result})
            except Exception as e:
                results.append({"skill": skill_name, "error": str(e)})
                logger.error(f"Skill {skill_name} failed: {e}")

    await db.update("strategies", strategy_id, {
        "status": "completed",
        "results": {"executions": results},
    })

    return {"strategy_id": strategy_id, "results": results}

"""
CEREBRO — Experiment Evaluator
Compares experiment outcome vs hypothesis. Produces kill/scale/continue/inconclusive.
"""
from datetime import datetime, timezone
from packages.core import db, get_logger

logger = get_logger("strategy.evaluator")

MIN_SAMPLE = 100  # minimum visits before evaluating


async def evaluate_experiment(experiment_id: str) -> dict:
    """
    Evaluate an experiment by comparing variant metrics.

    Decision logic:
    - sample < MIN_SAMPLE → inconclusive
    - improvement > 20%  → scale
    - improvement < -10% → kill
    - |improvement| < 5% → inconclusive (no signal)
    - else               → continue

    Writes result to experiments.outcome_json and updates status.
    Returns {decision, rationale, confidence, improvement_pct}.
    """
    exp = await db.get_by_id("experiments", experiment_id)
    if not exp:
        raise ValueError(f"Experiment not found: {experiment_id}")

    visits_a = exp.get("visits_a") or 0
    visits_b = exp.get("visits_b") or 0
    total = visits_a + visits_b

    if total < MIN_SAMPLE:
        outcome = {
            "decision": "inconclusive",
            "rationale": f"Sample too small ({total} visits, need {MIN_SAMPLE}+)",
            "confidence": "low",
            "improvement_pct": 0,
            "sample_size": total,
        }
    else:
        metric_a = float(exp.get("metric_baseline") or 0)
        metric_b = float(exp.get("metric_variant") or 0)
        improvement = ((metric_b - metric_a) / metric_a * 100) if metric_a else 0

        confidence = "high" if total >= 500 else "medium"

        if improvement > 20:
            decision = "scale"
            rationale = f"Variant B improved {exp.get('target_metric', 'metric')} by {improvement:.1f}%"
        elif improvement < -10:
            decision = "kill"
            rationale = f"Variant B degraded {exp.get('target_metric', 'metric')} by {abs(improvement):.1f}%"
            confidence = "medium"
        elif abs(improvement) < 5:
            decision = "inconclusive"
            rationale = f"No significant difference ({improvement:+.1f}% change, n={total})"
            confidence = "low"
        else:
            decision = "continue"
            rationale = f"Positive trend ({improvement:+.1f}%) but needs more data (n={total})"
            confidence = "medium"

        outcome = {
            "decision": decision,
            "rationale": rationale,
            "confidence": confidence,
            "improvement_pct": round(improvement, 2),
            "sample_size": total,
            "metric_a": metric_a,
            "metric_b": metric_b,
        }

    await db.update("experiments", experiment_id, {
        "outcome_json": outcome,
        "status": "evaluated",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "winner": "b" if outcome["decision"] == "scale" else (
            "a" if outcome["decision"] == "kill" else None
        ),
    })

    logger.info(
        f"Experiment {experiment_id[:8]} evaluated: "
        f"{outcome['decision']} ({outcome['rationale']})"
    )

    # Auto-generate knowledge entry if enough signal
    if outcome["decision"] in ("scale", "kill") and outcome["confidence"] in ("medium", "high"):
        try:
            from packages.strategy.knowledge import update_knowledge_from_experiment
            await update_knowledge_from_experiment(experiment_id, outcome)
        except Exception as e:
            logger.warning(f"Knowledge update failed: {e}")

    return outcome

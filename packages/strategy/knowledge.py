"""
CEREBRO — Knowledge Updater
Auto-generates structured knowledge_entries from evaluated experiments.
Only writes when sample_size >= 100 and confidence >= medium.
"""
from packages.core import db, get_logger

logger = get_logger("strategy.knowledge")

MIN_SAMPLE = 100


async def update_knowledge_from_experiment(experiment_id: str, outcome: dict = None) -> dict | None:
    """
    Generate a knowledge_entry from a completed experiment.
    Returns the created entry or None if skipped (insufficient data).
    """
    exp = await db.get_by_id("experiments", experiment_id)
    if not exp:
        return None

    if outcome is None:
        outcome = exp.get("outcome_json") or {}

    sample_size = outcome.get("sample_size", 0)
    confidence = outcome.get("confidence", "low")

    # Gate: need enough data
    if sample_size < MIN_SAMPLE or confidence == "low":
        logger.info(
            f"Skipping knowledge update for {experiment_id[:8]}: "
            f"sample={sample_size}, confidence={confidence}"
        )
        return None

    decision = outcome.get("decision", "inconclusive")
    target_metric = exp.get("target_metric", "conversion_rate")
    metric_value = float(exp.get("metric_variant") or 0)
    improvement_pct = outcome.get("improvement_pct", 0)

    insight = (
        f"{outcome.get('rationale', '')}. "
        f"Decision: {decision}. "
        f"Improvement: {improvement_pct:+.1f}%."
    )

    condition = {
        "experiment_id": experiment_id,
        "hypothesis": exp.get("hypothesis", ""),
        "decision": decision,
        "variant_a": exp.get("variant_a_json", {}),
        "variant_b": exp.get("variant_b_json", {}),
    }

    entry = await db.insert("knowledge_entries", {
        "site_id": exp.get("site_id"),
        "category": "experiment_result",
        "condition_json": condition,
        "metric_name": target_metric,
        "metric_value": metric_value,
        "sample_size": sample_size,
        "confidence": confidence,
        "supporting_experiment_ids": [experiment_id],
        "insight": insight,
    })

    if entry:
        logger.info(
            f"Knowledge entry created from experiment {experiment_id[:8]}: "
            f"{decision} on {target_metric}"
        )

    return entry


async def record_learning(
    site_id: str,
    category: str,
    metric_name: str,
    metric_value: float,
    sample_size: int,
    confidence: str,
    condition: dict,
    insight: str,
) -> dict | None:
    """
    Manually record a structured knowledge entry.
    category examples: channel_performance, cta_effectiveness, content_format
    """
    if confidence not in ("low", "medium", "high"):
        raise ValueError(f"confidence must be low|medium|high, got: {confidence}")

    return await db.insert("knowledge_entries", {
        "site_id": site_id,
        "category": category,
        "condition_json": condition,
        "metric_name": metric_name,
        "metric_value": metric_value,
        "sample_size": sample_size,
        "confidence": confidence,
        "insight": insight,
    })

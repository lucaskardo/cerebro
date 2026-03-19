"""
CEREBRO — Intelligence Updater
Real-time event handlers: create observations from business events.
No LLM calls. Fire-and-forget for lead_captured and sale_completed.
"""
import asyncio
import re
from packages.core import db, get_logger

logger = get_logger("intelligence.updater")

_PAIN_KEYS = {"dolor", "problema", "pain", "segmento", "tipo"}


def _slugify(text: str) -> str:
    """Normalize text to slug format: lowercase, alphanumeric + hyphens."""
    text = str(text).lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text[:50]  # cap length


class IntelligenceUpdater:

    async def on_lead_captured(self, lead: dict, site_id: str) -> None:
        """
        Create observations from quiz responses. Batch insert via asyncio.gather.
        Async, non-blocking (called via asyncio.create_task from the router).
        """
        try:
            quiz_responses = lead.get("quiz_responses") or {}
            if not quiz_responses:
                return

            lead_id = lead.get("id")

            rows = []
            for key, value in quiz_responses.items():
                rows.append({
                    "site_id": site_id,
                    "observation_type": "lead_conversion",
                    "source_type": "pipeline",
                    "source_ref": str(lead_id) if lead_id else None,
                    "raw_value": {
                        "quiz_key": key,
                        "quiz_value": value,
                        "lead_id": lead_id,
                        "intent_score": lead.get("intent_score"),
                    },
                    "normalized_tags": [
                        f"quiz-{_slugify(key)}",
                        f"val-{_slugify(str(value))}",
                    ],
                })

            if rows:
                results = await asyncio.gather(
                    *[db.insert("intelligence_observations", row) for row in rows],
                    return_exceptions=True,
                )
                for i, r in enumerate(results):
                    if isinstance(r, Exception):
                        logger.warning(f"batch_insert[{i}] failed: {r}")

            # Upsert audience facts for pain/segment keys
            fact_tasks = []
            for key, value in quiz_responses.items():
                if key.lower() in _PAIN_KEYS:
                    fact_tasks.append(
                        db.rpc("upsert_intelligence_fact", {
                            "p_site_id": site_id,
                            "p_entity_id": None,
                            "p_fact_key": f"audience.{_slugify(key)}.{_slugify(str(value))}",
                            "p_category": "audience",
                            "p_value_text": str(value),
                            "p_value_number": None,
                            "p_value_json": None,
                            "p_confidence": 0.6,
                            "p_tags": [_slugify(key), _slugify(str(value))],
                            "p_source": "quiz",
                            "p_quarantined": False,
                            "p_source_ref": str(lead_id) if lead_id else None,
                        })
                    )

            if fact_tasks:
                fact_results = await asyncio.gather(*fact_tasks, return_exceptions=True)
                for i, r in enumerate(fact_results):
                    if isinstance(r, Exception):
                        logger.warning(f"batch_insert[{i}] failed: {r}")

        except Exception as exc:
            logger.warning(f"on_lead_captured failed for site={site_id}: {exc}")

    async def on_content_published(self, article: dict, site_id: str) -> None:
        """
        Create a single observation about new content being published.
        """
        try:
            keyword = article.get("keyword") or ""
            tags = ["content-published"]
            if keyword:
                tags.insert(0, f"keyword-{_slugify(keyword)}")

            await db.insert("intelligence_observations", {
                "site_id": site_id,
                "observation_type": "content_performance",
                "source_type": "pipeline",
                "source_ref": str(article.get("id")) if article.get("id") else None,
                "raw_value": {
                    "title": article.get("title"),
                    "keyword": keyword,
                    "slug": article.get("slug"),
                },
                "normalized_tags": tags,
            })
        except Exception as exc:
            logger.warning(f"on_content_published failed for site={site_id}: {exc}")

    async def on_sale_completed(self, sale: dict, site_id: str) -> None:
        """
        Create a sales outcome observation and boost utility of facts in the attribution chain.
        """
        try:
            lead_id = sale.get("lead_id")

            # 1. Create observation
            try:
                await db.insert("intelligence_observations", {
                    "site_id": site_id,
                    "observation_type": "lead_conversion",
                    "source_type": "webhook",
                    "source_ref": str(lead_id) if lead_id else None,
                    "raw_value": {
                        "sale_value": sale.get("revenue_value"),
                        "lead_id": lead_id,
                        "partner": sale.get("partner"),
                    },
                    "normalized_tags": ["sale-completed", "revenue-event"],
                })
            except Exception as exc:
                logger.warning(f"on_sale_completed observation insert failed: {exc}")

            if not lead_id:
                return

            # 2. Find attribution chain
            try:
                leads = await db.query("leads", params={
                    "select": "id",
                    "id": f"eq.{lead_id}",
                })
                if not leads:
                    return
            except Exception as exc:
                logger.warning(f"on_sale_completed lead lookup failed: {exc}")
                return

            try:
                receipts = await db.query("intelligence_context_receipts", params={
                    "select": "id",
                    "site_id": f"eq.{site_id}",
                    "limit": "10",
                    "order": "created_at.desc",
                })
            except Exception as exc:
                logger.warning(f"on_sale_completed receipts lookup failed: {exc}")
                return

            if not receipts:
                return

            # 3. Collect all fact_ids across receipts (parallel fetches)
            async def _fetch_receipt_facts(rid: str) -> list:
                try:
                    return await db.query("intelligence_receipt_facts", params={
                        "select": "fact_id",
                        "receipt_id": f"eq.{rid}",
                    }) or []
                except Exception as exc:
                    logger.warning(f"on_sale_completed receipt_facts lookup failed for receipt={rid}: {exc}")
                    return []

            receipt_ids = [r["id"] for r in receipts if r.get("id")]
            all_fact_rows = await asyncio.gather(*[_fetch_receipt_facts(rid) for rid in receipt_ids])
            fact_ids = list({row["fact_id"] for rows in all_fact_rows for row in rows if row.get("fact_id")})

            if not fact_ids:
                return

            # 4. Boost utility for each fact
            boost_results = await asyncio.gather(
                *[
                    db.rpc("update_fact_utility", {"p_fact_id": fact_id, "p_reward": 0.15})
                    for fact_id in fact_ids
                ],
                return_exceptions=True,
            )
            for i, r in enumerate(boost_results):
                if isinstance(r, Exception):
                    logger.warning(f"batch_insert[{i}] failed: {r}")

        except Exception as exc:
            logger.warning(f"on_sale_completed failed for site={site_id}: {exc}")

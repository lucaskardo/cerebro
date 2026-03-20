"""
CEREBRO — Intelligence Analyzer
Weekly analysis cycle: 8 phases, budget-controlled, 120s timeout each.
Run once per week (Sundays). Cost target: <$1/month per client.
"""
import asyncio
import re as _re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from packages.core import db, get_logger
from packages.ai import complete
from packages.ai.prompts.intelligence_insights import INSIGHTS_USER, INSIGHTS_SYSTEM

logger = get_logger("intelligence.analyzer")


def _slugify(text: str) -> str:
    text = str(text).lower().strip()
    text = _re.sub(r'[^\w\s-]', '', text)
    text = _re.sub(r'[\s_]+', '-', text)
    return _re.sub(r'-+', '-', text)[:50]

PHASE_TIMEOUT = 120  # seconds per phase
PHASE5_TIMEOUT = 600  # phase 5 research: up to 10 entities × 60s each
MAX_RESEARCH_TASKS_PER_WEEK = 10
UTILITY_BOOST_ON_DECAY = 0.05  # small decay per week



class IntelligenceAnalyzer:

    async def run_weekly_cycle(self, site_id: str) -> dict:
        """
        Run all 8 phases for a site. Returns a summary dict.
        Each phase has a 120s timeout (asyncio.wait_for).
        Phase 3 depends on Phase 1 result.
        All other phases are independent.
        Catch exceptions per phase — log and continue.
        """
        summary = {
            "site_id": site_id,
            "phases": {},
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        phase1_result: dict = {}

        # Phase 1 — consolidate observations
        try:
            phase1_result = await asyncio.wait_for(
                self._phase1_consolidate_observations(site_id),
                timeout=PHASE_TIMEOUT,
            )
            summary["phases"]["phase1"] = phase1_result
        except Exception as e:
            logger.warning(f"Phase 1 failed for {site_id}: {e}")
            summary["phases"]["phase1"] = {"error": str(e)}

        # Phase 2 — content performance (independent)
        try:
            summary["phases"]["phase2"] = await asyncio.wait_for(
                self._phase2_analyze_content_performance(site_id),
                timeout=PHASE_TIMEOUT,
            )
        except Exception as e:
            logger.warning(f"Phase 2 failed for {site_id}: {e}")
            summary["phases"]["phase2"] = {"error": str(e)}

        # Phase 3 — discover new entities (depends on phase 1 run_id)
        try:
            run_id = phase1_result.get("run_id")
            summary["phases"]["phase3"] = await asyncio.wait_for(
                self._phase3_discover_new_entities(site_id, phase1_run_id=run_id),
                timeout=PHASE_TIMEOUT,
            )
        except Exception as e:
            logger.warning(f"Phase 3 failed for {site_id}: {e}")
            summary["phases"]["phase3"] = {"error": str(e)}

        # Phase 4 — detect knowledge gaps (independent)
        gaps: list = []
        try:
            phase4_result = await asyncio.wait_for(
                self._phase4_detect_knowledge_gaps(site_id),
                timeout=PHASE_TIMEOUT,
            )
            summary["phases"]["phase4"] = phase4_result
            gaps = phase4_result.get("gap_details", [])
        except Exception as e:
            logger.warning(f"Phase 4 failed for {site_id}: {e}")
            summary["phases"]["phase4"] = {"error": str(e)}

        # Phase 5 — execute research (uses gaps from phase 4)
        try:
            summary["phases"]["phase5"] = await asyncio.wait_for(
                self._phase5_execute_research(site_id, gaps),
                timeout=PHASE5_TIMEOUT,
            )
        except Exception as e:
            logger.warning(f"Phase 5 failed for {site_id}: {e}")
            summary["phases"]["phase5"] = {"error": str(e)}

        # Phase 6 — generate insights (independent)
        try:
            summary["phases"]["phase6"] = await asyncio.wait_for(
                self._phase6_generate_insights(site_id),
                timeout=PHASE_TIMEOUT,
            )
        except Exception as e:
            logger.warning(f"Phase 6 failed for {site_id}: {e}")
            summary["phases"]["phase6"] = {"error": str(e)}

        # Phase 7 — janitor (independent)
        try:
            summary["phases"]["phase7"] = await asyncio.wait_for(
                self._phase7_janitor(site_id),
                timeout=PHASE_TIMEOUT,
            )
        except Exception as e:
            logger.warning(f"Phase 7 failed for {site_id}: {e}")
            summary["phases"]["phase7"] = {"error": str(e)}

        # Phase 8 — decay stale facts (independent)
        try:
            summary["phases"]["phase8"] = await asyncio.wait_for(
                self._phase8_decay_stale_facts(site_id),
                timeout=PHASE_TIMEOUT,
            )
        except Exception as e:
            logger.warning(f"Phase 8 failed for {site_id}: {e}")
            summary["phases"]["phase8"] = {"error": str(e)}

        summary["completed_at"] = datetime.now(timezone.utc).isoformat()
        return summary

    # ------------------------------------------------------------------
    # Phase 1 — Consolidate observations into facts
    # ------------------------------------------------------------------

    async def _phase1_consolidate_observations(self, site_id: str) -> dict:
        """
        Claim unprocessed observations with FOR UPDATE SKIP LOCKED via RPC.
        Group by normalized_tags.
        Upsert facts from observations.
        Mark as processed.
        Returns {"processed_count": N, "run_id": str(uuid)}
        """
        run_id = str(uuid.uuid4())
        processed_count = 0

        try:
            observations = await db.rpc(
                "claim_unprocessed_observations",
                {
                    "p_site_id": site_id,
                    "p_run_id": run_id,
                    "p_limit": 200,
                },
            )
        except Exception as e:
            logger.warning(f"claim_unprocessed_observations failed for {site_id}: {e}")
            return {"processed_count": 0, "run_id": run_id}

        if not observations:
            return {"processed_count": 0, "run_id": run_id}

        # Group observations by observation_type to derive fact_key + category
        type_to_category = {
            # Observation types → fact categories (THE CRITICAL MAPPING)
            "lead_conversion": "audience",
            "content_performance": "performance",
            "search_signal": "market",
            "competitor_signal": "competitor",
            "market_signal": "market",
            "user_behavior": "audience",
            "research_finding": "other",
            # Direct category pass-through (from migration seed, manual inserts)
            "pricing": "pricing",
            "positioning": "positioning",
            "audience": "audience",
            "competitor": "competitor",
            "content": "content",
            "product": "product",
            "market": "market",
            "performance": "performance",
            "objection": "objection",
            "trigger": "trigger",
            "differentiator": "differentiator",
        }

        for obs in observations:
            try:
                obs_type = obs.get("observation_type", "other")
                entity_id = obs.get("entity_id")
                raw = obs.get("raw_value") or {}
                tags = obs.get("normalized_tags") or []
                source_ref = obs.get("source_ref") or obs.get("source_type", "analyzer")

                category = type_to_category.get(obs_type, "other")

                if raw.get("quiz_key"):
                    qk = _slugify(raw["quiz_key"])
                    qv = _slugify(str(raw.get("quiz_value", "")))
                    fact_key = f"{category}.{qk}.{qv}"
                elif raw.get("keyword"):
                    kw = _slugify(raw["keyword"])
                    fact_key = f"{category}.content.{kw}"
                elif raw.get("sale_value") is not None:
                    lead_ref = _slugify(str(raw.get("lead_id", ""))[:12])
                    fact_key = f"{category}.sale.{lead_ref or 'unknown'}"
                elif entity_id:
                    entity_slug = raw.get("entity_slug") or raw.get("slug") or str(entity_id)[:12]
                    metric = raw.get("metric") or obs_type
                    fact_key = f"{category}.{_slugify(entity_slug)}.{_slugify(metric)}"
                elif tags:
                    tag_slug = _slugify(str(tags[0]))
                    fact_key = f"{category}.{tag_slug}.general"
                else:
                    fact_key = f"{category}.{obs_type}.general"

                # Determine which value column to use
                value_text = None
                value_number = None
                value_json = None

                if isinstance(raw, dict):
                    if "number" in raw:
                        value_number = float(raw["number"])
                    elif "text" in raw:
                        value_text = str(raw["text"])[:2000]
                    else:
                        value_json = raw
                elif isinstance(raw, (int, float)):
                    value_number = float(raw)
                elif isinstance(raw, str):
                    value_text = raw[:2000]
                else:
                    value_json = {"raw": str(raw)}

                # Default to value_json if nothing else was set
                if value_text is None and value_number is None and value_json is None:
                    value_json = {"raw": str(raw)}

                await db.rpc(
                    "upsert_intelligence_fact",
                    {
                        "p_site_id": site_id,
                        "p_entity_id": entity_id,
                        "p_fact_key": fact_key,
                        "p_category": category,
                        "p_value_text": value_text,
                        "p_value_number": value_number,
                        "p_value_json": value_json,
                        "p_confidence": 0.7,
                        "p_tags": tags,
                        "p_source": obs.get("source_type", "observation"),
                        "p_quarantined": False,
                        "p_source_ref": source_ref,
                    },
                )

                # Set evidence_type based on source
                if obs.get("source_type") == "pipeline":
                    try:
                        stored = await db.query("intelligence_facts", params={
                            "select": "id", "site_id": f"eq.{site_id}",
                            "fact_key": f"eq.{fact_key}", "limit": "1",
                        })
                        if stored:
                            await db.update("intelligence_facts", stored[0]["id"], {"evidence_type": "own_data"})
                    except Exception:
                        pass

                processed_count += 1
            except Exception as e:
                logger.warning(f"Failed to upsert fact from observation {obs.get('id')}: {e}")
                continue

        # Mark all claimed observations as processed so they won't be re-claimed
        try:
            await db.rpc("mark_observations_processed", {"p_run_id": run_id})
        except Exception as e:
            logger.warning(f"mark_observations_processed failed for run {run_id}: {e}")

        return {"processed_count": processed_count, "run_id": run_id}

    # ------------------------------------------------------------------
    # Phase 2 — Content performance analysis
    # ------------------------------------------------------------------

    async def _phase2_analyze_content_performance(self, site_id: str) -> dict:
        """
        Join content_assets with leads via asset_id.
        Calculate leads per article.
        Update content_performance facts (fact_key = f"content_perf_{asset_id[:8]}").
        Returns {"updated_facts": N}
        """
        updated_facts = 0

        try:
            # Fetch content assets for this site
            assets = await db.query(
                "content_assets",
                params={"select": "id,title", "site_id": f"eq.{site_id}"},
            )
        except Exception as e:
            logger.warning(f"Phase 2: failed to fetch content_assets for {site_id}: {e}")
            return {"updated_facts": 0}

        for asset in assets:
            asset_id = asset.get("id")
            if not asset_id:
                continue

            try:
                leads = await db.query(
                    "leads",
                    params={
                        "select": "id",
                        "site_id": f"eq.{site_id}",
                        "asset_id": f"eq.{asset_id}",
                    },
                )
                lead_count = len(leads) if leads else 0

                fact_key = f"performance.content.{str(asset_id)[:12]}.lead-count"
                await db.rpc(
                    "upsert_intelligence_fact",
                    {
                        "p_site_id": site_id,
                        "p_entity_id": None,
                        "p_fact_key": fact_key,
                        "p_category": "performance",
                        "p_value_text": None,
                        "p_value_number": float(lead_count),
                        "p_value_json": None,
                        "p_confidence": 1.0,
                        "p_tags": ["content_performance", str(asset_id)[:12]],
                        "p_source": "content_pipeline",
                        "p_quarantined": False,
                        "p_source_ref": asset_id,
                    },
                )
                updated_facts += 1
            except Exception as e:
                logger.warning(f"Phase 2: failed to update fact for asset {asset_id}: {e}")
                continue

        return {"updated_facts": updated_facts}

    # ------------------------------------------------------------------
    # Phase 3 — Discover new entities
    # ------------------------------------------------------------------

    async def _phase3_discover_new_entities(
        self, site_id: str, phase1_run_id: Optional[str] = None
    ) -> dict:
        """
        Depends on Phase 1 run_id.
        Scan recently processed observations for clusters not matching existing entities.
        Check thresholds from discovery_policies.
        Create/update discovery_candidates.
        Returns {"candidates_created": N, "candidates_updated": N}
        """
        candidates_created = 0
        candidates_updated = 0

        if not phase1_run_id:
            return {"candidates_created": 0, "candidates_updated": 0}

        # Fetch observations processed in this run
        try:
            processed_obs = await db.query(
                "intelligence_observations",
                params={
                    "select": "id,observation_type,raw_value,normalized_tags,entity_id",
                    "site_id": f"eq.{site_id}",
                    "processing_run_id": f"eq.{phase1_run_id}",
                    "processed": "eq.true",
                },
            )
        except Exception as e:
            logger.warning(f"Phase 3: failed to fetch processed observations for {site_id}: {e}")
            return {"candidates_created": 0, "candidates_updated": 0}

        if not processed_obs:
            return {"candidates_created": 0, "candidates_updated": 0}

        # Fetch existing entities for deduplication
        try:
            existing_entities = await db.query(
                "intelligence_entities",
                params={
                    "select": "id,name,slug,entity_type",
                    "site_id": f"eq.{site_id}",
                    "status": "neq.archived",
                },
            )
        except Exception as e:
            logger.warning(f"Phase 3: failed to fetch entities for {site_id}: {e}")
            existing_entities = []

        existing_slugs = {e.get("slug", "").lower() for e in existing_entities}

        # Fetch discovery policies
        try:
            policies = await db.query(
                "discovery_policies",
                params={"select": "*", "site_id": f"eq.{site_id}"},
            )
        except Exception as e:
            logger.warning(f"Phase 3: failed to fetch discovery_policies for {site_id}: {e}")
            policies = []

        default_threshold = 2
        policy_map: dict = {}
        for p in policies:
            policy_map[p.get("entity_type")] = p

        _OBS_TO_ENTITY = {
            "lead_conversion": "segment",
            "content_performance": "other",
            "search_signal": "other",
            "competitor_signal": "brand",
            "market_signal": "other",
            "user_behavior": "segment",
            "research_finding": "other",
        }

        # Build candidate_key → {count, entity_type, display_name} map
        candidate_counts: dict = {}
        for obs in processed_obs:
            raw = obs.get("raw_value") or {}
            tags = obs.get("normalized_tags") or []
            obs_type = obs.get("observation_type", "other")

            # Try to extract a candidate key from tags or raw value
            for tag in tags:
                tag_str = str(tag).strip().lower()
                if not tag_str or len(tag_str) < 3:
                    continue
                ckey = f"{obs_type}::{tag_str}"
                if ckey not in candidate_counts:
                    candidate_counts[ckey] = {
                        "count": 0,
                        "entity_type": _OBS_TO_ENTITY.get(obs_type, "other"),
                        "display_name": str(tag).strip(),
                        "candidate_key": ckey,
                    }
                candidate_counts[ckey]["count"] += 1

            # Also check raw_value for named entities
            if isinstance(raw, dict) and raw.get("name"):
                name = str(raw["name"]).strip()
                ckey = f"{obs_type}::{name.lower()}"
                if ckey not in candidate_counts:
                    candidate_counts[ckey] = {
                        "count": 0,
                        "entity_type": _OBS_TO_ENTITY.get(obs_type, "other"),
                        "display_name": name,
                        "candidate_key": ckey,
                    }
                candidate_counts[ckey]["count"] += 1

        now = datetime.now(timezone.utc).isoformat()

        for ckey, info in candidate_counts.items():
            entity_type = info["entity_type"]
            display_name = info["display_name"]
            evidence_count = info["count"]
            slug = _slugify(display_name)

            # Skip if matches existing entity slug
            if slug in existing_slugs:
                continue

            # Check threshold from policy
            policy = policy_map.get(entity_type, {})
            threshold = policy.get("min_observations", default_threshold)

            if evidence_count < threshold:
                continue

            # Check if discovery_candidate already exists (unique on site_id, candidate_type, proposed_slug)
            try:
                existing_candidates = await db.query(
                    "discovery_candidates",
                    params={
                        "select": "id,metrics",
                        "site_id": f"eq.{site_id}",
                        "proposed_slug": f"eq.{slug}",
                        "candidate_type": "eq.entity",
                    },
                )
            except Exception:
                existing_candidates = []

            if existing_candidates:
                # Update metrics with new evidence count
                try:
                    cand = existing_candidates[0]
                    old_metrics = cand.get("metrics") or {}
                    old_count = old_metrics.get("evidence_count", 0) or 0
                    new_count = old_count + evidence_count
                    await db.update(
                        "discovery_candidates",
                        cand["id"],
                        {
                            "metrics": {
                                **old_metrics,
                                "evidence_count": new_count,
                                "last_seen": now,
                            },
                        },
                    )
                    candidates_updated += 1
                except Exception as e:
                    logger.warning(f"Phase 3: failed to update candidate {slug}: {e}")
            else:
                # Create new candidate
                try:
                    await db.insert(
                        "discovery_candidates",
                        {
                            "site_id": site_id,
                            "candidate_type": "entity",
                            "proposed_slug": slug,
                            "proposed_data": {
                                "name": display_name,
                                "entity_type": entity_type,
                                "source": "observation_cluster",
                            },
                            "metrics": {
                                "evidence_count": evidence_count,
                                "first_seen": now,
                                "last_seen": now,
                                "source_run_id": phase1_run_id,
                            },
                            "status": "proposed",
                        },
                    )
                    candidates_created += 1
                except Exception as e:
                    logger.warning(f"Phase 3: failed to insert candidate {slug}: {e}")

        return {"candidates_created": candidates_created, "candidates_updated": candidates_updated}

    # ------------------------------------------------------------------
    # Phase 4 — Detect knowledge gaps
    # ------------------------------------------------------------------

    async def _phase4_detect_knowledge_gaps(self, site_id: str) -> dict:
        """
        Compare each entity's facts against required slots from DB.
        Returns gaps sorted by priority_score (highest first).
        """
        from datetime import datetime, timezone

        gaps_found = 0
        gap_details: list = []

        # Fetch slots for this site
        try:
            slots = await db.query("intelligence_entity_slots", params={
                "select": "entity_type,slot_name,priority,stale_after_days",
                "site_id": f"eq.{site_id}",
                "order": "priority.desc",
            })
        except Exception as e:
            logger.warning(f"Phase 4: Could not load slots: {e}")
            return {"gaps_found": 0, "gap_details": []}

        if not slots:
            logger.info("Phase 4: No slots defined — skipping gap detection")
            return {"gaps_found": 0, "gap_details": []}

        # Group slots by entity_type
        slots_by_type: dict[str, list] = {}
        for slot in slots:
            et = slot["entity_type"]
            if et not in slots_by_type:
                slots_by_type[et] = []
            slots_by_type[et].append(slot)

        # Fetch active entities
        try:
            entities = await db.query("intelligence_entities", params={
                "select": "id,name,entity_type,slug",
                "site_id": f"eq.{site_id}",
                "status": "eq.active",
            })
        except Exception:
            entities = []

        for entity in (entities or []):
            entity_type = entity.get("entity_type", "")
            required_slots = slots_by_type.get(entity_type, [])
            if not required_slots:
                continue

            # Get this entity's facts
            try:
                entity_facts = await db.query("intelligence_facts", params={
                    "select": "fact_key,category,updated_at",
                    "site_id": f"eq.{site_id}",
                    "entity_id": f"eq.{entity['id']}",
                })
            except Exception:
                entity_facts = []

            # Build set of filled slot names from fact_keys
            filled_slots = set()
            fact_dates: dict[str, str] = {}
            for f in (entity_facts or []):
                fk = f.get("fact_key", "")
                parts = fk.split(".")
                if len(parts) >= 3:
                    filled_slots.add(parts[-1])  # last part is usually the slot
                filled_slots.add(f.get("category", ""))
                # Track newest date per slot-like key
                for part in parts:
                    if f.get("updated_at"):
                        if part not in fact_dates or f["updated_at"] > fact_dates.get(part, ""):
                            fact_dates[part] = f["updated_at"]

            for slot in required_slots:
                slot_name = slot["slot_name"]
                is_missing = slot_name not in filled_slots

                # Check staleness
                is_stale = False
                if not is_missing and slot_name in fact_dates:
                    stale_days = slot.get("stale_after_days", 90)
                    try:
                        newest = fact_dates[slot_name]
                        fact_age = (datetime.now(timezone.utc) - datetime.fromisoformat(newest.replace("Z", "+00:00"))).days
                        is_stale = fact_age > stale_days
                    except Exception:
                        pass

                if is_missing or is_stale:
                    priority_score = slot.get("priority", 5) * (1.5 if is_missing else 1.0)
                    gap_details.append({
                        "entity_id": entity["id"],
                        "entity_name": entity.get("name", ""),
                        "entity_type": entity_type,
                        "missing_slot": slot_name,
                        "missing_categories": [slot_name],
                        "priority_score": round(priority_score, 1),
                        "is_stale": is_stale,
                    })
                    gaps_found += 1

        # Sort by priority (highest first)
        gap_details.sort(key=lambda g: g.get("priority_score", 0), reverse=True)
        logger.info(f"Phase 4: {gaps_found} gaps found across {len(entities or [])} entities")
        return {"gaps_found": gaps_found, "gap_details": gap_details}

    # ------------------------------------------------------------------
    # Phase 5 — Execute research for gaps
    # ------------------------------------------------------------------

    async def _phase5_execute_research(self, site_id: str, gaps: list) -> dict:
        """
        Research engine: for top-priority gaps, run real web research.
        Uses DuckDuckGo search + page reading + Haiku extraction.
        Budget-controlled: max MAX_RESEARCH_TASKS_PER_WEEK entities.
        """
        from packages.intelligence.researcher import research_entity, research_market

        if not gaps:
            return {"research_tasks_run": 0, "skipped": 0, "facts_stored": 0,
                    "total_cost": 0.0, "total_tokens": 0}

        research_tasks_run = 0
        skipped = 0
        total_facts_stored = 0
        total_cost = 0.0
        total_tokens = 0

        # Sort gaps: most missing facts first
        sorted_gaps = sorted(gaps, key=lambda g: -(g.get("missing_count") or 0))

        now = datetime.now(timezone.utc).isoformat()

        for gap in sorted_gaps:
            if research_tasks_run >= MAX_RESEARCH_TASKS_PER_WEEK:
                skipped += 1
                continue

            entity_id = gap.get("entity_id")
            entity_name = gap.get("name", "unknown")
            entity_type = gap.get("entity_type", "other")
            missing_categories = gap.get("missing_categories") or []

            if not missing_categories:
                # If no specific categories, use general list
                missing_categories = ["pricing", "positioning", "product"]

            # Create research_run row
            run_row = None
            try:
                run_row = await db.insert("research_runs", {
                    "site_id": site_id,
                    "task_type": f"gap_research_{entity_type}",
                    "trigger": "threshold",
                    "status": "running",
                    "started_at": now,
                })
            except Exception as e:
                logger.warning(f"Phase 5: failed to create research_run for {entity_name}: {e}")
                skipped += 1
                continue

            research_run_id = run_row.get("id") if run_row else None

            # Run REAL web research
            try:
                stats = await asyncio.wait_for(
                    research_entity(
                        site_id=site_id,
                        entity_id=entity_id,
                        entity_name=entity_name,
                        entity_type=entity_type,
                        missing_categories=missing_categories,
                    ),
                    timeout=60,  # 60s max per entity
                )

                total_facts_stored += stats.get("facts_stored", 0)
                total_cost += stats.get("cost", 0.0)
                total_tokens += stats.get("tokens_used", 0)

                logger.info(
                    f"Phase 5: researched {entity_name} — "
                    f"{stats.get('pages_read', 0)} pages, "
                    f"{stats.get('facts_stored', 0)} facts stored, "
                    f"${stats.get('cost', 0.0):.4f}"
                )

            except asyncio.TimeoutError:
                logger.warning(f"Phase 5: research timeout for {entity_name}")
                stats = {"error": "timeout"}
            except Exception as e:
                logger.warning(f"Phase 5: research failed for {entity_name}: {e}")
                stats = {"error": str(e)}

            # Update research_run with results
            if research_run_id:
                try:
                    await db.update("research_runs", research_run_id, {
                        "status": "completed" if "error" not in stats else "failed",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "tokens_used": stats.get("tokens_used", 0),
                        "search_calls": stats.get("queries", 0),
                        "cost_usd": stats.get("cost", 0.0),
                        "error_message": stats.get("error"),
                    })
                except Exception as e:
                    logger.warning(f"Phase 5: failed to update research_run: {e}")

            research_tasks_run += 1

        # Also run one general market research if we haven't used all budget
        if research_tasks_run < MAX_RESEARCH_TASKS_PER_WEEK:
            try:
                market_stats = await asyncio.wait_for(
                    research_market(site_id=site_id),
                    timeout=90,
                )
                total_facts_stored += market_stats.get("facts_stored", 0)
                total_cost += market_stats.get("cost", 0.0)
                total_tokens += market_stats.get("tokens_used", 0)
                logger.info(f"Phase 5: market research — {market_stats.get('facts_stored', 0)} facts")
            except Exception as e:
                logger.warning(f"Phase 5: market research failed: {e}")

        return {
            "research_tasks_run": research_tasks_run,
            "skipped": skipped,
            "facts_stored": total_facts_stored,
            "total_cost": total_cost,
            "total_tokens": total_tokens,
        }

    # ------------------------------------------------------------------
    # Phase 6 — Generate insights (ONE Haiku call total)
    # ------------------------------------------------------------------

    async def _phase6_generate_insights(self, site_id: str) -> dict:
        """
        ONE single Haiku call for the entire site.
        Gather new/changed facts from this week.
        Ask Haiku to derive 3-5 actionable insights.
        Upsert to intelligence_insights table.
        Returns {"insights_generated": N}
        """
        one_week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        try:
            recent_facts = await db.query(
                "intelligence_facts",
                params={
                    "select": "fact_key,category,value_text,value_number,value_json,confidence,tags",
                    "site_id": f"eq.{site_id}",
                    "updated_at": f"gte.{one_week_ago}",
                    "quarantined": "eq.false",
                    "order": "updated_at.desc",
                    "limit": "50",
                },
            )
        except Exception as e:
            logger.warning(f"Phase 6: failed to fetch recent facts for {site_id}: {e}")
            return {"insights_generated": 0}

        if not recent_facts:
            logger.info(f"Phase 6: no recent facts for {site_id}, skipping AI call")
            return {"insights_generated": 0}

        # Summarise facts for prompt
        facts_lines = []
        for f in recent_facts[:40]:
            val = f.get("value_text") or f.get("value_number") or f.get("value_json") or ""
            facts_lines.append(
                f"[{f.get('category','other')}] {f.get('fact_key','')}: {str(val)[:120]}"
            )

        facts_summary = "\n".join(facts_lines)

        # Single Haiku call — prompt loaded from packages/ai/prompts/intelligence_insights.py
        try:
            result = await complete(
                prompt=INSIGHTS_USER.format(facts_text=facts_summary),
                system=INSIGHTS_SYSTEM,
                model="haiku",
                json_mode=True,
                pipeline_step="intelligence_analyzer",
            )
        except Exception as e:
            logger.warning(f"Phase 6: Haiku call failed for {site_id}: {e}")
            return {"insights_generated": 0}

        parsed = result.get("parsed") or {}
        insights_list = parsed.get("insights") or []
        if not insights_list:
            return {"insights_generated": 0}

        now = datetime.now(timezone.utc).isoformat()
        insights_generated = 0

        for insight in insights_list[:5]:
            try:
                title = str(insight.get("title", "Untitled"))[:200]
                body = str(insight.get("body", insight.get("description", "")))
                # Map AI-returned type to allowed enum values
                _type_map = {
                    "risk": "threat",
                    "threat": "threat",
                    "opportunity": "opportunity",
                    "gap": "gap",
                    "trend": "trend",
                    "positioning": "positioning",
                    "recommendation": "recommendation",
                    "anomaly": "anomaly",
                }
                raw_type = insight.get("type", insight.get("insight_type", "recommendation"))
                insight_type = _type_map.get(raw_type, "recommendation")
                impact_score = min(10, max(0, float(insight.get("impact_score", 5))))

                # Let duplicate title inserts fail silently (UNIQUE constraint on site_id, title)
                try:
                    await db.insert(
                        "intelligence_insights",
                        {
                            "site_id": site_id,
                            "insight_type": insight_type,
                            "title": title,
                            "body": body,
                            "supporting_facts": [],
                            "impact_score": impact_score,
                            "status": "active",
                        },
                    )
                except Exception:
                    pass  # duplicate title — skip silently
                insights_generated += 1
            except Exception as e:
                logger.warning(f"Phase 6: failed to upsert insight '{insight.get('title')}': {e}")

        return {"insights_generated": insights_generated}

    # ------------------------------------------------------------------
    # Phase 7 — Janitor
    # ------------------------------------------------------------------

    async def _phase7_janitor(self, site_id: str) -> dict:
        """
        - rollup_observations_monthly RPC
        - Delete processed observations older than 90 days
        - Archive facts with utility_score < 0.1 (set quarantined=True)
        Returns {"observations_deleted": N, "facts_archived": N}
        """
        observations_deleted = 0
        facts_archived = 0

        # Monthly rollup
        try:
            current_month = datetime.now(timezone.utc).date().replace(day=1).isoformat()
            await db.rpc("rollup_observations_monthly", {
                "p_site_id": site_id,
                "p_month": current_month,
            })
        except Exception as e:
            logger.warning(f"Phase 7: rollup_observations_monthly failed for {site_id}: {e}")

        # Delete processed observations older than 90 days
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        try:
            old_obs = await db.query(
                "intelligence_observations",
                params={
                    "select": "id",
                    "site_id": f"eq.{site_id}",
                    "processed": "eq.true",
                    "observed_at": f"lt.{cutoff}",
                },
            )
            for obs in old_obs:
                try:
                    await db.delete("intelligence_observations", obs["id"])
                    observations_deleted += 1
                except Exception as e:
                    logger.warning(f"Phase 7: failed to delete observation {obs['id']}: {e}")
        except Exception as e:
            logger.warning(f"Phase 7: failed to query old observations for {site_id}: {e}")

        # Archive (quarantine) facts with utility_score < 0.1
        try:
            low_utility_facts = await db.query(
                "intelligence_facts",
                params={
                    "select": "id",
                    "site_id": f"eq.{site_id}",
                    "utility_score": "lt.0.1",
                    "quarantined": "eq.false",
                },
            )
            for fact in low_utility_facts:
                try:
                    await db.update(
                        "intelligence_facts",
                        fact["id"],
                        {
                            "quarantined": True,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                    facts_archived += 1
                except Exception as e:
                    logger.warning(f"Phase 7: failed to archive fact {fact['id']}: {e}")
        except Exception as e:
            logger.warning(f"Phase 7: failed to query low-utility facts for {site_id}: {e}")

        return {"observations_deleted": observations_deleted, "facts_archived": facts_archived}

    # ------------------------------------------------------------------
    # Phase 8 — Decay stale facts
    # ------------------------------------------------------------------

    async def _phase8_decay_stale_facts(self, site_id: str) -> dict:
        """
        Call decay_stale_facts RPC.
        Returns {"status": "ok"}
        """
        try:
            await db.rpc("decay_stale_facts", {"p_site_id": site_id})
        except Exception as e:
            logger.warning(f"Phase 8: decay_stale_facts failed for {site_id}: {e}")
            return {"status": "error", "error": str(e)}

        return {"status": "ok"}

    # ------------------------------------------------------------------
    # Manual trigger: phases 4 + 5 only
    # ------------------------------------------------------------------

    async def run_research_only(self, site_id: str) -> dict:
        """
        Manual trigger: run only phases 4 (detect gaps) + 5 (execute research).
        Used by POST /api/v2/intelligence/research/{site_id} endpoint.
        Returns combined summary.
        """
        summary: dict = {
            "site_id": site_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }

        gaps: list = []
        try:
            phase4_result = await asyncio.wait_for(
                self._phase4_detect_knowledge_gaps(site_id),
                timeout=PHASE_TIMEOUT,
            )
            summary["phase4"] = phase4_result
            gaps = phase4_result.get("gap_details", [])
        except Exception as e:
            logger.warning(f"run_research_only phase4 failed for {site_id}: {e}")
            summary["phase4"] = {"error": str(e)}

        try:
            phase5_result = await asyncio.wait_for(
                self._phase5_execute_research(site_id, gaps),
                timeout=PHASE5_TIMEOUT,
            )
            summary["phase5"] = phase5_result
        except Exception as e:
            logger.warning(f"run_research_only phase5 failed for {site_id}: {e}")
            summary["phase5"] = {"error": str(e)}

        summary["completed_at"] = datetime.now(timezone.utc).isoformat()
        return summary

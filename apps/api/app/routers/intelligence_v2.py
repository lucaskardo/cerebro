"""Intelligence v2 router — structured intelligence layer endpoints."""
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel
from typing import Optional, List

from packages.core import db, get_logger
from apps.api.app.middleware.auth import require_auth
from apps.api.app.schemas.intelligence_v2 import (
    EntityOut, FactOut, InsightOut, DiscoveryCandidateOut,
    DecideDiscoveryRequest, CompletenessRow, ResearchRunOut,
)
# Module-level import makes it patchable in tests
from packages.intelligence.migrate import run_migration as _run_migration

logger = get_logger("router.intelligence_v2")
router = APIRouter(tags=["Intelligence"], prefix="/api/v2/intelligence")


@router.get("/entities/{site_id}", response_model=List[EntityOut],
            dependencies=[Depends(require_auth)])
async def list_entities(
    site_id: str,
    type: Optional[str] = Query(None, description="Filter by entity_type"),
    status: Optional[str] = Query("active"),
):
    try:
        params = {
            "select": "*",
            "site_id": f"eq.{site_id}",
            "order": "entity_type.asc,name.asc",
        }
        if type:
            params["entity_type"] = f"eq.{type}"
        if status:
            params["status"] = f"eq.{status}"
        return await db.query("intelligence_entities", params=params)
    except Exception as e:
        logger.error(f"list_entities {site_id}: {e}", exc_info=True)
        return []


@router.get("/facts/{site_id}", response_model=List[FactOut],
            dependencies=[Depends(require_auth)])
async def list_facts(
    site_id: str,
    category: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    quarantined: Optional[bool] = Query(None),
    source: Optional[str] = Query(None),
    knowledge_type: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
):
    try:
        params = {
            "select": "*",
            "site_id": f"eq.{site_id}",
            "order": "utility_score.desc,confidence.desc",
            "limit": str(limit),
        }
        if category:
            params["category"] = f"eq.{category}"
        if entity_id:
            params["entity_id"] = f"eq.{entity_id}"
        if quarantined is not None:
            params["quarantined"] = f"eq.{str(quarantined).lower()}"
        if source:
            params["source"] = f"eq.{source}"
        if knowledge_type:
            params["knowledge_type"] = f"eq.{knowledge_type}"
        return await db.query("intelligence_facts", params=params)
    except Exception as e:
        logger.error(f"list_facts {site_id}: {e}", exc_info=True)
        return []


@router.get("/insights/{site_id}", response_model=List[InsightOut],
            dependencies=[Depends(require_auth)])
async def list_insights(
    site_id: str,
    status: Optional[str] = Query("active"),
    insight_type: Optional[str] = Query(None),
):
    try:
        params = {
            "select": "*",
            "site_id": f"eq.{site_id}",
            "order": "impact_score.desc",
        }
        if status:
            params["status"] = f"eq.{status}"
        if insight_type:
            params["insight_type"] = f"eq.{insight_type}"
        return await db.query("intelligence_insights", params=params)
    except Exception as e:
        logger.error(f"list_insights {site_id}: {e}", exc_info=True)
        return []


@router.get("/discoveries/{site_id}", response_model=List[DiscoveryCandidateOut],
            dependencies=[Depends(require_auth)])
async def list_discoveries(
    site_id: str,
    status: Optional[str] = Query("proposed"),
):
    try:
        params = {
            "select": "*",
            "site_id": f"eq.{site_id}",
            "order": "created_at.desc",
        }
        if status:
            params["status"] = f"eq.{status}"
        return await db.query("discovery_candidates", params=params)
    except Exception as e:
        logger.error(f"list_discoveries {site_id}: {e}", exc_info=True)
        return []


@router.post("/discoveries/{discovery_id}/decide",
             dependencies=[Depends(require_auth)])
async def decide_discovery(discovery_id: str, body: DecideDiscoveryRequest):
    try:
        candidates = await db.query("discovery_candidates", params={
            "select": "*", "id": f"eq.{discovery_id}"
        })
        if not candidates:
            return {"error": "Not found"}
        candidate = candidates[0]

        updated = await db.update("discovery_candidates", discovery_id, {
            "status": body.status,
            "decision_reason": body.reason,
            "decided_at": datetime.now(timezone.utc).isoformat(),
        })

        if body.status == "approved" and candidate.get("candidate_type") == "entity":
            proposed = candidate.get("proposed_data", {})
            entity_type = proposed.get("entity_type", "other")
            name = proposed.get("name") or candidate.get("proposed_slug", "unknown")
            slug = candidate.get("proposed_slug", "")
            site_id = candidate.get("site_id")
            if site_id and slug:
                try:
                    await db.insert("intelligence_entities", {
                        "site_id": site_id,
                        "entity_type": entity_type,
                        "name": name,
                        "slug": slug,
                        "description": proposed.get("description", "Discovered via observation cluster"),
                        "metadata": {"discovered_via": "discovery_engine", "discovery_id": discovery_id},
                        "status": "active",
                    })
                    logger.info(f"Discovery materialized: {name} ({entity_type})")
                except Exception as ent_err:
                    logger.warning(f"Entity creation failed (may exist): {ent_err}")

        return updated or {}
    except Exception as e:
        logger.error(f"decide_discovery {discovery_id}: {e}", exc_info=True)
        return {"error": str(e)}


@router.get("/completeness/{site_id}", response_model=List[CompletenessRow],
            dependencies=[Depends(require_auth)])
async def get_completeness(site_id: str):
    try:
        rows = await db.rpc("check_entity_completeness", {"p_site_id": site_id})
        return rows or []
    except Exception as e:
        logger.error(f"get_completeness {site_id}: {e}", exc_info=True)
        return []


@router.get("/research/{site_id}", response_model=List[ResearchRunOut],
            dependencies=[Depends(require_auth)])
async def list_research_runs(site_id: str, limit: int = Query(20, le=100)):
    try:
        return await db.query("research_runs", params={
            "select": "*",
            "site_id": f"eq.{site_id}",
            "order": "started_at.desc",
            "limit": str(limit),
        })
    except Exception as e:
        logger.error(f"list_research_runs {site_id}: {e}", exc_info=True)
        return []


@router.get("/facts/{site_id}/quarantined", dependencies=[Depends(require_auth)])
async def list_quarantined_facts(site_id: str, limit: int = Query(50, le=200)):
    """List quarantined facts for human review."""
    try:
        facts = await db.query("intelligence_facts", params={
            "select": "id,fact_key,category,value_text,value_number,confidence,tags,source,created_at",
            "site_id": f"eq.{site_id}",
            "quarantined": "eq.true",
            "confidence": "gt.0",
            "order": "created_at.desc",
            "limit": str(limit),
        })
        return facts or []
    except Exception as e:
        logger.error(f"quarantined facts {site_id}: {e}", exc_info=True)
        return {"error": str(e)}


@router.post("/facts/{fact_id}/approve", dependencies=[Depends(require_auth)])
async def approve_fact(fact_id: str):
    """Approve a quarantined fact — moves it to trusted."""
    try:
        result = await db.update("intelligence_facts", fact_id, {"quarantined": False})
        return result or {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@router.post("/facts/{fact_id}/reject", dependencies=[Depends(require_auth)])
async def reject_fact(fact_id: str):
    """Reject a quarantined fact — keeps it but sets confidence to 0."""
    try:
        await db.update("intelligence_facts", fact_id, {"quarantined": True, "confidence": 0.0})
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@router.post("/analyze/{site_id}", dependencies=[Depends(require_auth)])
async def run_analysis_cycle(site_id: str):
    """Manually trigger the weekly intelligence analysis cycle."""
    try:
        from packages.intelligence.analyzer import IntelligenceAnalyzer
        analyzer = IntelligenceAnalyzer()
        result = await analyzer.run_weekly_cycle(site_id)
        return {"ok": True, "result": result}
    except Exception as e:
        logger.error(f"analyze {site_id}: {e}", exc_info=True)
        return {"ok": False, "error": str(e)}


@router.post("/research/{site_id}", dependencies=[Depends(require_auth)])
async def run_research_cycle(site_id: str):
    """Manually trigger research-only cycle (phases 4+5)."""
    try:
        from packages.intelligence.analyzer import IntelligenceAnalyzer
        analyzer = IntelligenceAnalyzer()
        result = await analyzer.run_research_only(site_id)
        return {"ok": True, "result": result}
    except Exception as e:
        logger.error(f"research {site_id}: {e}", exc_info=True)
        return {"ok": False, "error": str(e)}


@router.post("/migrate/{site_id}", dependencies=[Depends(require_auth)])
async def migrate_site(site_id: str):
    """Seed structured intelligence layer from existing client_profiles + products data."""
    try:
        counts = await _run_migration(site_id)
        return {"ok": True, "counts": counts}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        logger.error(f"migration {site_id}: {e}", exc_info=True)
        return {"ok": False, "error": str(e)}


# ── Knowledge Engine endpoints ──────────────────────────────────────────────

class IngestUrlRequest(BaseModel):
    url: str
    label: Optional[str] = None


@router.post("/knowledge/cold-start/{site_id}", dependencies=[Depends(require_auth)])
async def cold_start(site_id: str, bg: BackgroundTasks):
    """Generate ~60 llm_seed facts from Haiku training data. Runs in background."""
    async def _run():
        try:
            from packages.intelligence.knowledge_engine import cold_start_knowledge
            result = await cold_start_knowledge(site_id)
            logger.info(f"cold_start {site_id}: {result}")
        except Exception as e:
            logger.error(f"cold_start {site_id}: {e}", exc_info=True)
    bg.add_task(_run)
    return {"ok": True, "message": "Cold start running in background"}


@router.post("/knowledge/ingest/{site_id}", dependencies=[Depends(require_auth)])
async def ingest_knowledge_url(site_id: str, body: IngestUrlRequest, bg: BackgroundTasks):
    """Extract authority_claim facts from an authority URL. Runs in background."""
    async def _run():
        try:
            from packages.intelligence.knowledge_engine import ingest_url
            result = await ingest_url(site_id, body.url, body.label)
            logger.info(f"ingest_url {site_id} {body.url}: {result}")
        except Exception as e:
            logger.error(f"ingest_url {site_id}: {e}", exc_info=True)
    bg.add_task(_run)
    return {"ok": True, "message": f"Ingesting {body.url} in background"}


@router.get("/knowledge/{site_id}", dependencies=[Depends(require_auth)])
async def get_knowledge_stats(site_id: str):
    """Return knowledge fact counts by type and category."""
    try:
        from packages.intelligence.knowledge_engine import get_knowledge_stats
        return await get_knowledge_stats(site_id)
    except Exception as e:
        logger.error(f"knowledge_stats {site_id}: {e}", exc_info=True)
        return {"error": str(e)}

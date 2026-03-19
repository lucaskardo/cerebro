"""Intelligence router — client profile research and retrieval."""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List

from packages.intelligence import ClientIntelligence
from packages.core import db, get_logger
from apps.api.app.middleware.auth import require_auth

logger = get_logger("router.intelligence")
router = APIRouter(tags=["Intelligence"], prefix="/api/intelligence")
_intel = ClientIntelligence()


class ResearchRequest(BaseModel):
    site_id: str
    company: str
    country: str
    company_url: Optional[str] = None
    industry: Optional[str] = None


class ProfilePatch(BaseModel):
    company_name: Optional[str] = None
    company_url: Optional[str] = None
    country: Optional[str] = None
    industry: Optional[str] = None
    value_proposition: Optional[str] = None
    brand_voice_notes: Optional[str] = None
    pain_points: Optional[List] = None
    desires: Optional[List] = None
    competitors: Optional[List] = None
    content_angles: Optional[List] = None
    customer_objections: Optional[List] = None
    buying_triggers: Optional[List] = None
    market_trends: Optional[List] = None
    key_differentiators: Optional[List] = None
    advantages: Optional[List] = None
    weaknesses: Optional[List] = None
    core_competencies: Optional[List] = None
    target_segments: Optional[List] = None
    persona_voice: Optional[dict] = None


class RefreshRequest(BaseModel):
    focus_areas: Optional[List[str]] = None


@router.post("/research", dependencies=[Depends(require_auth)])
async def run_research(req: ResearchRequest):
    """Trigger full market research for a client. Creates or updates client_profile."""
    try:
        profile = await _intel.research_client(
            site_id=req.site_id,
            company=req.company,
            country=req.country,
            company_url=req.company_url,
            industry=req.industry,
        )
        return profile
    except Exception as e:
        logger.error(f"Research failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.get("/profile/{site_id}", dependencies=[Depends(require_auth)])
async def get_profile(site_id: str):
    """Return client_profile + count of market_research entries."""
    profile = await _intel.get_profile(site_id)
    if not profile:
        raise HTTPException(404, f"No profile found for site_id={site_id}")

    research_count_rows = await db.query("market_research", params={
        "select": "id",
        "site_id": f"eq.{site_id}",
    })
    return {**profile, "research_entry_count": len(research_count_rows)}


@router.patch("/profile/{site_id}", dependencies=[Depends(require_auth)])
async def patch_profile(site_id: str, body: ProfilePatch):
    """Manually update any client_profile fields."""
    profile = await _intel.get_profile(site_id)
    if not profile:
        raise HTTPException(404, f"No profile found for site_id={site_id}")

    from datetime import datetime, timezone
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    updated = await db.update("client_profiles", profile["id"], update)
    return updated


@router.get("/research-log/{site_id}", dependencies=[Depends(require_auth)])
async def get_research_log(site_id: str, limit: int = 50):
    """Return all market_research entries ordered by created_at desc."""
    rows = await db.query("market_research", params={
        "select": "*",
        "site_id": f"eq.{site_id}",
        "order": "created_at.desc",
        "limit": str(limit),
    })
    return rows


@router.get("/performance/{site_id}", dependencies=[Depends(require_auth)])
async def get_performance(site_id: str):
    """Analyze content performance: top articles, insights, recommendations, gaps."""
    try:
        from packages.intelligence.performance_analyzer import analyze_content_performance
        return await analyze_content_performance(site_id)
    except Exception as e:
        logger.error(f"Performance analysis failed: {e}", exc_info=True)
        return {"top_performers": [], "insights": [], "recommendations": [], "content_gaps": [], "total_articles": 0, "total_leads": 0}


@router.post("/refresh/{site_id}", dependencies=[Depends(require_auth)])
async def refresh_research(site_id: str, body: RefreshRequest = None):
    """Re-run research for this site, merging new findings into existing profile."""
    try:
        profile = await _intel.refresh_research(
            site_id=site_id,
            focus_areas=body.focus_areas if body else None,
        )
        return profile
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Refresh failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))

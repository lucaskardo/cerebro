"""Content generation, review, listing, images."""
import base64
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from packages.core import db, cost_tracker, get_logger
from apps.api.app.middleware.auth import require_auth, audit

logger = get_logger("router.content")
router = APIRouter()


class ContentGenerate(BaseModel):
    mission_id: str
    keyword: str
    topic_type: str = "spoke"
    cluster_id: Optional[str] = None
    site_id: Optional[str] = None


class ContentApprove(BaseModel):
    action: str   # "approve" | "reject" | "edit"
    notes: Optional[str] = None


@router.post("/api/content/generate")
async def generate_content(req: ContentGenerate, bg: BackgroundTasks,
                            request: Request, _auth=Depends(require_auth)):
    budget = await cost_tracker.check_budget()
    if budget["blocked"]:
        raise HTTPException(429, "Daily LLM budget exceeded")

    from packages.content.pipeline import _slugify
    asset = await db.insert("content_assets", {
        "mission_id": req.mission_id,
        "title": f"[GENERATING] {req.keyword}",
        "slug": _slugify(req.keyword),
        "keyword": req.keyword,
        "status": "generating",
        "site_id": req.site_id,
    })
    if not asset:
        raise HTTPException(500, "Failed to create content asset")

    bg.add_task(_run_pipeline_bg, req.keyword, req.mission_id, asset["id"], req.site_id)
    await audit(request, "generate_content", "content_assets", asset["id"],
                {"keyword": req.keyword, "site_id": req.site_id})
    return {"asset_id": asset["id"], "status": "generating", "keyword": req.keyword}


async def _run_pipeline_bg(keyword: str, mission_id: str, asset_id: str, site_id: str = None):
    from packages.content.pipeline import run_pipeline
    try:
        await run_pipeline(keyword, mission_id, asset_id, site_id=site_id)
    except Exception as e:
        logger.error(f"Background pipeline failed: {e}")


@router.get("/api/content")
async def list_content(status: Optional[str] = None, limit: int = 50,
                       site_id: Optional[str] = None):
    params = {
        "select": "id,title,slug,keyword,status,site_id,quality_score,humanization_score,created_at,updated_at",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if status:
        params["status"] = f"eq.{status}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return await db.query("content_assets", params=params)


@router.get("/api/content/by-slug/{slug}")
async def get_content_by_slug(slug: str):
    results = await db.query("content_assets", params={
        "select": "*", "slug": f"eq.{slug}", "status": "eq.approved"
    })
    if not results:
        results = await db.query("content_assets", params={
            "select": "*", "slug": f"eq.{slug}", "status": "in.(review,approved)"
        })
    if not results:
        raise HTTPException(404, "Article not found")
    return results[0]


@router.get("/api/content/{aid}")
async def get_content(aid: str):
    a = await db.get_by_id("content_assets", aid)
    if not a:
        raise HTTPException(404, "Content not found")
    return a


@router.get("/api/content/{aid}/image")
async def get_content_image(aid: str, style: str = "financial"):
    a = await db.get_by_id("content_assets", aid)
    if not a:
        raise HTTPException(404, "Content not found")
    from packages.images import generate_hero_image
    result = await generate_hero_image(
        keyword=a.get("keyword", ""),
        title=a.get("title", ""),
        asset_id=aid,
        style=style,
    )
    if result["type"] == "svg":
        return Response(content=result["data"], media_type="image/svg+xml")
    return Response(content=base64.b64decode(result["data"]), media_type="image/jpeg")


@router.post("/api/content/{aid}/review")
async def review_content(aid: str, action: ContentApprove,
                          request: Request, _auth=Depends(require_auth)):
    a = await db.get_by_id("content_assets", aid)
    if not a:
        raise HTTPException(404, "Content not found")

    if action.action == "approve":
        await db.update("content_assets", aid, {"status": "approved"})
        logger.info(f"Content approved: {a['title']}")
    elif action.action == "reject":
        await db.update("content_assets", aid, {"status": "draft"})

    await audit(request, f"content_{action.action}", "content_assets", aid,
                {"title": a.get("title"), "notes": action.notes})
    return {"status": action.action}

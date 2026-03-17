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


async def _generate_social_drafts_bg(asset_id: str, site_id: str):
    from packages.skills.social_adapter import generate_social_drafts
    try:
        result = await generate_social_drafts(asset_id, site_id)
        logger.info(f"Social drafts generated: {result}")
    except Exception as e:
        logger.error(f"Social draft generation failed for {asset_id}: {e}")


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
async def review_content(aid: str, action: ContentApprove, bg: BackgroundTasks,
                          request: Request, _auth=Depends(require_auth)):
    a = await db.get_by_id("content_assets", aid)
    if not a:
        raise HTTPException(404, "Content not found")

    if action.action == "approve":
        # 1. Save current body_md as a content version
        await _save_content_version(a)

        # 2. Create CTA variants (hero, mid, end, sidebar)
        await _create_cta_variants(a)

        # 3. Inject internal links into body_html
        if a.get("body_html") and a.get("site_id"):
            updated_html = await _inject_internal_links(a["body_html"], a["site_id"], aid)
            if updated_html != a.get("body_html"):
                await db.update("content_assets", aid, {"body_html": updated_html})

        await db.update("content_assets", aid, {"status": "approved"})
        logger.info(f"Content approved: {a['title']}")

        # Trigger social draft generation in background
        if a.get("site_id"):
            bg.add_task(_generate_social_drafts_bg, aid, a["site_id"])

    elif action.action == "reject":
        await db.update("content_assets", aid, {"status": "draft"})

    await audit(request, f"content_{action.action}", "content_assets", aid,
                {"title": a.get("title"), "notes": action.notes})
    return {"status": action.action}


# ─── Approval helpers ─────────────────────────────────────────────────────────

async def _save_content_version(asset: dict):
    """Save current body_md as next version in content_versions."""
    try:
        existing = await db.query("content_versions", params={
            "select": "version_number",
            "asset_id": f"eq.{asset['id']}",
            "order": "version_number.desc",
            "limit": "1",
        })
        next_v = (existing[0]["version_number"] + 1) if existing else 1
        await db.insert("content_versions", {
            "asset_id": asset["id"],
            "site_id": asset.get("site_id"),
            "version_number": next_v,
            "body_md": asset.get("body_md", ""),
            "changed_by": "operator",
        })
    except Exception as e:
        logger.warning(f"content_versions insert failed: {e}")


async def _create_cta_variants(asset: dict):
    """Create one CTA variant per position (hero/mid/end/sidebar)."""
    try:
        site = None
        if asset.get("site_id"):
            site = await db.get_by_id("domain_sites", asset["site_id"])
        cta_cfg = (site.get("brand_cta") or {}) if site else {}
        primary = cta_cfg.get("primary") or "Recibe la guía gratis"
        secondary = cta_cfg.get("secondary") or "Suscríbete"

        cta_map = {
            "hero": primary,
            "mid": primary,
            "end": secondary,
            "sidebar": primary,
        }
        for position, text in cta_map.items():
            await db.insert("cta_variants", {
                "asset_id": asset["id"],
                "site_id": asset.get("site_id"),
                "position": position,
                "text": text,
                "url": "#email-capture",
                "variant_name": f"{position}-v1",
            })
    except Exception as e:
        logger.warning(f"cta_variants insert failed: {e}")


async def _inject_internal_links(body_html: str, site_id: str, exclude_asset_id: str) -> str:
    """
    Append an internal links section to body_html on approval.
    Injects 3-5 same-brand links + up to 2 cross-brand links.
    """
    try:
        # Same-brand approved articles
        same_brand = await db.query("content_assets", params={
            "select": "id,title,slug,keyword",
            "site_id": f"eq.{site_id}",
            "status": "eq.approved",
            "id": f"neq.{exclude_asset_id}",
            "order": "created_at.desc",
            "limit": "5",
        })

        # Cross-brand (different site) approved articles
        cross_brand = await db.query("content_assets", params={
            "select": "id,title,slug,keyword",
            "site_id": f"neq.{site_id}",
            "status": "eq.approved",
            "order": "created_at.desc",
            "limit": "2",
        })

        links = [*same_brand[:5], *cross_brand[:2]]
        if not links:
            return body_html

        items = "\n".join(
            f'  <li><a href="/articulo/{a["slug"]}">{a["title"]}</a></li>'
            for a in links if a.get("slug") and a.get("title")
        )
        if not items:
            return body_html

        section = (
            '\n<section class="internal-links" style="margin-top:2rem;padding-top:1.5rem;'
            'border-top:1px solid #334155">'
            "\n<h3>Artículos relacionados</h3>"
            f"\n<ul>\n{items}\n</ul>"
            "\n</section>"
        )
        return body_html + section
    except Exception as e:
        logger.warning(f"internal linking failed: {e}")
        return body_html

"""
CEREBRO v7 — Content Pipeline
keyword → brief → draft → humanize → validate → publish
"""
import json
import uuid
from packages.core import db, get_logger, create_alert
from packages.ai import complete, BudgetExceededError
from packages.ai.prompts import content_prompts as prompts
from packages.content.seo_rules import validate_seo

logger = get_logger("content.pipeline")


async def run_pipeline(keyword: str, mission_id: str, asset_id: str = None) -> dict:
    """Execute the full content pipeline for a keyword.
    
    Returns the final content_asset record.
    """
    run_id = str(uuid.uuid4())[:8]
    logger.info(f"[{run_id}] Starting pipeline for: {keyword}")
    
    # Get mission
    mission = await db.get_by_id("missions", mission_id)
    if not mission:
        raise ValueError(f"Mission not found: {mission_id}")
    
    # Create or get asset
    if not asset_id:
        asset = await db.insert("content_assets", {
            "mission_id": mission_id,
            "title": f"[GENERATING] {keyword}",
            "slug": _slugify(keyword),
            "keyword": keyword,
            "status": "generating",
        })
        asset_id = asset["id"]
    else:
        await db.update("content_assets", asset_id, {"status": "generating"})
    
    try:
        # STEP 1: Brief
        logger.info(f"[{run_id}] Step 1/4: Generating brief...")
        brief = await _generate_brief(keyword, mission, run_id)
        await db.update("content_assets", asset_id, {"brief": brief})
        
        # STEP 2: Draft
        logger.info(f"[{run_id}] Step 2/4: Writing draft...")
        draft = await _generate_draft(brief, mission, run_id)
        await db.update("content_assets", asset_id, {
            "title": draft.get("title", keyword),
            "meta_description": draft.get("meta_description", ""),
            "outline": draft.get("outline", {}),
            "body_md": draft.get("body_md", ""),
            "faq_section": draft.get("faq_section", []),
            "data_claims": draft.get("data_claims", []),
            "partner_mentions": draft.get("partner_mentions", []),
        })
        
        # STEP 3: Humanize
        logger.info(f"[{run_id}] Step 3/4: Humanizing...")
        humanized = await _humanize(draft, mission, run_id)
        await db.update("content_assets", asset_id, {
            "title": humanized.get("title", draft.get("title")),
            "body_md": humanized.get("body_md", draft.get("body_md")),
            "body_html": humanized.get("body_html", ""),
            "humanization_score": humanized.get("humanization_score", 0),
        })
        
        # STEP 4: Validate
        logger.info(f"[{run_id}] Step 4/4: Validating...")
        validation = _validate(humanized, keyword, mission)
        
        status = "review" if validation["passed"] else "draft"
        await db.update("content_assets", asset_id, {
            "quality_score": validation["quality_score"],
            "validation_results": validation,
            "status": status,
        })
        
        logger.info(f"[{run_id}] Pipeline complete: {status} (quality={validation['quality_score']})")
        
        # Alert operator
        await create_alert(
            "content_ready" if status == "review" else "content_needs_work",
            f"'{humanized.get('title', keyword)}' → {status} (score: {validation['quality_score']})",
            severity="info" if status == "review" else "warning",
            action_url=f"/dashboard/content/{asset_id}",
            action_label="Revisar" if status == "review" else "Editar",
        )
        
        return await db.get_by_id("content_assets", asset_id)
    
    except BudgetExceededError as e:
        logger.error(f"[{run_id}] Budget exceeded: {e}")
        await db.update("content_assets", asset_id, {
            "status": "error",
            "error_message": "Presupuesto diario LLM agotado",
        })
        await create_alert("budget_exceeded", str(e), severity="critical")
        raise
    
    except Exception as e:
        logger.error(f"[{run_id}] Pipeline error: {e}", exc_info=True)
        await db.update("content_assets", asset_id, {
            "status": "error",
            "error_message": str(e)[:500],
        })
        await create_alert("pipeline_error", f"Error en pipeline '{keyword}': {str(e)[:200]}", severity="critical")
        raise


async def _generate_brief(keyword: str, mission: dict, run_id: str) -> dict:
    result = await complete(
        prompt=prompts.BRIEF_USER.format(
            keyword=keyword,
            country=mission.get("country", "Colombia"),
            partner_name=mission.get("partner_name", ""),
            target_audience=json.dumps(mission.get("target_audience", {}), ensure_ascii=False),
            core_topics=json.dumps(mission.get("core_topics", []), ensure_ascii=False),
            cta_config=json.dumps(mission.get("cta_config", {}), ensure_ascii=False),
        ),
        system=prompts.BRIEF_SYSTEM,
        model="haiku",
        json_mode=True,
        pipeline_step="brief",
        run_id=run_id,
    )
    return result["parsed"] or {"title_suggestions": [keyword], "h2_sections": [], "key_points": []}


async def _generate_draft(brief: dict, mission: dict, run_id: str) -> dict:
    titles = brief.get("title_suggestions", [""])
    title = titles[0] if isinstance(titles, list) and titles else str(titles)
    
    result = await complete(
        prompt=prompts.DRAFT_USER.format(
            title=title,
            h2_sections=json.dumps(brief.get("h2_sections", []), ensure_ascii=False),
            key_points=json.dumps(brief.get("key_points", []), ensure_ascii=False),
            faq_questions=json.dumps(brief.get("faq_questions", []), ensure_ascii=False),
            data_points_needed=json.dumps(brief.get("data_points_needed", []), ensure_ascii=False),
            cta_placement=brief.get("cta_placement", "natural"),
            first_paragraph_hook=brief.get("first_paragraph_hook", ""),
            target_word_count=brief.get("target_word_count", 1500),
        ),
        system=prompts.DRAFT_SYSTEM.format(partner_name=mission.get("partner_name", "ikigii")),
        model="sonnet",
        max_tokens=4096,
        json_mode=True,
        pipeline_step="draft",
        run_id=run_id,
    )
    return result["parsed"] or {"title": title, "body_md": result["text"]}


async def _humanize(draft: dict, mission: dict, run_id: str) -> dict:
    result = await complete(
        prompt=prompts.HUMANIZE_USER.format(
            title=draft.get("title", ""),
            body_md=draft.get("body_md", "")[:6000],  # Limit for context window
        ),
        system=prompts.HUMANIZE_SYSTEM,
        model="haiku",
        max_tokens=4096,
        json_mode=True,
        pipeline_step="humanize",
        run_id=run_id,
    )
    parsed = result["parsed"] or {}
    # Preserve structured data from draft
    parsed.setdefault("faq_section", draft.get("faq_section", []))
    parsed.setdefault("data_claims", draft.get("data_claims", []))
    parsed.setdefault("meta_description", draft.get("meta_description", ""))
    return parsed


def _validate(content: dict, keyword: str, mission: dict) -> dict:
    """Rule-based validation. No LLM needed."""
    body = content.get("body_md", "")
    title = content.get("title", "")
    partner = mission.get("partner_name", "")
    
    checks = {
        "has_title": bool(title.strip()),
        "title_has_keyword": any(w in title.lower() for w in keyword.lower().split()[:3]),
        "word_count_ok": 800 <= len(body.split()) <= 5000,
        "has_h2": body.count("## ") >= 3,
        "has_faq": bool(content.get("faq_section")),
        "has_meta": len(content.get("meta_description", "")) >= 80,
        "partner_mentioned": partner.lower() in body.lower() if partner else True,
        "partner_not_spammy": body.lower().count(partner.lower()) <= 3 if partner else True,
        "no_unverified": "[VERIFICAR]" not in body and "[TODO]" not in body,
        "has_html": bool(content.get("body_html", "").strip()),
    }
    
    # Brand safety
    blacklist = ["estafa", "scam", "piramide", "fraude", "ilegal", "lavado"]
    brand_safe = not any(term in body.lower() for term in blacklist)
    checks["brand_safe"] = brand_safe
    
    # SEO validation
    seo = validate_seo(content)
    checks["seo_passed"] = seo["passed"]
    
    score = round(sum(1 for v in checks.values() if v) / len(checks) * 100, 1)
    
    return {
        "passed": score >= 70 and brand_safe,
        "quality_score": score,
        "humanization_score": content.get("humanization_score", 50),
        "word_count": len(body.split()),
        "checks": checks,
        "seo": seo,
        "issues": [k for k, v in checks.items() if not v],
    }


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    import re
    replacements = {"á":"a","é":"e","í":"i","ó":"o","ú":"u","ñ":"n","ü":"u"}
    slug = text.lower()
    for k, v in replacements.items():
        slug = slug.replace(k, v)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug.strip())
    slug = re.sub(r'-+', '-', slug)
    return slug[:80]

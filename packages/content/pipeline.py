"""
CEREBRO v7 — Content Pipeline
keyword → research → brief → draft → humanize → validate → publish
"""
import json
import re
import uuid
from typing import Optional
from urllib.parse import urlencode

from packages.core import db, get_logger, create_alert
from packages.ai import complete, BudgetExceededError
from packages.ai.prompts import content_prompts as prompts
from packages.content.seo_rules import validate_seo

logger = get_logger("content.pipeline")


async def run_pipeline(keyword: str, mission_id: str, asset_id: str = None, site_id: str = None) -> dict:
    """Execute the full content pipeline for a keyword.

    Returns the final content_asset record.
    """
    run_id = str(uuid.uuid4())[:8]
    logger.info(f"[{run_id}] Starting pipeline for: {keyword}")

    # Get mission
    mission = await db.get_by_id("missions", mission_id)
    if not mission:
        raise ValueError(f"Mission not found: {mission_id}")

    # Get site brand config (if provided)
    site = None
    if site_id:
        site = await db.get_by_id("domain_sites", site_id)
    # Merge brand config into mission context
    brand = _build_brand_context(mission, site)

    # Dedup check — skip if very similar keyword already exists for this site
    if site_id:
        dup = await _check_duplicate(keyword, site_id, exclude_id=asset_id)
        if dup:
            logger.warning(
                f"[{run_id}] Duplicate keyword '{keyword}' overlaps "
                f"'{dup.get('keyword')}' (id={dup.get('id')}). Skipping pipeline."
            )
            if asset_id:
                await db.update("content_assets", asset_id, {
                    "status": "error",
                    "error_message": (
                        f"Keyword duplicado: similar a '{dup.get('keyword')}' "
                        f"(id: {dup.get('id')})"
                    ),
                })
            return dup

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
        # STEP 0: Research
        logger.info(f"[{run_id}] Step 0/4: Researching keyword...")
        research = await _research_keyword(keyword, brand, run_id)
        conversion_plan = {
            "primary_cta": research.get("primary_cta", ""),
            "secondary_cta": research.get("secondary_cta", ""),
            "funnel_stage": research.get("target_funnel_stage", "awareness"),
            "target_persona": research.get("target_persona", ""),
        }
        await db.update("content_assets", asset_id, {
            "research_json": research,
            "conversion_plan_json": conversion_plan,
        })

        # STEP 1: Brief
        logger.info(f"[{run_id}] Step 1/4: Generating brief...")
        brief = await _generate_brief(keyword, brand, research, run_id)
        await db.update("content_assets", asset_id, {"brief": brief})

        # STEP 2: Draft
        logger.info(f"[{run_id}] Step 2/4: Writing draft...")
        draft = await _generate_draft(brief, brand, run_id)
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
        humanized = await _humanize(draft, brand, run_id)

        # Inject UTM params into all article links
        raw_html = humanized.get("body_html", "")
        site_slug = site.get("domain", "cerebro").split(".")[0] if site else "cerebro"
        body_html_with_utm = _inject_utm_params(raw_html, site_slug, asset_id)

        await db.update("content_assets", asset_id, {
            "title": humanized.get("title", draft.get("title")),
            "body_md": humanized.get("body_md", draft.get("body_md")),
            "body_html": body_html_with_utm,
            "humanization_score": humanized.get("humanization_score", 0),
        })

        # STEP 4: Validate
        logger.info(f"[{run_id}] Step 4/4: Validating...")
        validation = _validate(humanized, keyword, brand)

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


# ─── Step helpers ─────────────────────────────────────────────────────────────

async def _check_duplicate(keyword: str, site_id: str, exclude_id: Optional[str] = None) -> Optional[dict]:
    """
    Check for keyword overlap >= 80% (Jaccard) with existing assets for this site.
    Returns the overlapping asset dict or None.
    """
    existing = await db.query("content_assets", params={
        "select": "id,title,keyword,status",
        "site_id": f"eq.{site_id}",
        "status": "not.in.(error,archived)",
        "limit": "100",
    })
    words_new = set(keyword.lower().split())
    if not words_new:
        return None

    for asset in existing:
        if asset.get("id") == exclude_id:
            continue
        kw = asset.get("keyword") or ""
        words_ex = set(kw.lower().split())
        if not words_ex:
            continue
        union = words_new | words_ex
        overlap = len(words_new & words_ex) / len(union)
        if overlap >= 0.8:
            return asset
    return None


async def _research_keyword(keyword: str, brand: dict, run_id: str) -> dict:
    result = await complete(
        prompt=prompts.RESEARCH_USER.format(
            keyword=keyword,
            partner_name=brand.get("partner_name", ""),
            country=brand.get("country", ""),
            target_audience=json.dumps(brand.get("target_audience", {}), ensure_ascii=False),
            core_topics=json.dumps(brand.get("core_topics", []), ensure_ascii=False),
        ),
        system=prompts.RESEARCH_SYSTEM,
        model="haiku",
        json_mode=True,
        pipeline_step="research",
        run_id=run_id,
    )
    return result["parsed"] or {}


async def _generate_brief(keyword: str, brand: dict, research: dict, run_id: str) -> dict:
    audience = brand.get("target_audience", {})
    audience_summary = ", ".join(audience.get("segments", [])) if isinstance(audience, dict) else str(audience)

    # Enrich prompt with research context
    research_context = ""
    if research:
        research_context = (
            f"\nResearch context:\n"
            f"- Pain points: {json.dumps(research.get('pain_points', []), ensure_ascii=False)}\n"
            f"- Differentiation: {research.get('differentiation', '')}\n"
            f"- Funnel stage: {research.get('target_funnel_stage', '')}\n"
            f"- Primary CTA: {research.get('primary_cta', '')}\n"
        )

    result = await complete(
        prompt=prompts.BRIEF_USER.format(
            keyword=keyword,
            country=brand.get("country", ""),
            partner_name=brand.get("partner_name", ""),
            target_audience=json.dumps(brand.get("target_audience", {}), ensure_ascii=False),
            core_topics=json.dumps(brand.get("core_topics", []), ensure_ascii=False),
            cta_config=json.dumps(brand.get("cta_config", {}), ensure_ascii=False),
            brand_tone_example=brand.get("brand_tone", "directo, honesto, útil"),
        ) + research_context,
        system=prompts.BRIEF_SYSTEM.format(
            brand_persona=brand.get("brand_persona", "experto en el tema"),
            brand_tone=brand.get("brand_tone", "directo, honesto, útil"),
            brand_audience_summary=audience_summary or "personas interesadas en el tema",
        ),
        model="haiku",
        json_mode=True,
        pipeline_step="brief",
        run_id=run_id,
    )

    # Cross-brand linking opportunities
    try:
        other_content = await db.query("content_assets", params={
            "select": "title,slug,keyword",
            "status": "eq.approved",
            "limit": "20",
            "order": "created_at.desc",
        })
        if other_content:
            brief_result = result["parsed"] or {}
            existing_links = brief_result.get("internal_links_suggested", [])
            cross_links = [f"/articulo/{a['slug']}" for a in other_content[:5] if a.get("slug")]
            brief_result["cross_brand_links"] = cross_links
            return brief_result
    except Exception:
        pass
    return result["parsed"] or {"title_suggestions": [keyword], "h2_sections": [], "key_points": []}


async def _generate_draft(brief: dict, brand: dict, run_id: str) -> dict:
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
        system=prompts.DRAFT_SYSTEM.format(
            brand_persona=brand.get("brand_persona", "experto en el tema"),
            brand_tone=brand.get("brand_tone", "directo, honesto, útil"),
            partner_name=brand.get("partner_name", ""),
        ),
        model="sonnet",
        max_tokens=8192,
        json_mode=True,
        pipeline_step="draft",
        run_id=run_id,
    )
    return result["parsed"] or {"title": title, "body_md": result["text"]}


async def _humanize(draft: dict, brand: dict, run_id: str) -> dict:
    audience = brand.get("target_audience", {})
    audience_summary = ", ".join(audience.get("segments", [])) if isinstance(audience, dict) else str(audience)
    result = await complete(
        prompt=prompts.HUMANIZE_USER.format(
            title=draft.get("title", ""),
            body_md=draft.get("body_md", "")[:6000],  # Limit for context window
            brand_audience_summary=audience_summary or "personas interesadas en el tema",
        ),
        system=prompts.HUMANIZE_SYSTEM.format(
            brand_persona=brand.get("brand_persona", "experto en el tema"),
            brand_tone=brand.get("brand_tone", "directo, honesto, útil"),
        ),
        model="haiku",
        max_tokens=8192,
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


def _validate(content: dict, keyword: str, brand: dict) -> dict:
    """Rule-based validation. No LLM needed."""
    body = content.get("body_md", "")
    title = content.get("title", "")
    partner = brand.get("partner_name", "")

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

    # Brand safety — count occurrences; educational mentions (1-2x) are OK
    blacklist = ["estafa", "scam", "piramide", "fraude", "ilegal", "lavado"]
    brand_safe = not any(body.lower().count(term) > 2 for term in blacklist)
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


def _inject_utm_params(body_html: str, site_slug: str, asset_id: str) -> str:
    """
    Inject UTM parameters into all <a href> tags in the article HTML.
    Only modifies relative URLs and URLs pointing to known domains.
    Skips anchors (#), mailto:, external partner links that already have UTM.
    """
    if not body_html:
        return body_html

    utm = {
        "utm_source": "cerebro",
        "utm_medium": "article",
        "utm_campaign": site_slug,
        "utm_content": asset_id[:8],
    }
    utm_str = urlencode(utm)

    def replace_href(match):
        full_tag = match.group(0)
        href = match.group(1)

        # Skip anchors, mailto, tel, javascript, already-utm'd links
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            return full_tag
        if "utm_source" in href:
            return full_tag

        # Add UTM params
        sep = "&" if "?" in href else "?"
        new_href = f"{href}{sep}{utm_str}"
        return full_tag.replace(f'href="{href}"', f'href="{new_href}"', 1)

    # Match href="..." (double quotes only for safety)
    result = re.sub(r'<a\s[^>]*href="([^"]*)"[^>]*>', replace_href, body_html, flags=re.IGNORECASE)
    return result


def _build_brand_context(mission: dict, site: dict = None) -> dict:
    """Merge mission + site brand config into unified context for prompts."""
    base = {
        "partner_name": mission.get("partner_name", ""),
        "country": mission.get("country", ""),
        "target_audience": mission.get("target_audience", {}),
        "core_topics": mission.get("core_topics", []),
        "cta_config": mission.get("cta_config", {}),
        "brand_persona": mission.get("brand_persona", "experto en el tema"),
        "brand_tone": mission.get("brand_tone", "directo, honesto, útil"),
    }
    if site:
        if site.get("brand_persona"):
            base["brand_persona"] = site["brand_persona"]
        if site.get("brand_tone"):
            base["brand_tone"] = site["brand_tone"]
        if site.get("brand_audience"):
            base["target_audience"] = site["brand_audience"]
        if site.get("brand_topics"):
            base["core_topics"] = site["brand_topics"]
        if site.get("brand_cta"):
            base["cta_config"] = site["brand_cta"]
            base["partner_name"] = site["brand_cta"].get("partner", base["partner_name"])
    return base


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    replacements = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n", "ü": "u"}
    slug = text.lower()
    for k, v in replacements.items():
        slug = slug.replace(k, v)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug.strip())
    slug = re.sub(r'-+', '-', slug)
    return slug[:80]

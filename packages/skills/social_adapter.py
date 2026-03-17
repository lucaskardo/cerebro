"""
Social Adapter Skill — Bloque 5
When an article is approved, auto-generate draft social posts for each active persona
platform and create approval entries for each.
"""
import json
from packages.core import db, get_logger
from packages.ai import ai_client

logger = get_logger("skill.social_adapter")

_PLATFORM_PROMPT_MAP = {
    "instagram": ("INSTAGRAM_ADAPT", "carousel"),
    "tiktok":    ("TIKTOK_ADAPT",    "video_script"),
    "x":         ("TWITTER_ADAPT",   "thread"),
    "reddit":    ("REDDIT_ADAPT",    "post"),
    "linkedin":  ("LINKEDIN_ADAPT",  "post"),
    "whatsapp":  ("WHATSAPP_ADAPT",  "snippet"),
}

# Reddit always requires_approval (never auto-post)
_ALWAYS_REQUIRES_APPROVAL = {"reddit"}


async def generate_social_drafts(asset_id: str, site_id: str) -> dict:
    """
    Generate social drafts for all active personas of a site.
    Returns counts of drafts created and approvals queued.
    """
    from packages.ai.prompts.content_prompts import (
        SOCIAL_SYSTEM,
        TIKTOK_ADAPT, INSTAGRAM_ADAPT, TWITTER_ADAPT,
        LINKEDIN_ADAPT, REDDIT_ADAPT, WHATSAPP_ADAPT,
    )
    _PROMPTS = {
        "TIKTOK_ADAPT": TIKTOK_ADAPT,
        "INSTAGRAM_ADAPT": INSTAGRAM_ADAPT,
        "TWITTER_ADAPT": TWITTER_ADAPT,
        "LINKEDIN_ADAPT": LINKEDIN_ADAPT,
        "REDDIT_ADAPT": REDDIT_ADAPT,
        "WHATSAPP_ADAPT": WHATSAPP_ADAPT,
    }

    asset = await db.get_by_id("content_assets", asset_id)
    if not asset:
        logger.warning(f"social_adapter: asset {asset_id} not found")
        return {"drafts_created": 0, "approvals_queued": 0}

    site = await db.get_by_id("domain_sites", site_id) if site_id else None
    brand_tone = (site.get("brand_tone") or "cercano y profesional") if site else "cercano y profesional"
    article_url = _build_article_url(asset, site)

    # Build article summary from asset
    title = asset.get("title", "")
    body_md = asset.get("body_md", "") or ""
    summary = body_md[:400].replace("\n", " ").strip()
    # Try to extract key points from brief
    brief = asset.get("brief") or {}
    if isinstance(brief, str):
        try:
            brief = json.loads(brief)
        except Exception:
            brief = {}
    key_points = brief.get("key_points") or []
    key_points_str = "\n".join(f"- {p}" for p in key_points[:5]) if key_points else summary[:200]

    # Get active personas for this site
    personas = await db.query("personas", params={
        "select": "id,name,platforms",
        "site_id": f"eq.{site_id}",
        "status": "eq.active",
    })

    if not personas:
        logger.info(f"social_adapter: no active personas for site {site_id}")
        return {"drafts_created": 0, "approvals_queued": 0}

    drafts_created = 0
    approvals_queued = 0

    for persona in personas:
        persona_id = persona["id"]
        persona_name = persona.get("name", "Persona")
        # Platforms this persona is configured for (stored as JSONB list or dict keys)
        platforms_cfg = persona.get("platforms") or {}
        active_platforms = list(platforms_cfg.keys()) if isinstance(platforms_cfg, dict) else list(platforms_cfg)
        if not active_platforms:
            # fallback: use all known social platforms
            active_platforms = [p for p in _PLATFORM_PROMPT_MAP if p != "email" and p != "whatsapp"]

        for platform in active_platforms:
            if platform not in _PLATFORM_PROMPT_MAP:
                continue

            prompt_key, content_type = _PLATFORM_PROMPT_MAP[platform]
            prompt_template = _PROMPTS.get(prompt_key)
            if not prompt_template:
                continue

            try:
                system_prompt = SOCIAL_SYSTEM.format(
                    persona_name=persona_name,
                    brand_tone=brand_tone,
                    platform=platform,
                )
                user_prompt = prompt_template.format(
                    title=title,
                    summary=summary,
                    key_points=key_points_str,
                    article_url=article_url,
                )

                response = await ai_client.complete(
                    system=system_prompt,
                    user=user_prompt,
                    model="haiku",
                    max_tokens=1200,
                )
                content_text = _extract_text(response, platform)

                queue_item = await db.insert("social_content_queue", {
                    "content_asset_id": asset_id,
                    "site_id": site_id,
                    "persona_id": persona_id,
                    "platform": platform,
                    "content_type": content_type,
                    "content_text": content_text,
                    "status": "draft",
                })
                if not queue_item:
                    continue
                drafts_created += 1

                # Every social draft needs approval before posting
                await db.insert("approvals", {
                    "site_id": site_id,
                    "entity_type": "social_post",
                    "entity_id": queue_item["id"],
                    "action": f"publish_to_{platform}",
                    "requested_by": "social_adapter",
                    "status": "pending",
                    "notes": f"{persona_name} · {platform} · {title[:60]}",
                })
                approvals_queued += 1

            except Exception as e:
                logger.error(f"social_adapter: {platform}/{persona_name} failed: {e}")

    logger.info(
        f"social_adapter: asset={asset_id} → {drafts_created} drafts, {approvals_queued} approvals"
    )
    return {"drafts_created": drafts_created, "approvals_queued": approvals_queued}


def _build_article_url(asset: dict, site: dict | None) -> str:
    slug = asset.get("slug", "")
    domain = site.get("domain", "") if site else ""
    if domain:
        return f"https://{domain}/articulo/{slug}"
    return f"/articulo/{slug}"


def _extract_text(response: dict, platform: str) -> str:
    """Extract the canonical text field from LLM JSON response for each platform."""
    try:
        data = response if isinstance(response, dict) else {}
        if platform == "instagram":
            slides = data.get("slides", [])
            caption = data.get("caption", "")
            parts = [f"[Slide {s.get('slide', i+1)}] {s.get('text', '')}" for i, s in enumerate(slides)]
            return "\n".join(parts) + (f"\n\nCaption: {caption}" if caption else "")
        if platform == "tiktok":
            return data.get("script") or data.get("hook", "") + "\n" + data.get("cta", "")
        if platform == "x":
            tweets = data.get("tweets", [])
            return "\n---\n".join(tweets)
        if platform == "linkedin":
            return data.get("post_text", "")
        if platform == "reddit":
            return f"r/{data.get('subreddit_suggestions', ['colombia'])[0]}\n\n{data.get('title','')}\n\n{data.get('body','')}"
        if platform == "whatsapp":
            return data.get("message", "")
    except Exception:
        pass
    # fallback: raw JSON string
    try:
        return json.dumps(response, ensure_ascii=False)
    except Exception:
        return str(response)

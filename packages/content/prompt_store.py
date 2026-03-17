"""
Prompt version store.
Fetches active prompt templates from DB; falls back to hardcoded on failure.
Seeded once at startup. Pipeline always uses is_active=true version.
"""
from packages.core import db, get_logger
from packages.ai.prompts import content_prompts

logger = get_logger("content.prompt_store")

# In-memory cache: {prompt_name: template_str}
_cache: dict[str, str] = {}

_HARDCODED: dict[str, str] = {
    "RESEARCH_SYSTEM": content_prompts.RESEARCH_SYSTEM,
    "RESEARCH_USER": content_prompts.RESEARCH_USER,
    "BRIEF_SYSTEM": content_prompts.BRIEF_SYSTEM,
    "BRIEF_USER": content_prompts.BRIEF_USER,
    "DRAFT_SYSTEM": content_prompts.DRAFT_SYSTEM,
    "DRAFT_USER": content_prompts.DRAFT_USER,
    "HUMANIZE_SYSTEM": content_prompts.HUMANIZE_SYSTEM,
    "HUMANIZE_USER": content_prompts.HUMANIZE_USER,
}


async def get_prompt(name: str) -> str:
    """Get active template. Tries DB first, falls back to hardcoded."""
    if name in _cache:
        return _cache[name]
    try:
        rows = await db.query("prompt_versions", params={
            "select": "template",
            "prompt_name": f"eq.{name}",
            "is_active": "eq.true",
            "order": "version.desc",
            "limit": "1",
        })
        if rows:
            _cache[name] = rows[0]["template"]
            return _cache[name]
    except Exception as e:
        logger.warning(f"prompt_store: DB fetch failed for {name}: {e}")
    return _HARDCODED.get(name, "")


def invalidate(name: str = None):
    """Clear cache entry or all entries."""
    if name:
        _cache.pop(name, None)
    else:
        _cache.clear()


async def seed_prompts():
    """
    Seed hardcoded prompts to prompt_versions if not present.
    Safe to call multiple times (idempotent per prompt_name).
    """
    for name, template in _HARDCODED.items():
        try:
            existing = await db.query("prompt_versions", params={
                "select": "id",
                "prompt_name": f"eq.{name}",
                "is_active": "eq.true",
                "limit": "1",
            })
            if not existing:
                await db.insert("prompt_versions", {
                    "prompt_name": name,
                    "version": 1,
                    "template": template,
                    "is_active": True,
                    "performance_notes": "Initial seed from hardcoded prompts",
                })
                logger.info(f"prompt_store: seeded {name} v1")
        except Exception as e:
            logger.warning(f"prompt_store: seed failed for {name}: {e}")

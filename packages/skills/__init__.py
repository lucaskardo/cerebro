"""
CEREBRO — Skill System
Skills are modular capabilities the system can use.
Each skill does one thing well. New skills can be added easily.
"""
from abc import ABC, abstractmethod
from typing import Optional
from packages.core import db, get_logger


class Skill(ABC):
    """Base class for all skills."""

    name: str = "unnamed"
    description: str = ""
    channel: str = "general"  # seo, social, community, messaging, outreach

    def __init__(self):
        self.logger = get_logger(f"skill.{self.name}")

    @abstractmethod
    async def execute(self, params: dict) -> dict:
        """Run the skill with given parameters. Returns result dict."""
        pass

    async def estimate(self, params: dict) -> dict:
        """Estimate the outcome without executing. For simulation."""
        return {"estimated": True, "confidence": 0.5, "notes": "No simulation available for this skill"}

    async def validate_params(self, params: dict) -> tuple[bool, str]:
        """Check if params are valid before execution."""
        return True, "ok"


# ============================================
# SKILL REGISTRY
# ============================================
_registry: dict[str, Skill] = {}


def register_skill(skill: Skill):
    _registry[skill.name] = skill
    return skill


def get_skill(name: str) -> Optional[Skill]:
    return _registry.get(name)


def list_skills() -> list[dict]:
    return [{"name": s.name, "description": s.description, "channel": s.channel} for s in _registry.values()]


# ============================================
# BUILT-IN SKILLS
# ============================================

class ContentCreationSkill(Skill):
    name = "content_creation"
    description = "Generate SEO-optimized articles from keywords"
    channel = "seo"

    async def execute(self, params: dict) -> dict:
        from packages.content.pipeline import run_pipeline
        keyword = params["keyword"]
        mission_id = params["mission_id"]
        asset = await run_pipeline(keyword, mission_id)
        return {"asset_id": asset["id"], "title": asset["title"], "status": asset["status"], "quality": asset.get("quality_score")}

    async def estimate(self, params: dict) -> dict:
        return {"estimated": True, "confidence": 0.7, "estimated_traffic_monthly": 100, "time_to_rank_weeks": 8, "cost_usd": 0.15}


class LeadCaptureSkill(Skill):
    name = "lead_capture"
    description = "Capture and qualify leads through forms and quizzes"
    channel = "conversion"

    async def execute(self, params: dict) -> dict:
        lead = await db.insert("leads", {
            "mission_id": params.get("mission_id"),
            "email": params["email"],
            "nombre": params.get("nombre"),
            "intent_score": params.get("intent_score", 0),
            "tema_interes": params.get("tema_interes"),
            "origen_url": params.get("origen_url"),
            "utm_source": params.get("utm_source"),
        })
        return {"lead_id": lead["id"] if lead else None, "captured": bool(lead)}


class EmailNurturingSkill(Skill):
    name = "email_nurturing"
    description = "Send nurturing email sequences to leads"
    channel = "email"

    async def execute(self, params: dict) -> dict:
        from packages.email import send_welcome_email
        sent = await send_welcome_email(params["email"], params.get("nombre"), params.get("tema"))
        return {"sent": sent}


class CommunityEngagementSkill(Skill):
    name = "community_engagement"
    description = "Draft responses for Reddit, forums, Facebook groups (human-approved)"
    channel = "community"

    async def execute(self, params: dict) -> dict:
        from packages.ai import complete
        result = await complete(
            prompt=f"""Draft a helpful response for this community discussion.
Topic: {params.get('topic', '')}
Platform: {params.get('platform', 'reddit')}
Context: {params.get('context', '')}

Rules:
- Be genuinely helpful, not promotional
- Use natural language, like a real person
- Only mention our product if directly relevant
- Keep it concise (2-3 paragraphs max)""",
            system="You are Carlos Medina, a financial specialist for Colombians. You help in online communities with genuine advice.",
            model="haiku",
            pipeline_step="community_draft",
        )
        # Save as draft for human approval
        await db.insert("social_content_queue", {
            "platform": params.get("platform", "reddit"),
            "content_type": "comment",
            "content_text": result["text"],
            "status": "draft",  # ALWAYS requires human approval
        })
        return {"draft": result["text"], "status": "awaiting_approval"}


class SocialDistributionSkill(Skill):
    name = "social_distribution"
    description = "Adapt content for Instagram, TikTok, X, LinkedIn"
    channel = "social"

    async def execute(self, params: dict) -> dict:
        from packages.ai import complete
        from packages.ai.prompts.content_prompts import TIKTOK_ADAPT, INSTAGRAM_ADAPT, TWITTER_ADAPT

        platform = params.get("platform", "instagram")
        prompts_map = {"tiktok": TIKTOK_ADAPT, "instagram": INSTAGRAM_ADAPT, "x": TWITTER_ADAPT}
        prompt_template = prompts_map.get(platform, INSTAGRAM_ADAPT)

        result = await complete(
            prompt=f"{prompt_template}\n\nArticle to adapt:\n{params.get('content', '')[:3000]}",
            system="You create social media content for Colombian financial education.",
            model="haiku",
            json_mode=True,
            pipeline_step=f"social_{platform}",
        )
        # Save as draft
        await db.insert("social_content_queue", {
            "content_asset_id": params.get("asset_id"),
            "platform": platform,
            "content_type": "post",
            "content_text": result["text"],
            "status": "draft",
        })
        return {"platform": platform, "draft": result.get("parsed") or result["text"], "status": "awaiting_approval"}


# Register all built-in skills
for _skill_cls in [ContentCreationSkill, LeadCaptureSkill, EmailNurturingSkill, CommunityEngagementSkill, SocialDistributionSkill]:
    register_skill(_skill_cls())

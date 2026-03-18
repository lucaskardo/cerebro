"""
CEREBRO — Skill System
Skills are modular capabilities with typed contracts.
Each skill declares: approval_policy, retry_policy, validate_input, estimate, execute.
"""
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional
from packages.core import db, get_logger


class Skill(ABC):
    """Base class for all skills with typed contracts."""

    name: str = "unnamed"
    description: str = ""
    channel: str = "general"  # seo, social, community, messaging, outreach, conversion, email

    # Policy declarations
    approval_policy: str = "auto_run"          # "auto_run" | "requires_approval"
    retry_policy: dict = {"max_attempts": 3, "backoff_seconds": 60}

    def __init__(self):
        self.logger = get_logger(f"skill.{self.name}")

    @abstractmethod
    async def execute(self, params: dict) -> dict:
        """Run the skill. Returns {output, metrics}."""
        pass

    async def validate_input(self, params: dict) -> tuple[bool, str]:
        """Check params before execution. Returns (ok, error_message)."""
        return True, "ok"

    # Backward-compat alias
    async def validate_params(self, params: dict) -> tuple[bool, str]:
        return await self.validate_input(params)

    async def estimate(self, params: dict) -> dict:
        """Estimate outcome without executing. Returns {cost, time_hours, confidence}."""
        return {"estimated": True, "confidence": 0.5, "cost": 0.0, "time_hours": 1.0}

    async def run_with_tracking(
        self,
        params: dict,
        task_id: Optional[str] = None,
        site_id: Optional[str] = None,
    ) -> dict:
        """Execute with full skill_runs history logging."""
        run = None
        try:
            run = await db.insert("skill_runs", {
                "task_id": task_id,
                "site_id": site_id,
                "skill_name": self.name,
                "status": "running",
                "input_json": params,
            })
        except Exception as e:
            self.logger.warning(f"skill_runs insert failed: {e}")

        run_id = run["id"] if run else None

        try:
            result = await self.execute(params)
            if run_id:
                await db.update("skill_runs", run_id, {
                    "status": "completed",
                    "output_json": result,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                })
            return result
        except Exception as e:
            if run_id:
                try:
                    await db.update("skill_runs", run_id, {
                        "status": "failed",
                        "error": str(e)[:500],
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    pass
            raise


# ─── Registry ─────────────────────────────────────────────────────────────────

_registry: dict[str, Skill] = {}


def register_skill(skill: Skill):
    _registry[skill.name] = skill
    return skill


def get_skill(name: str) -> Optional[Skill]:
    return _registry.get(name)


def list_skills() -> list[dict]:
    return [
        {
            "name": s.name,
            "description": s.description,
            "channel": s.channel,
            "approval_policy": s.approval_policy,
            "retry_policy": s.retry_policy,
        }
        for s in _registry.values()
    ]


# ─── Built-in Skills ──────────────────────────────────────────────────────────

class ContentCreationSkill(Skill):
    name = "content_creation"
    description = "Generate SEO-optimized articles from keywords"
    channel = "seo"
    approval_policy = "auto_run"
    retry_policy = {"max_attempts": 2, "backoff_seconds": 120}

    async def validate_input(self, params: dict) -> tuple[bool, str]:
        if not params.get("keyword"):
            return False, "keyword is required"
        if not params.get("mission_id"):
            return False, "mission_id is required"
        return True, "ok"

    async def estimate(self, params: dict) -> dict:
        return {
            "estimated": True, "confidence": 0.7,
            "estimated_traffic_monthly": 100, "time_to_rank_weeks": 8,
            "cost": 0.15, "time_hours": 0.1,
        }

    async def execute(self, params: dict) -> dict:
        from packages.content.pipeline import run_pipeline
        asset = await run_pipeline(
            params["keyword"],
            params["mission_id"],
            site_id=params.get("site_id"),
        )
        return {
            "asset_id": asset["id"],
            "title": asset["title"],
            "status": asset["status"],
            "quality": asset.get("quality_score"),
        }


class LeadCaptureSkill(Skill):
    name = "lead_capture"
    description = "Capture and qualify leads through forms and quizzes"
    channel = "conversion"
    approval_policy = "auto_run"

    async def validate_input(self, params: dict) -> tuple[bool, str]:
        if not params.get("email"):
            return False, "email is required"
        return True, "ok"

    async def execute(self, params: dict) -> dict:
        lead = await db.insert("leads", {
            "mission_id": params.get("mission_id"),
            "site_id": params.get("site_id"),
            "email": params["email"],
            "nombre": params.get("nombre"),
            "intent_score": params.get("intent_score", 0),
            "tema_interes": params.get("tema_interes"),
            "origen_url": params.get("origen_url"),
            "utm_source": params.get("utm_source"),
            "current_status": "new",
        })
        return {"lead_id": lead["id"] if lead else None, "captured": bool(lead)}


class EmailNurturingSkill(Skill):
    name = "email_nurturing"
    description = "Send nurturing email sequences to leads"
    channel = "email"
    approval_policy = "requires_approval"   # outbound email requires approval

    async def validate_input(self, params: dict) -> tuple[bool, str]:
        if not params.get("email"):
            return False, "email is required"
        return True, "ok"

    async def execute(self, params: dict) -> dict:
        from packages.email import send_welcome_email
        sent = await send_welcome_email(
            params["email"], params.get("nombre"), params.get("tema")
        )
        return {"sent": sent}


class CommunityEngagementSkill(Skill):
    name = "community_engagement"
    description = "Draft responses for Reddit, forums, Facebook groups (human-approved)"
    channel = "community"
    approval_policy = "requires_approval"   # always human-approved

    async def execute(self, params: dict) -> dict:
        from packages.ai import complete
        # Pull brand context from site if available
        brand_persona = params.get("brand_persona", "an expert in the field")
        brand_tone = params.get("brand_tone", "genuine, helpful, non-promotional")
        if not params.get("brand_persona") and params.get("site_id"):
            try:
                site = await db.get_by_id("domain_sites", params["site_id"])
                if site:
                    brand_persona = site.get("brand_persona") or brand_persona
                    brand_tone = site.get("brand_tone") or brand_tone
            except Exception:
                pass
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
            system=f"You are {brand_persona}. Tone: {brand_tone}. You help in online communities with genuine advice.",
            model="haiku",
            pipeline_step="community_draft",
        )
        await db.insert("social_content_queue", {
            "platform": params.get("platform", "reddit"),
            "content_type": "comment",
            "content_text": result["text"],
            "site_id": params.get("site_id"),
            "status": "draft",
        })
        return {"draft": result["text"], "status": "awaiting_approval"}


class SocialDistributionSkill(Skill):
    name = "social_distribution"
    description = "Adapt content for Instagram, TikTok, X, LinkedIn"
    channel = "social"
    approval_policy = "requires_approval"   # social posting always requires approval

    async def execute(self, params: dict) -> dict:
        from packages.ai import complete
        from packages.ai.prompts.content_prompts import TIKTOK_ADAPT, INSTAGRAM_ADAPT, TWITTER_ADAPT

        platform = params.get("platform", "instagram")
        prompts_map = {"tiktok": TIKTOK_ADAPT, "instagram": INSTAGRAM_ADAPT, "x": TWITTER_ADAPT}
        prompt_template = prompts_map.get(platform, INSTAGRAM_ADAPT)

        # Pull brand context from site if available
        brand_persona = params.get("brand_persona", "content creator")
        brand_tone = params.get("brand_tone", "engaging, authentic, helpful")
        audience_summary = params.get("brand_audience_summary", "target audience")
        if params.get("site_id") and not params.get("brand_persona"):
            try:
                site = await db.get_by_id("domain_sites", params["site_id"])
                if site:
                    brand_persona = site.get("brand_persona") or brand_persona
                    brand_tone = site.get("brand_tone") or brand_tone
                    aud = site.get("brand_audience") or {}
                    audience_summary = ", ".join(aud.get("segments", [])) if isinstance(aud, dict) else audience_summary
            except Exception:
                pass

        result = await complete(
            prompt=f"{prompt_template}\n\nArticle to adapt:\n{params.get('content', '')[:3000]}",
            system=f"You are {brand_persona}. Tone: {brand_tone}. Audience: {audience_summary}. Create social media content for {platform}.",
            model="haiku",
            json_mode=True,
            pipeline_step=f"social_{platform}",
        )
        await db.insert("social_content_queue", {
            "content_asset_id": params.get("asset_id"),
            "site_id": params.get("site_id"),
            "platform": platform,
            "content_type": "post",
            "content_text": result["text"],
            "status": "draft",
        })
        return {"platform": platform, "draft": result.get("parsed") or result["text"], "status": "awaiting_approval"}


# Register all built-in skills
for _skill_cls in [
    ContentCreationSkill, LeadCaptureSkill, EmailNurturingSkill,
    CommunityEngagementSkill, SocialDistributionSkill,
]:
    register_skill(_skill_cls())

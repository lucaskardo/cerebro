"""
CEREBRO — Client Intelligence Layer
Maintains living market knowledge per client/site.
"""
import json
from datetime import datetime, timezone
from packages.core import db, get_logger
from packages.ai import complete

logger = get_logger("intelligence")

_RESEARCH_PROMPT = """You are a senior marketing strategist conducting deep market research.
Analyze this company as if preparing a $50,000 consulting engagement.

Company: {company}
Country: {country}
Industry: {industry}
Website: {company_url}

Provide a comprehensive analysis in JSON format:
{{
  "value_proposition": "What this company uniquely offers (1-2 sentences)",
  "core_competencies": ["3-5 core strengths"],
  "pain_points": ["5-10 specific pain points of their target audience"],
  "desires": ["5-7 aspirations/goals of their target audience"],
  "target_segments": [
    {{"name": "segment name", "description": "who they are", "size": "estimated size", "priority": "high/medium/low"}}
  ],
  "advantages": ["3-5 competitive advantages"],
  "weaknesses": ["2-4 areas of vulnerability"],
  "competitors": [
    {{"name": "competitor", "url": "if known", "positioning": "how they position", "weakness": "where they're vulnerable"}}
  ],
  "content_angles": ["5-8 unique content perspectives that differentiate from competitors"],
  "customer_objections": ["5-7 common objections or hesitations"],
  "buying_triggers": ["5-7 events or situations that trigger purchase decisions"],
  "market_trends": ["3-5 relevant trends in this industry/country"],
  "key_differentiators": ["3-5 things that make this company different"],
  "brand_voice_notes": "Recommended tone and personality for content"
}}

Be specific to {country} market. Use real competitor names.
Reference actual market dynamics, not generic business advice."""

_RESEARCH_SYSTEM = (
    "You are a senior marketing strategist with deep experience in Latin American markets. "
    "Output ONLY valid JSON — no preamble, no explanation."
)


class ClientIntelligence:

    async def research_client(
        self,
        site_id: str,
        company: str,
        country: str,
        company_url: str = None,
        industry: str = None,
    ) -> dict:
        """Run full research pipeline for a client. Creates or updates client_profile."""
        logger.info(f"Starting research for {company} ({country})")

        # Get or create profile
        existing = await db.query("client_profiles", params={
            "select": "*",
            "site_id": f"eq.{site_id}",
            "limit": "1",
        })
        profile_id = existing[0]["id"] if existing else None

        if not profile_id:
            profile = await db.insert("client_profiles", {
                "site_id": site_id,
                "company_name": company,
                "company_url": company_url,
                "country": country,
                "industry": industry,
                "research_depth": "initial",
                "research_version": 1,
            })
            profile_id = profile["id"]
        else:
            profile_id = existing[0]["id"]

        # Run AI research
        result = await complete(
            prompt=_RESEARCH_PROMPT.format(
                company=company,
                country=country,
                industry=industry or "general business",
                company_url=company_url or "not provided",
            ),
            system=_RESEARCH_SYSTEM,
            model="sonnet",
            json_mode=True,
            pipeline_step="client_research",
        )

        data = result.get("parsed") or {}
        if not data:
            logger.warning(f"Research returned empty for {company}")
            return await self.get_profile(site_id) or {}

        # Store raw research entry
        await db.insert("market_research", {
            "site_id": site_id,
            "profile_id": profile_id,
            "research_type": "company_analysis",
            "query": f"Full analysis: {company} in {country}",
            "findings": json.dumps(data, ensure_ascii=False)[:5000],
            "structured_data": data,
            "confidence": "high",
            "applied_to_profile": True,
        })

        # Merge into profile
        now = datetime.now(timezone.utc).isoformat()
        update_payload = {
            "company_name": company,
            "company_url": company_url,
            "country": country,
            "industry": industry,
            "value_proposition": data.get("value_proposition"),
            "core_competencies": data.get("core_competencies", []),
            "pain_points": data.get("pain_points", []),
            "desires": data.get("desires", []),
            "target_segments": data.get("target_segments", []),
            "advantages": data.get("advantages", []),
            "weaknesses": data.get("weaknesses", []),
            "competitors": data.get("competitors", []),
            "content_angles": data.get("content_angles", []),
            "customer_objections": data.get("customer_objections", []),
            "buying_triggers": data.get("buying_triggers", []),
            "market_trends": data.get("market_trends", []),
            "key_differentiators": data.get("key_differentiators", []),
            "brand_voice_notes": data.get("brand_voice_notes"),
            "research_depth": "standard",
            "last_researched_at": now,
            "updated_at": now,
        }

        # Increment version if already had profile
        if existing:
            update_payload["research_version"] = (existing[0].get("research_version") or 0) + 1

        await db.update("client_profiles", profile_id, update_payload)
        logger.info(f"Research complete for {company}: {len(data.get('pain_points', []))} pain points, {len(data.get('competitors', []))} competitors")
        return await self.get_profile(site_id) or {}

    async def refresh_research(self, site_id: str, focus_areas: list = None) -> dict:
        """Re-run research, merging new data additively. If focus_areas provided, targets those areas."""
        profile = await self.get_profile(site_id)
        if not profile:
            raise ValueError(f"No client profile found for site_id={site_id}. Run research_client first.")

        if focus_areas:
            # Run targeted research with focus areas noted in the prompt
            logger.info(f"Refreshing research for {profile['company_name']}, focus: {focus_areas}")
            now = datetime.now(timezone.utc).isoformat()

            focused_prompt = _RESEARCH_PROMPT.format(
                company=profile["company_name"],
                country=profile["country"],
                industry=profile.get("industry") or "general business",
                company_url=profile.get("company_url") or "not provided",
            ) + f"\n\nFOCUS AREAS: Provide especially detailed analysis for these areas: {', '.join(focus_areas)}. You still must return the full JSON structure, but go deeper on these topics."

            result = await complete(
                prompt=focused_prompt,
                system=_RESEARCH_SYSTEM,
                model="sonnet",
                json_mode=True,
                pipeline_step="client_research_focused",
            )
            data = result.get("parsed") or {}

            if data and profile.get("id"):
                # Store as focused research entry
                await db.insert("market_research", {
                    "site_id": site_id,
                    "profile_id": profile["id"],
                    "research_type": "company_analysis",
                    "query": f"Focused refresh ({', '.join(focus_areas)}): {profile['company_name']}",
                    "findings": str(data)[:5000],
                    "structured_data": data,
                    "confidence": "high",
                    "applied_to_profile": True,
                })
                # Merge only focus area fields back into profile
                field_map = {
                    "competitors": "competitors",
                    "pain_points": "pain_points",
                    "market_trends": "market_trends",
                    "content_angles": "content_angles",
                    "customer_objections": "customer_objections",
                    "buying_triggers": "buying_triggers",
                    "target_segments": "target_segments",
                    "key_differentiators": "key_differentiators",
                    "advantages": "advantages",
                    "weaknesses": "weaknesses",
                }
                update = {"updated_at": now, "last_researched_at": now,
                          "research_version": (profile.get("research_version") or 0) + 1}
                for area in focus_areas:
                    if area in field_map:
                        field = field_map[area]
                        if data.get(field):
                            update[field] = data[field]
                if update:
                    await db.update("client_profiles", profile["id"], update)

            return await self.get_profile(site_id) or {}

        return await self.research_client(
            site_id=site_id,
            company=profile["company_name"],
            country=profile["country"],
            company_url=profile.get("company_url"),
            industry=profile.get("industry"),
        )

    async def get_profile(self, site_id: str) -> dict | None:
        """Return full client_profile record or None."""
        rows = await db.query("client_profiles", params={
            "select": "*",
            "site_id": f"eq.{site_id}",
            "limit": "1",
        })
        return rows[0] if rows else None

    async def get_content_context(self, site_id: str) -> str:
        """
        Returns formatted string injected into EVERY content generation prompt.
        Falls back to minimal brand context from domain_sites if no profile.
        NEVER returns empty string.
        """
        if not site_id:
            return "Content specialist. Professional, helpful tone."

        profile = await self.get_profile(site_id)

        if not profile or profile.get("research_depth") == "none":
            # Fallback: use domain_sites brand fields
            site = await db.get_by_id("domain_sites", site_id)
            if site:
                return (
                    f"Brand: {site.get('brand_name') or 'Unknown'}\n"
                    f"Persona: {site.get('brand_persona') or 'Content specialist'}\n"
                    f"Tone: {site.get('brand_tone') or 'professional, helpful'}\n"
                    f"[WARNING: No deep client research available. Run /api/intelligence/research to unlock full context.]"
                )
            return "Content specialist. Professional, helpful tone."

        pain_points = profile.get("pain_points") or []
        competitors = profile.get("competitors") or []
        content_angles = profile.get("content_angles") or []
        buying_triggers = profile.get("buying_triggers") or []

        competitors_summary = "; ".join(
            f"{c['name']} ({c.get('positioning', '')})" if isinstance(c, dict) else str(c)
            for c in competitors[:5]
        )

        return f"""CLIENT INTELLIGENCE — {profile['company_name']} ({profile['country']})
Value Proposition: {profile.get('value_proposition') or 'Not researched yet'}
Tone/Voice: {profile.get('brand_voice_notes') or 'Professional, helpful'}

AUDIENCE PAIN POINTS:
{chr(10).join(f'- {p}' for p in pain_points[:7])}

AUDIENCE DESIRES:
{chr(10).join(f'- {d}' for d in (profile.get('desires') or [])[:5])}

COMPETITORS TO DIFFERENTIATE FROM:
{competitors_summary or 'None identified yet'}

CONTENT ANGLES (use these perspectives):
{chr(10).join(f'- {a}' for a in content_angles[:6])}

BUYING TRIGGERS (address these):
{chr(10).join(f'- {t}' for t in buying_triggers[:5])}

KEY DIFFERENTIATORS:
{chr(10).join(f'- {d}' for d in (profile.get('key_differentiators') or [])[:4])}"""

    async def get_strategy_context(self, site_id: str) -> str:
        """
        Formatted for strategy decisions. Includes: market trends, competitor weaknesses,
        untapped segments, high-potential content angles, buying triggers.
        """
        if not site_id:
            return ""

        profile = await self.get_profile(site_id)
        if not profile or profile.get("research_depth") == "none":
            return ""

        competitors = profile.get("competitors") or []
        comp_weaknesses = [
            f"{c['name']}: {c.get('weakness', 'unknown')}"
            for c in competitors[:5] if isinstance(c, dict) and c.get("weakness")
        ]

        segments = profile.get("target_segments") or []
        high_priority = [
            f"{s['name']} — {s.get('description', '')}"
            for s in segments if isinstance(s, dict) and s.get("priority") == "high"
        ]

        return f"""MARKET INTELLIGENCE — {profile['company_name']} ({profile['country']})

COMPETITOR WEAKNESSES (exploit these):
{chr(10).join(f'- {w}' for w in comp_weaknesses) or '- None identified'}

HIGH-PRIORITY SEGMENTS (target first):
{chr(10).join(f'- {s}' for s in high_priority) or '- Not segmented yet'}

MARKET TRENDS:
{chr(10).join(f'- {t}' for t in (profile.get('market_trends') or [])[:4])}

BUYING TRIGGERS (align content timing to these):
{chr(10).join(f'- {t}' for t in (profile.get('buying_triggers') or [])[:5])}

CONTENT ANGLES WITH HIGHEST DIFFERENTIATION POTENTIAL:
{chr(10).join(f'- {a}' for a in (profile.get('content_angles') or [])[:5])}

CUSTOMER OBJECTIONS TO PREEMPT:
{chr(10).join(f'- {o}' for o in (profile.get('customer_objections') or [])[:4])}"""

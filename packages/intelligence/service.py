"""
CEREBRO — Intelligence Service
Pure-SQL context builders for each consumer (content, WhatsApp, quiz, dashboard, briefing).
No LLM calls. Target: <100ms per call via parallel asyncio.gather queries.
"""
import asyncio
from dataclasses import dataclass, field
from typing import Optional

from packages.core import db, get_logger

logger = get_logger("intelligence.service")

# Fact types we pull for content context
_CONTENT_FACT_TYPES = (
    "pain_point,desire,objection,differentiator,"
    "buying_trigger,competitor,content_angle,brand_voice"
)


# ── Packet types ──────────────────────────────────────────────────────────────

@dataclass
class ContentPacket:
    """Intelligence context for a single article."""
    site_id: str
    keyword: str
    facts: list          # raw fact dicts from intelligence_facts
    company: str
    country: str
    value_prop: str
    brand_voice: str
    products: list       # entity dicts with display_name

    def to_prompt(self) -> str:
        """Render ≤250-word context string for {client_intelligence} placeholder.
        Returns empty string if no facts (signals fallback needed)."""
        if not self.facts:
            return ""

        # Pick best fact per type (highest utility_score)
        by_type: dict[str, dict] = {}
        for f in self.facts:
            ft = f.get("fact_type", "")
            existing = by_type.get(ft)
            if existing is None or f.get("utility_score", 0) > existing.get("utility_score", 0):
                by_type[ft] = f

        def _val(f: dict) -> str:
            """Extract display value from a fact. value_number is never bool-checked."""
            if f.get("value_text"):
                return f["value_text"]
            vn = f.get("value_number")
            if vn is not None:
                # Ratios (0.0–1.0) rendered as percentages
                if 0.0 <= vn <= 1.0:
                    return f"{vn * 100:.0f}%"
                return str(vn)
            vj = f.get("value_json")
            if vj:
                if isinstance(vj, list):
                    return ", ".join(str(x) for x in vj[:3])
                return str(vj)
            return ""

        audience = _val(by_type["desire"]) if "desire" in by_type else ""
        pain = _val(by_type["pain_point"]) if "pain_point" in by_type else ""
        competitor = _val(by_type["competitor"]) if "competitor" in by_type else ""
        objection = _val(by_type["objection"]) if "objection" in by_type else ""
        angle = _val(by_type.get("content_angle") or by_type.get("differentiator") or {})
        tone = _val(by_type["brand_voice"]) if "brand_voice" in by_type else self.brand_voice
        product_rec = self.products[0]["display_name"] if self.products else ""

        lines = [
            f'CONTEXTO ESPECÍFICO PARA: "{self.keyword}"',
            f"Empresa: {self.company} ({self.country})",
            f"Propuesta de valor: {self.value_prop}",
            "",
        ]
        if audience:
            lines.append(f"AUDIENCIA PARA ESTE ARTÍCULO: {audience}")
        if pain:
            lines.append(f"DOLOR PRINCIPAL: {pain}")
        if product_rec:
            lines.append(f"PRODUCTO A RECOMENDAR: {product_rec}")
        if competitor:
            lines.append(f"DIFERENCIARSE DE: {competitor}")
        if objection:
            lines.append(f"OBJECIÓN A RESOLVER: {objection}")
        if angle:
            lines.append(f"ÁNGULO/DATO CLAVE: {angle}")
        if tone:
            lines.append(f"NOTA DE TONO: {tone}")
        lines.append(f"\nVOZ DE MARCA: {self.brand_voice or 'Directa, honesta, útil'}")

        return "\n".join(lines)


@dataclass
class WhatsAppPacket:
    """Context for WhatsApp response generation (stub)."""
    site_id: str
    company: str
    value_prop: str

    def to_prompt(self) -> str:
        return f"{self.company}: {self.value_prop}" if self.value_prop else ""


@dataclass
class QuizPacket:
    """Context for quiz response scoring/routing (stub)."""
    site_id: str
    company: str
    value_prop: str

    def to_prompt(self) -> str:
        return f"{self.company}: {self.value_prop}" if self.value_prop else ""


@dataclass
class DashboardPacket:
    """Context for dashboard summary (stub)."""
    site_id: str
    company: str
    value_prop: str

    def to_prompt(self) -> str:
        return f"{self.company}: {self.value_prop}" if self.value_prop else ""


@dataclass
class BriefingPacket:
    """Context for editorial briefing (stub)."""
    site_id: str
    company: str
    value_prop: str

    def to_prompt(self) -> str:
        return f"{self.company}: {self.value_prop}" if self.value_prop else ""


# ── Service ───────────────────────────────────────────────────────────────────

class IntelligenceService:
    """
    Pure-SQL context builders. No LLM. All methods: parallel queries via asyncio.gather.
    Instantiate fresh per call — no shared state.
    """

    async def for_content(
        self,
        site_id: str,
        keyword: str,
        existing_articles: list,
    ) -> ContentPacket:
        """
        Build content context for a specific keyword.
        Queries intelligence_facts, product entities, and client_profiles in parallel.
        Scores facts by keyword relevance + utility_score.
        Saves a context receipt asynchronously (fire-and-forget).
        Returns ContentPacket — call .to_prompt() for the {client_intelligence} string.
        """
        if not site_id:
            return ContentPacket(site_id="", keyword=keyword, facts=[], company="",
                                 country="", value_prop="", brand_voice="", products=[])

        # 3 parallel queries
        facts_q = db.query("intelligence_facts", params={
            "select": "id,fact_type,fact_key,value_text,value_number,value_json,utility_score,confidence",
            "site_id": f"eq.{site_id}",
            "fact_type": f"in.({_CONTENT_FACT_TYPES})",
            "order": "utility_score.desc",
            "limit": "40",
        })
        products_q = db.query("intelligence_entities", params={
            "select": "id,display_name,entity_key,metadata",
            "site_id": f"eq.{site_id}",
            "entity_type": "eq.product",
            "limit": "10",
        })
        profile_q = db.query("client_profiles", params={
            "select": "company_name,value_proposition,country,brand_voice_notes",
            "site_id": f"eq.{site_id}",
            "limit": "1",
        })

        try:
            facts, products, profiles = await asyncio.gather(
                facts_q, products_q, profile_q,
                return_exceptions=True,
            )
        except Exception as e:
            logger.warning(f"for_content: parallel queries failed: {e}")
            return ContentPacket(site_id=site_id, keyword=keyword, facts=[], company="",
                                 country="", value_prop="", brand_voice="", products=[])

        # Handle partial failures gracefully
        if isinstance(facts, Exception):
            logger.warning(f"for_content: facts query failed: {facts}")
            facts = []
        if isinstance(products, Exception):
            logger.warning(f"for_content: products query failed: {products}")
            products = []
        if isinstance(profiles, Exception):
            logger.warning(f"for_content: profile query failed: {profiles}")
            profiles = []

        profile = profiles[0] if profiles else {}

        # Score facts by keyword relevance (token overlap) + utility_score
        keyword_tokens = set(keyword.lower().split())

        def _relevance(f: dict) -> float:
            text = f"{f.get('fact_key', '')} {f.get('value_text', '')}".lower()
            token_hits = sum(1 for t in keyword_tokens if t in text)
            return token_hits * 2.0 + float(f.get("utility_score") or 0)

        sorted_facts = sorted(facts, key=_relevance, reverse=True)
        top_facts = sorted_facts[:8]

        # Fire-and-forget: save context receipt
        fact_ids = [f["id"] for f in top_facts if f.get("id")]
        asyncio.create_task(
            self._save_receipt(site_id, "content", keyword, fact_ids)
        )

        return ContentPacket(
            site_id=site_id,
            keyword=keyword,
            facts=top_facts,
            company=profile.get("company_name", ""),
            country=profile.get("country", ""),
            value_prop=profile.get("value_proposition", ""),
            brand_voice=profile.get("brand_voice_notes", "Directa, honesta, útil"),
            products=products,
        )

    async def for_whatsapp(
        self,
        site_id: str,
        message: str,
        customer_id: Optional[str] = None,
    ) -> WhatsAppPacket:
        """Context for WhatsApp response generation. Stub — minimal profile query."""
        try:
            profiles = await db.query("client_profiles", params={
                "select": "company_name,value_proposition",
                "site_id": f"eq.{site_id}",
                "limit": "1",
            })
            profile = profiles[0] if profiles else {}
        except Exception:
            profile = {}
        return WhatsAppPacket(
            site_id=site_id,
            company=profile.get("company_name", ""),
            value_prop=profile.get("value_proposition", ""),
        )

    async def for_quiz(
        self,
        site_id: str,
        quiz_responses: dict,
    ) -> QuizPacket:
        """Context for quiz scoring/routing. Stub — minimal profile query."""
        try:
            profiles = await db.query("client_profiles", params={
                "select": "company_name,value_proposition",
                "site_id": f"eq.{site_id}",
                "limit": "1",
            })
            profile = profiles[0] if profiles else {}
        except Exception:
            profile = {}
        return QuizPacket(
            site_id=site_id,
            company=profile.get("company_name", ""),
            value_prop=profile.get("value_proposition", ""),
        )

    async def for_dashboard(self, site_id: str) -> DashboardPacket:
        """Context for dashboard summary. Stub — minimal profile query."""
        try:
            profiles = await db.query("client_profiles", params={
                "select": "company_name,value_proposition",
                "site_id": f"eq.{site_id}",
                "limit": "1",
            })
            profile = profiles[0] if profiles else {}
        except Exception:
            profile = {}
        return DashboardPacket(
            site_id=site_id,
            company=profile.get("company_name", ""),
            value_prop=profile.get("value_proposition", ""),
        )

    async def for_briefing(self, site_id: str) -> BriefingPacket:
        """Context for editorial briefing. Stub — minimal profile query."""
        try:
            profiles = await db.query("client_profiles", params={
                "select": "company_name,value_proposition",
                "site_id": f"eq.{site_id}",
                "limit": "1",
            })
            profile = profiles[0] if profiles else {}
        except Exception:
            profile = {}
        return BriefingPacket(
            site_id=site_id,
            company=profile.get("company_name", ""),
            value_prop=profile.get("value_proposition", ""),
        )

    async def _save_receipt(
        self,
        site_id: str,
        context_type: str,
        keyword: str,
        fact_ids: list,
    ) -> None:
        """Save context receipt + per-fact rows. Called via create_task — never raises."""
        try:
            receipt = await db.insert("intelligence_context_receipts", {
                "site_id": site_id,
                "context_type": context_type,
                "prompt_hash": keyword[:64],
            })
            receipt_id = receipt.get("id")
            if receipt_id and fact_ids:
                for fid in fact_ids:
                    try:
                        await db.insert("intelligence_receipt_facts", {
                            "receipt_id": receipt_id,
                            "fact_id": fid,
                            "was_relevant": True,
                        })
                    except Exception:
                        pass
        except Exception as e:
            logger.debug(f"_save_receipt: non-fatal: {e}")

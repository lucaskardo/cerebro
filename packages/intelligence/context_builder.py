"""
CEREBRO — Contextualized Intelligence Builder
Builds a FOCUSED intelligence context per article, not a generic client dump.
"""
import json
from packages.core import db, get_logger
from packages.ai import complete

logger = get_logger("intelligence.context_builder")


async def build_article_context(
    site_id: str,
    keyword: str,
    existing_articles: list,
) -> str:
    """Build intelligence context SPECIFIC to this article's topic.

    Instead of dumping the entire client profile, extracts only what's
    relevant for writing about this particular keyword.

    Returns a focused context string for use in content prompts.
    """
    if not site_id:
        return ""

    # 1. Load client profile
    try:
        profiles = await db.query("client_profiles", params={
            "select": "*",
            "site_id": f"eq.{site_id}",
            "limit": "1",
        })
        profile = profiles[0] if profiles else {}
    except Exception as e:
        logger.warning(f"context_builder: could not load profile: {e}")
        profile = {}

    if not profile:
        return ""

    # 2. Load recent leads — find what quiz responses / topics convert
    try:
        leads = await db.query("leads", params={
            "select": "quiz_responses,intent_score,cta_variant,asset_id,tema_interes",
            "site_id": f"eq.{site_id}",
            "order": "created_at.desc",
            "limit": "100",
        })
    except Exception:
        leads = []

    # 3. Match leads to existing articles to find performance signals
    article_lead_counts: dict[str, int] = {}
    for lead in leads:
        aid = lead.get("asset_id")
        if aid:
            article_lead_counts[aid] = article_lead_counts.get(aid, 0) + 1

    # Find top performing articles by topic (look for articles with most leads)
    articles_with_perf = []
    for art in existing_articles[:30]:
        # We only have title/keyword/slug/meta from content_library, no id
        # Performance data requires asset_id lookup — skip if no id
        pass

    # Build a performance insight string from lead data
    performance_note = ""
    if leads:
        top_temas = {}
        for l in leads:
            t = l.get("tema_interes", "")
            if t:
                top_temas[t] = top_temas.get(t, 0) + 1
        if top_temas:
            sorted_temas = sorted(top_temas.items(), key=lambda x: x[1], reverse=True)
            performance_note = f"Top converting topics from leads: {', '.join(f'{t} ({c} leads)' for t, c in sorted_temas[:3])}"

    # 4. Build article list summary for Haiku context
    articles_summary = "\n".join(
        f"- {a.get('title', '')} (keyword: {a.get('keyword', '')})"
        for a in existing_articles[:20]
        if a.get("title")
    )

    # 5. Use Haiku to extract focused context for this keyword
    profile_snapshot = {
        "company": profile.get("company_name", ""),
        "value_proposition": profile.get("value_proposition", ""),
        "pain_points": (profile.get("pain_points") or [])[:8],
        "competitors": [
            c.get("name", c) if isinstance(c, dict) else str(c)
            for c in (profile.get("competitors") or [])[:5]
        ],
        "key_differentiators": (profile.get("key_differentiators") or [])[:4],
        "customer_objections": (profile.get("customer_objections") or [])[:5],
        "buying_triggers": (profile.get("buying_triggers") or [])[:4],
        "content_angles": (profile.get("content_angles") or [])[:5],
        "brand_voice_notes": profile.get("brand_voice_notes", ""),
        "country": profile.get("country", ""),
    }

    try:
        result = await complete(
            prompt=f"""Keyword a escribir: "{keyword}"
País: {profile.get("country", "")}

Perfil del cliente:
{json.dumps(profile_snapshot, ensure_ascii=False, indent=2)}

Artículos existentes del sitio:
{articles_summary or "Ninguno aún"}

{f"Insights de conversión: {performance_note}" if performance_note else ""}

Extrae SOLO la información relevante para escribir sobre "{keyword}".
Sé específico y conciso. Omite todo lo que no sea directamente útil para este tema.

JSON exacto:
{{
  "relevant_segment": "qué segmento de audiencia busca este keyword específico",
  "key_pain_point": "dolor principal que tiene este lector al buscar este keyword",
  "product_to_recommend": "qué producto/servicio recomendar en este artículo",
  "competitor_to_differentiate": "contra qué competidor diferenciarse específicamente en este tema",
  "objection_to_address": "objeción principal a resolver en este artículo",
  "relevant_stat_or_angle": "dato o ángulo específico que dé autoridad en este tema",
  "internal_link_candidates": ["2-3 artículos existentes relevantes para linkear internamente"],
  "tone_note": "ajuste de tono específico para este keyword (ej: más técnico, más emocional)",
  "performance_insight": "{performance_note or 'Sin datos aún'}"
}}""",
            system="Eres experto en estrategia de contenido SEO. Extrae solo lo esencial. Responde SOLO en JSON válido.",
            model="haiku",
            json_mode=True,
            pipeline_step="context_builder",
        )
        ctx = result.get("parsed") or {}
    except Exception as e:
        logger.warning(f"context_builder: Haiku extraction failed: {e}")
        ctx = {}

    if not ctx:
        # Fallback: return the generic profile context
        from packages.intelligence import ClientIntelligence
        intel = ClientIntelligence()
        return await intel.get_content_context(site_id)

    # 6. Format as focused context string
    return f"""CONTEXTO ESPECÍFICO PARA: "{keyword}"
Empresa: {profile.get("company_name", "")} ({profile.get("country", "")})
Propuesta de valor: {profile.get("value_proposition", "")}

AUDIENCIA PARA ESTE ARTÍCULO: {ctx.get("relevant_segment", "")}
DOLOR PRINCIPAL: {ctx.get("key_pain_point", "")}
PRODUCTO A RECOMENDAR: {ctx.get("product_to_recommend", "")}
DIFERENCIARSE DE: {ctx.get("competitor_to_differentiate", "")}
OBJECIÓN A RESOLVER: {ctx.get("objection_to_address", "")}
ÁNGULO/DATO CLAVE: {ctx.get("relevant_stat_or_angle", "")}
NOTA DE TONO: {ctx.get("tone_note", "")}
{f"LINKS INTERNOS SUGERIDOS: {', '.join(ctx.get('internal_link_candidates', []))}" if ctx.get("internal_link_candidates") else ""}
{f"INSIGHT DE RENDIMIENTO: {ctx.get('performance_insight', '')}" if ctx.get("performance_insight") else ""}

VOZ DE MARCA: {profile.get("brand_voice_notes", "Directa, honesta, útil")}"""

"""
CEREBRO — Content Performance Analyzer
Analyzes what content is working and generates actionable insights.
"""
import json
from packages.core import db, get_logger
from packages.ai import complete

logger = get_logger("intelligence.performance_analyzer")


async def analyze_content_performance(site_id: str) -> dict:
    """Analyze what content is working and why.

    Queries articles + leads, correlates quality scores with lead generation,
    identifies patterns, and generates insights via Haiku.

    Returns:
    {
        "top_performers": [{"title", "leads", "avg_intent", "quality_score"}],
        "insights": ["Articles about dolor de espalda generate 5x more leads"],
        "recommendations": ["Create more back pain content"],
        "content_gaps": ["No article about colchón para embarazadas"],
        "best_cta": "quiz-results",
        "best_topic_cluster": "dolor de espalda",
        "avg_quality_of_converting_articles": 82,
        "total_articles": 24,
        "total_leads": 12
    }
    """
    empty = {
        "top_performers": [],
        "insights": [],
        "recommendations": [],
        "content_gaps": [],
        "best_cta": None,
        "best_topic_cluster": None,
        "avg_quality_of_converting_articles": 0,
        "total_articles": 0,
        "total_leads": 0,
    }

    # 1. Get all approved articles with quality scores
    try:
        articles = await db.query("content_assets", params={
            "select": "id,title,keyword,slug,quality_score,score_humanity,score_specificity,score_seo,score_readability,created_at",
            "site_id": f"eq.{site_id}",
            "status": "in.(approved,review)",
            "order": "created_at.desc",
            "limit": "100",
        })
    except Exception as e:
        logger.warning(f"performance_analyzer: could not load articles: {e}")
        return empty

    if not articles:
        return empty

    # 2. Get all leads for this site
    try:
        leads = await db.query("leads", params={
            "select": "id,asset_id,intent_score,cta_variant,quiz_responses,tema_interes",
            "site_id": f"eq.{site_id}",
            "order": "created_at.desc",
            "limit": "500",
        })
    except Exception as e:
        logger.warning(f"performance_analyzer: could not load leads: {e}")
        leads = []

    # 3. Match leads to articles
    lead_map: dict[str, list] = {}  # asset_id → [lead]
    for lead in leads:
        aid = lead.get("asset_id")
        if aid:
            lead_map.setdefault(aid, []).append(lead)

    # 4. Build article performance data
    article_perf = []
    for art in articles:
        art_leads = lead_map.get(art["id"], [])
        intent_scores = [l.get("intent_score", 0) for l in art_leads if l.get("intent_score")]
        article_perf.append({
            "id": art["id"],
            "title": art.get("title", ""),
            "keyword": art.get("keyword", ""),
            "leads": len(art_leads),
            "avg_intent": round(sum(intent_scores) / len(intent_scores), 1) if intent_scores else 0,
            "quality_score": art.get("quality_score", 0),
            "score_humanity": art.get("score_humanity", 0),
        })

    article_perf.sort(key=lambda x: (x["leads"], x["avg_intent"]), reverse=True)
    top_performers = article_perf[:5]

    # 5. CTA analysis
    cta_counts: dict[str, int] = {}
    for lead in leads:
        cta = lead.get("cta_variant", "")
        if cta:
            cta_counts[cta] = cta_counts.get(cta, 0) + 1
    best_cta = max(cta_counts, key=cta_counts.get) if cta_counts else None

    # 6. Topic cluster analysis
    topic_counts: dict[str, int] = {}
    for lead in leads:
        t = lead.get("tema_interes", "")
        if t:
            topic_counts[t] = topic_counts.get(t, 0) + 1
    best_topic = max(topic_counts, key=topic_counts.get) if topic_counts else None

    # 7. Avg quality of converting articles
    converting = [a for a in article_perf if a["leads"] > 0]
    avg_quality = round(
        sum(a.get("quality_score", 0) for a in converting) / len(converting), 1
    ) if converting else 0

    # 8. Use Haiku to generate insights if there's enough data
    insights: list[str] = []
    recommendations: list[str] = []
    content_gaps: list[str] = []

    if len(articles) >= 3:
        try:
            perf_summary = {
                "total_articles": len(articles),
                "total_leads": len(leads),
                "top_performers": [
                    {"title": p["title"], "keyword": p["keyword"], "leads": p["leads"], "avg_intent": p["avg_intent"]}
                    for p in top_performers
                ],
                "zero_lead_articles": [
                    {"title": a["title"], "keyword": a["keyword"]}
                    for a in article_perf if a["leads"] == 0
                ][:5],
                "best_cta": best_cta,
                "best_topic_cluster": best_topic,
                "avg_quality_of_converting_articles": avg_quality,
                "all_keywords": [a.get("keyword", "") for a in articles[:20]],
            }

            result = await complete(
                prompt=f"""Analiza el rendimiento de contenido de este sitio:

{json.dumps(perf_summary, ensure_ascii=False, indent=2)}

Genera insights accionables basados en los datos reales. Sé específico con los números.

JSON exacto:
{{
  "insights": ["insight específico con datos, ej: Los artículos sobre X generan 3x más leads"],
  "recommendations": ["acción concreta a tomar basada en los datos"],
  "content_gaps": ["temas que NO existen pero deberían, basados en patrones de leads"]
}}""",
                system="Eres analista de contenido. Solo genera insights basados en datos reales. Responde SOLO en JSON válido.",
                model="haiku",
                json_mode=True,
                pipeline_step="performance_analysis",
            )
            parsed = result.get("parsed") or {}
            insights = parsed.get("insights", [])
            recommendations = parsed.get("recommendations", [])
            content_gaps = parsed.get("content_gaps", [])
        except Exception as e:
            logger.warning(f"performance_analyzer: Haiku analysis failed: {e}")

    return {
        "top_performers": top_performers,
        "insights": insights,
        "recommendations": recommendations,
        "content_gaps": content_gaps,
        "best_cta": best_cta,
        "best_topic_cluster": best_topic,
        "avg_quality_of_converting_articles": avg_quality,
        "total_articles": len(articles),
        "total_leads": len(leads),
    }

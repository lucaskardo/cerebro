"""
CEREBRO — Daily CEO Briefing
Generates and sends a morning summary of what CEREBRO did yesterday.
"""
import json
from datetime import datetime, timedelta, timezone
from packages.core import db, get_logger, config
from packages.ai import complete
from packages.email import send_email

logger = get_logger("email.briefing")

DASHBOARD_URL = "https://web-ten-woad-99.vercel.app"


async def generate_daily_briefing(site_id: str) -> dict:
    """Generate daily briefing content for a site.

    Returns: { subject: str, body_html: str, body_text: str }
    """
    now = datetime.now(timezone.utc)
    yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_end = yesterday_start + timedelta(days=1)
    y_start = yesterday_start.isoformat()
    y_end = yesterday_end.isoformat()

    # ── Gather data ────────────────────────────────────────────────────────────
    try:
        leads_24h = await db.query("leads", params={
            "select": "id,email,intent_score,tema_interes,asset_id,utm_source,created_at",
            "site_id": f"eq.{site_id}",
            "created_at": f"gte.{y_start}",
            "order": "intent_score.desc",
            "limit": "50",
        })
    except Exception:
        leads_24h = []

    try:
        new_content = await db.query("content_assets", params={
            "select": "id,title,slug,status,quality_score,score_humanity,score_specificity,score_structure,score_seo,score_readability,score_feedback,keyword,created_at,updated_at",
            "site_id": f"eq.{site_id}",
            "created_at": f"gte.{y_start}",
            "order": "created_at.desc",
            "limit": "20",
        })
    except Exception:
        new_content = []

    try:
        experiments = await db.query("experiments", params={
            "select": "id,hypothesis,status,target_metric",
            "site_id": f"eq.{site_id}",
            "status": "eq.running",
            "limit": "10",
        })
    except Exception:
        experiments = []

    try:
        new_insights = await db.query("knowledge_entries", params={
            "select": "insight,category,created_at",
            "site_id": f"eq.{site_id}",
            "created_at": f"gte.{y_start}",
            "order": "created_at.desc",
            "limit": "10",
        })
    except Exception:
        new_insights = []

    try:
        spend = await db.query("cost_events", params={
            "select": "cost_usd,model,pipeline_step",
            "created_at": f"gte.{y_start}",
            "limit": "500",
        })
        spend_total = round(sum(r.get("cost_usd", 0) for r in spend), 4)
    except Exception:
        spend_total = 0

    try:
        pending_approvals = await db.query("approvals", params={
            "select": "id,task_type,status,created_at",
            "site_id": f"eq.{site_id}",
            "status": "eq.pending",
            "limit": "10",
        })
    except Exception:
        pending_approvals = []

    try:
        top_articles = await db.query("content_assets", params={
            "select": "id,title,slug,status",
            "site_id": f"eq.{site_id}",
            "status": "eq.approved",
            "order": "created_at.desc",
            "limit": "5",
        })
        # Get lead counts
        articles_with_leads = []
        for a in top_articles:
            try:
                al = await db.query("leads", params={"select": "id", "asset_id": f"eq.{a['id']}", "limit": "50"})
                articles_with_leads.append({**a, "leads": len(al)})
            except Exception:
                articles_with_leads.append({**a, "leads": 0})
        articles_with_leads.sort(key=lambda x: x["leads"], reverse=True)
    except Exception:
        articles_with_leads = []

    # ── Performance analysis ───────────────────────────────────────────────────
    try:
        from packages.intelligence.performance_analyzer import analyze_content_performance
        perf = await analyze_content_performance(site_id)
    except Exception:
        perf = {"insights": [], "recommendations": [], "top_performers": [], "best_topic_cluster": None}

    # ── Synthesize with Haiku ──────────────────────────────────────────────────
    data_summary = {
        "leads_yesterday": len(leads_24h),
        "avg_intent": round(sum(l.get("intent_score", 0) for l in leads_24h) / max(len(leads_24h), 1), 1),
        "new_articles": len(new_content),
        "articles_in_review": len([a for a in new_content if a.get("status") == "review"]),
        "articles_approved": len([a for a in new_content if a.get("status") == "approved"]),
        "running_experiments": len(experiments),
        "new_insights": len(new_insights),
        "spend_usd": spend_total,
        "pending_approvals": len(pending_approvals),
        "top_article": articles_with_leads[0].get("title", "—") if articles_with_leads else "—",
        "top_article_leads": articles_with_leads[0].get("leads", 0) if articles_with_leads else 0,
        "top_leads_by_intent": [{"email": l["email"], "score": l.get("intent_score", 0), "tema": l.get("tema_interes", "")} for l in leads_24h[:3]],
        "experiments_running": [e.get("hypothesis", "")[:80] for e in experiments[:3]],
        "new_insights_list": [i.get("insight", "")[:100] for i in new_insights[:3]],
        "performance_insights": perf.get("insights", [])[:3],
        "performance_recommendations": perf.get("recommendations", [])[:2],
        "best_topic_cluster": perf.get("best_topic_cluster"),
    }

    try:
        ai = await complete(
            prompt=f"""Generate a daily CEO briefing for a growth system. Data from yesterday:

{json.dumps(data_summary, ensure_ascii=False, indent=2)}

Write a briefing with exactly 5 sections. Be specific with numbers. Be direct and actionable.
Respond in JSON:
{{
  "what_cerebro_did": "2-3 sentences: articles generated, experiments created, what was automated",
  "results": "2-3 sentences: leads captured, intent scores, which articles drove leads",
  "whats_working": "1-2 sentences: específicamente qué artículo/topic está convirtiendo leads, con datos de performance_insights si disponibles",
  "planned_today": "1-2 sentences: pending approvals, next content in pipeline",
  "needs_input": "1-2 sentences: items waiting for operator decision",
  "subject_line": "Email subject, max 60 chars, include key number"
}}""",
            system="You are a concise business intelligence assistant. Return only valid JSON.",
            model="haiku",
            json_mode=True,
            pipeline_step="briefing",
        )
        briefing = ai.get("parsed") or {}
    except Exception as e:
        logger.error(f"Briefing AI synthesis failed: {e}")
        briefing = {
            "what_cerebro_did": f"Generated {len(new_content)} articles and monitored {len(experiments)} experiments.",
            "results": f"Captured {len(leads_24h)} leads with avg intent score {data_summary['avg_intent']}.",
            "whats_working": articles_with_leads[0].get("title", "—") + f" ({articles_with_leads[0].get('leads', 0)} leads)" if articles_with_leads else "No data yet.",
            "planned_today": f"{len(pending_approvals)} items pending approval.",
            "needs_input": f"{len(pending_approvals)} approvals waiting for your review.",
            "subject_line": f"CEREBRO Daily: {len(leads_24h)} leads, ${spend_total} spend",
        }

    subject = briefing.get("subject_line") or f"CEREBRO Daily Briefing — {now.strftime('%b %d')}"

    body_html = _render_html(briefing, data_summary, articles_with_leads, now)
    body_text = _render_text(briefing, data_summary, now)

    return {"subject": subject, "body_html": body_html, "body_text": body_text}


async def send_daily_briefing(site_id: str, to_email: str) -> bool:
    """Generate and send the daily briefing to the operator email."""
    try:
        briefing = await generate_daily_briefing(site_id)
        sent = await send_email(
            to=to_email,
            subject=briefing["subject"],
            html=briefing["body_html"],
            from_name="CEREBRO",
        )
        if sent:
            logger.info(f"Daily briefing sent to {to_email} for site {site_id}")
        return sent
    except Exception as e:
        logger.error(f"Failed to send daily briefing: {e}")
        return False


def _render_html(briefing: dict, data: dict, articles: list, now: datetime) -> str:
    date_str = now.strftime("%A, %B %d, %Y")

    def section(icon: str, title: str, content: str) -> str:
        return f"""
    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:18px;">{icon}</span>
        <h2 style="color:#f1f5f9;font-size:15px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.5px;">{title}</h2>
      </div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0;padding-left:26px;">{content}</p>
    </div>"""

    def kpi(label: str, value: str, color: str = "#22c55e") -> str:
        return f"""
      <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px 20px;text-align:center;">
        <div style="color:{color};font-size:26px;font-weight:800;font-family:monospace;">{value}</div>
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">{label}</div>
      </div>"""

    intent_color = "#22c55e" if data["avg_intent"] >= 70 else "#f59e0b" if data["avg_intent"] >= 50 else "#ef4444"
    top_article_html = ""
    if articles:
        top = articles[0]
        top_article_html = f"""
    <div style="margin:24px 0;background:#0f2318;border:1px solid #22c55e33;border-radius:10px;padding:16px 20px;">
      <div style="color:#22c55e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">🏆 Top Article</div>
      <div style="color:#f1f5f9;font-size:14px;font-weight:600;">{top.get('title','—')}</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;">{top.get('leads', 0)} leads generados</div>
    </div>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CEREBRO Daily Briefing</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <!-- Header -->
    <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #1e293b;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="color:#22c55e;font-weight:800;font-size:20px;letter-spacing:2px;">⚡ CEREBRO</span>
        <span style="color:#475569;font-size:12px;">Daily Briefing</span>
      </div>
      <div style="color:#64748b;font-size:13px;margin-top:6px;">{date_str}</div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:32px;">
      {kpi("Leads ayer", str(data['leads_yesterday']))}
      {kpi("Intent score", str(data['avg_intent']), intent_color)}
      {kpi("LLM spend", f"${data['spend_usd']}", "#38bdf8")}
    </div>

    {top_article_html}

    <!-- Divider -->
    <div style="border-top:1px solid #1e293b;margin:24px 0;"></div>

    {section("🤖", "Qué hizo CEREBRO ayer", briefing.get('what_cerebro_did', '—'))}
    {section("📊", "Resultados", briefing.get('results', '—'))}
    {section("✅", "Qué está funcionando", briefing.get('whats_working', '—'))}
    {section("📋", "Planificado para hoy", briefing.get('planned_today', '—'))}
    {section("👆 Necesita tu atención", "Necesitas revisar", briefing.get('needs_input', '—'))}

    <!-- CTA -->
    <div style="margin:32px 0;text-align:center;">
      <a href="{DASHBOARD_URL}/dashboard"
         style="display:inline-block;background:#22c55e;color:#0f172a;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;margin-right:12px;">
        Ver Dashboard →
      </a>
      <a href="{DASHBOARD_URL}/dashboard/leads"
         style="display:inline-block;background:transparent;color:#22c55e;font-weight:600;font-size:14px;padding:14px 24px;border-radius:8px;text-decoration:none;border:1px solid #22c55e33;">
        Ver Leads →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1e293b;padding-top:20px;text-align:center;">
      <p style="color:#334155;font-size:12px;margin:0;">CEREBRO Growth OS · Generado automáticamente</p>
    </div>

  </div>
</body>
</html>"""


def _render_text(briefing: dict, data: dict, now: datetime) -> str:
    date_str = now.strftime("%A, %B %d, %Y")
    return f"""CEREBRO Daily Briefing — {date_str}

KPIs: {data['leads_yesterday']} leads | intent {data['avg_intent']} | ${data['spend_usd']} LLM spend

QUÉ HIZO CEREBRO:
{briefing.get('what_cerebro_did', '—')}

RESULTADOS:
{briefing.get('results', '—')}

QUÉ FUNCIONA:
{briefing.get('whats_working', '—')}

PLANIFICADO HOY:
{briefing.get('planned_today', '—')}

NECESITA TU ATENCIÓN:
{briefing.get('needs_input', '—')}

Ver dashboard: {DASHBOARD_URL}/dashboard
"""

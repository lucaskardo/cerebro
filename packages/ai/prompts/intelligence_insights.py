"""
CEREBRO v7 — Intelligence Insights Prompt Templates
"""

INSIGHTS_USER = (
    "Based on the following intelligence facts collected this week for a client, "
    "derive 3-5 concise, actionable business insights. Focus on patterns, "
    "opportunities, or risks the operator should act on.\n\n"
    "FACTS:\n{facts_text}\n\n"
    "Respond in JSON: "
    '{{"insights": [{{"title": "...", "body": "...", '
    '"type": "opportunity|threat|gap|trend|positioning|recommendation|anomaly", '
    '"impact_score": 0.0-10.0}}]}}'
)

INSIGHTS_SYSTEM = (
    "You are a growth strategist. Output ONLY valid JSON — no preamble, "
    "no explanation. Be specific and actionable."
)

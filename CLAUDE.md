# CEREBRO v7 — Project Instructions

## What is this
Autonomous SEO content + lead generation system. Creates articles, publishes them, captures leads, delivers to partners ($15-50/lead), and self-optimizes.

First client: ikigii (Towerbank app) targeting Colombians for USD accounts, remittances, offshore banking.

## Architecture
10 engines. Only Sprint 1 engines are built. Rest are future sprints.
```
Mission → Demand → Opportunity → Content → Experience
→ Social → Conversion → Lead → Measurement → Learning (AutoLoop)
```

## Stack
- Backend: FastAPI (Python) → apps/api/
- Frontend: Next.js 15 → apps/web/ (NEEDS CREATION)
- Database: Supabase PostgreSQL → schema.sql already run
- LLM: Claude API → packages/ai/
- Deploy: Railway (API) + Vercel (web)

## Files
```
cerebro/
├── .env                        ← API keys (never commit)
├── schema.sql                  ← DB schema (already in Supabase)
├── CLAUDE.md                   ← THIS FILE
│
├── apps/api/app/main.py        ← FastAPI: all endpoints
├── apps/api/pyproject.toml     ← Python deps
│
├── packages/core/__init__.py   ← DB client, config, cost tracker, logger
├── packages/ai/__init__.py     ← LLM wrapper + circuit breaker
├── packages/ai/prompts/content_prompts.py ← All prompts
├── packages/content/pipeline.py← brief→draft→humanize→validate
├── packages/content/seo_rules.py← SEO validation + schema markup
│
├── docs/program.md             ← AutoLoop protocol (Karpathy style)
├── scripts/test_pipeline.py    ← Test everything works
└── scripts/generate_sprint1.py ← Generate first 5 articles
```

## What works
- ✅ Supabase: 20 tables, seed data with ikigii mission + 2 clusters
- ✅ FastAPI: endpoints for missions, content, leads, alerts, budget
- ✅ Content pipeline: keyword → brief(haiku) → draft(sonnet) → humanize(haiku) → validate(rules)
- ✅ Cost circuit breaker: $30/day max, tracks every LLM call
- ✅ SEO rules: versioned, modular, schema markup generation

## What needs building NOW (in this order)

### 1. Test the pipeline
```bash
python scripts/test_pipeline.py
```
Fix any errors. Then generate articles:
```bash
python scripts/generate_sprint1.py
```

### 2. Create Next.js dashboard in apps/web/
Use Next.js 15 App Router + shadcn/ui + dark theme.
The API runs on localhost:8000. Use these endpoints:

Pages needed:
- `/dashboard` — Overview: call GET /api/status for KPIs (budget, content counts, leads today). Show alerts from GET /api/alerts.
- `/dashboard/content` — List from GET /api/content. Each item shows title, keyword, status, quality_score. Buttons: Approve (POST /api/content/{id}/review with action:"approve"), Reject (action:"reject"). Click item to see full article body from GET /api/content/{id}.
- `/dashboard/leads` — List from GET /api/leads. Show email, intent_score, origen_url, created_at.
- `/dashboard/generate` — Form with keyword input + mission selector. POST /api/content/generate with {mission_id, keyword}.

### 3. Deploy
- Railway: connect GitHub repo, add env vars from .env, it reads Procfile automatically
- Vercel: connect GitHub, set root to apps/web/, add NEXT_PUBLIC env vars

## Patterns to follow

### LLM calls — always through packages/ai/
```python
from packages.ai import complete
result = await complete(prompt="...", system="...", model="haiku", json_mode=True)
# result["text"], result["parsed"], result["cost"]
```

### Database — always through packages/core/
```python
from packages.core import db
items = await db.get("missions", status="eq.active")
item = await db.get_by_id("content_assets", some_id)
await db.insert("leads", {"email": "...", "intent_score": 75})
await db.update("content_assets", id, {"status": "approved"})
```

## API endpoints
```
GET  /health                    → {"status":"ok"}
GET  /api/status                → budget + content counts + leads today
GET  /api/missions              → list missions
POST /api/content/generate      → {mission_id, keyword} triggers pipeline
GET  /api/content               → list articles (filter: ?status=review)
GET  /api/content/{id}          → full article with body_md, body_html
POST /api/content/{id}/review   → {action:"approve"} or {action:"reject"}
POST /api/leads/capture         → {email, nombre, intent_score, ...}
GET  /api/leads                 → list leads
GET  /api/alerts                → active alerts
POST /api/alerts/{id}/dismiss   → dismiss alert
GET  /api/budget                → current spend vs limit
GET  /api/clusters              → topic clusters
```

## Rules
- Never hardcode API keys → env vars only
- Never hardcode prompts → packages/ai/prompts/
- All LLM costs tracked → circuit breaker depends on it
- Content needs human approval (no auto-publish yet)
- Author persona: "Carlos Medina" everywhere
- Max 2 partner (ikigii) mentions per article, natural only
- Supabase REST via httpx, not Python SDK

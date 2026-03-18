# CEREBRO — AI Demand Generation Engine

**Purpose:** Generate qualified leads and prove their origin through measurable attribution.
Content is ONE skill among many. The core loop is: Goal → Strategy → Skill → Lead → Attribution → Learning.

---

## What Is This System

CEREBRO is a multi-tenant AI demand generation engine. It:
- Runs a continuous strategy loop (goal → opportunity → experiment → task → outcome → learning)
- Generates SEO content informed by deep client market research
- Captures and qualifies leads with full UTM/attribution tracking
- Manages digital personas for social content distribution
- Tracks every lead from first pageview through to accepted/revenue

**Deployed at:**
- API: `https://web-production-c6ed5.up.railway.app` (Railway, FastAPI)
- Dashboard + Public site: Vercel (Next.js)
- DB: Supabase (project ID `dcnzgifhjezkeqvlkqne`)

---

## Running Locally

```bash
# Backend
cd /path/to/cerebro
cp .env.example .env   # fill in real values
pip install -r requirements.txt
python -m uvicorn apps.api.app.main:app --reload --port 8000

# Frontend
cd apps/web
npm install
npm run dev   # http://localhost:3000
```

**Run tests:**
```bash
pytest tests/ -v   # 16 smoke tests, ~1.5s, no real DB/AI calls
```

**Deploy:**
```bash
git push origin main   # Railway auto-deploys from main
```

---

## Environment Variables

All required unless marked optional.

```
# Supabase
SUPABASE_URL
SUPABASE_SERVICE_KEY
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

# AI Providers
ANTHROPIC_API_KEY         # Primary — claude-sonnet, claude-haiku
OPENAI_API_KEY            # Optional — gpt-4o for draft step
DEEPSEEK_API_KEY          # Optional — deepseek-chat for brief/humanize

# Other services
RESEND_API_KEY            # Email sending
EMAIL_FROM                # Sender address
SERPAPI_KEY               # Optional — keyword research

# Auth + Security
API_SECRET_KEY            # X-API-Key header value for dashboard
ENCRYPTION_KEY            # For persona identity encryption
MASTER_KEY                # For persona identity reveal

# Config
DAILY_BUDGET_USD          # Default: 30.0 — circuit breaker limit
PRIMARY_DOMAIN            # e.g. dolarizate.com
NEXT_PUBLIC_API_URL       # e.g. https://web-production-c6ed5.up.railway.app

# Feature flags (true/false)
ENABLE_AUTO_PUBLISH       # Auto-publish approved content (default: false)
ENABLE_DEMAND_ENGINE      # Demand signal processing (default: false)
ENABLE_AUTOLOOP           # Continuous strategy loop scheduler (default: false)
ENABLE_SOCIAL_ENGINE      # Social content distribution (default: false)
```

---

## File Map

```
cerebro/
├── apps/
│   ├── api/app/
│   │   ├── main.py                    ← FastAPI entry point, routers, middleware
│   │   ├── middleware/
│   │   │   ├── auth.py                ← X-API-Key enforcement + public whitelist
│   │   │   ├── rate_limit.py          ← 300 req/min auth, 60 public, 10 lead capture
│   │   │   └── logging_mw.py          ← request_id injection
│   │   ├── routers/
│   │   │   ├── system.py              ← health, status, alerts, missions, sites, flags
│   │   │   ├── content.py             ← content generation + approval pipeline
│   │   │   ├── leads.py               ← lead capture, state machine, outcomes
│   │   │   ├── strategy.py            ← goals, strategies, knowledge entries
│   │   │   ├── execution.py           ← opportunities, experiments, tasks, approvals
│   │   │   ├── attribution.py         ← tracking, funnels, attribution reports
│   │   │   ├── intelligence.py        ← client profiles, market research
│   │   │   ├── personas.py            ← personas, identities, social queue
│   │   │   └── loop.py                ← strategy loop trigger + history
│   │   └── schemas/                   ← Pydantic request/response models
│   │       ├── content.py
│   │       ├── leads.py
│   │       ├── strategy.py
│   │       ├── execution.py
│   │       ├── personas.py
│   │       └── loop.py
│   │
│   └── web/src/
│       ├── app/
│       │   ├── page.tsx               ← Home (public)
│       │   ├── articulo/[slug]/       ← Article renderer (public)
│       │   ├── herramientas/          ← Calculator + Quiz tools (public)
│       │   ├── marca/[slug]/          ← Multi-tenant brand pages (public)
│       │   └── dashboard/
│       │       ├── page.tsx           ← Overview
│       │       ├── content/           ← Content list + manage
│       │       ├── leads/             ← Lead management
│       │       ├── attribution/       ← Funnel + Revenue by Asset
│       │       ├── strategy/          ← Goals + Strategy proposals
│       │       ├── intelligence/      ← Client profiles + market research
│       │       ├── experiments/       ← A/B test management
│       │       ├── approvals/         ← Content approval queue
│       │       ├── personas/          ← Persona management
│       │       └── system/            ← Budget + health
│       └── lib/api.ts                 ← All typed API calls (fetchAPI + authHeaders)
│
├── packages/
│   ├── core/__init__.py               ← db, config, cost_tracker, get_logger, create_alert
│   ├── ai/__init__.py                 ← complete(), BudgetExceededError, multi-provider routing
│   ├── ai/prompts/content_prompts.py  ← All content prompt templates (NEVER hardcode prompts elsewhere)
│   ├── content/pipeline.py            ← keyword → research → brief → draft → humanize → validate
│   ├── content/seo_rules.py           ← SEO validation rules
│   ├── content/prompt_store.py        ← Prompt versioning in DB
│   ├── intelligence/__init__.py       ← ClientIntelligence class (research_client, get_content_context)
│   ├── strategy/__init__.py           ← plan_opportunities, generate_strategies, execute_strategy
│   ├── strategy/evaluator.py          ← Experiment scoring
│   ├── strategy/knowledge.py          ← Knowledge entry management
│   ├── loop/__init__.py               ← run_cycle (supervised loop with kill switches)
│   ├── skills/__init__.py             ← Skill base class + registry (list_skills, get_skill)
│   ├── skills/persona_content_adapter.py
│   ├── skills/social_adapter.py
│   ├── attribution/__init__.py        ← track_event, get_funnel, get_attribution_report
│   ├── email/__init__.py              ← send_welcome_email, send_calculator_results_email
│   ├── images/__init__.py             ← Hero image generation
│   └── jobs/__init__.py               ← Background job worker + maintenance scheduler
│
├── migrations/                        ← SQL migrations 001–013 (apply via Supabase MCP)
├── tests/test_smoke.py                ← 16 structural smoke tests
├── Procfile                           ← Railway: uvicorn on $PORT
├── railway.toml                       ← Railway: Dockerfile builder
├── requirements.txt
└── .env.example
```

---

## Architecture: Skills + Strategy Loop

### The Strategy Loop (runs continuously or on-demand)
```
Goal
  → plan_opportunities (AI generates 3-5 candidates from goal + knowledge + facts)
  → _score_opportunity (heuristic 0-100 based on channel performance data)
  → experiment created (hypothesis + variant_a/b)
  → tasks auto-run (safe skills: content_creation, email_nurturing)
  → tasks queued for approval (community, social, outreach)
  → outcomes measured → knowledge_entries updated
  → next cycle informed by new knowledge
```

Kill switches: daily cost > $30, error rate > 30% in 1h, 3 consecutive bad experiments.

### Skills (modular capabilities, each has approval_policy + retry_policy)
- **content_creation** — keyword → SEO article → review queue
- **lead_capture** — forms + intent scoring
- **email_nurturing** — Resend emails (welcome, calculator results)
- **community_engagement** — Draft forum/Reddit responses (requires_approval)
- **social_distribution** — Content → social posts via persona identities

### Client Intelligence Layer
Every content and strategy decision is informed by deep client research.

**Onboarding flow:**
1. `POST /api/intelligence/research` with `{site_id, company, country, industry}`
2. AI runs $50K-consulting-style analysis: pain points, competitors, content angles, buying triggers
3. Stored in `client_profiles` + `market_research` tables
4. `get_content_context(site_id)` injects this into EVERY content prompt
5. `get_strategy_context(site_id)` injects this into EVERY strategy prompt
6. Refresh anytime: `POST /api/intelligence/refresh/{site_id}`

Key file: `packages/intelligence/__init__.py` — `ClientIntelligence` class
Fallback: if no profile, uses `domain_sites` brand fields. NEVER returns empty string.

### Content Pipeline
```
keyword → _check_duplicate (Jaccard ≥ 80% → skip)
        → get_content_context(site_id) → brand dict
        → _research_keyword (haiku, SerpAPI context)
        → _generate_brief (haiku, client intelligence injected)
        → _generate_draft (sonnet, client intelligence injected)
        → _humanize (haiku)
        → _validate (rule-based: word count, SEO, brand safety)
        → status = "review" (human approval required)
        → on approve: _inject_utm_params → body_html published
```
Model routing: brief/humanize → DeepSeek or haiku, draft → OpenAI/sonnet, research/strategy → Anthropic

---

## Database: 48 Tables

### Core (001_core.sql)
- `missions` — top-level mission config (partner, country, topics, CTA)
- `domain_sites` — multi-tenant sites (brand_name, brand_persona, brand_tone, brand_topics, brand_cta, brand_audience)
- `cost_events` — every LLM call tracked (provider, model, tokens, cost)
- `operator_alerts` — system alerts shown in dashboard
- `seo_rule_versions` — SEO rule config versions
- `demand_signals` — keyword/topic demand signals from external sources

### Content (002_content.sql)
- `clusters` — topic clusters for content planning
- `opportunities` — detected content/channel opportunities (query, pain_point, audience, channel, confidence)
- `content_assets` — articles (title, slug, keyword, body_md, body_html, status, quality_score)
- `pages` — landing pages
- `social_content_queue` — queued social posts per persona
- `email_sequences` — email drip sequences

### Leads (003_leads.sql)
- `leads` — captured leads (email, nombre, telefono, utm_*, visitor_id, session_id, asset_id, cta_variant, intent_score, current_status)
- `lead_events` — state machine transitions (from_status, to_status, reason)
- `lead_outcomes` — final conversion results (status, revenue_value, partner)
- `partner_deliveries` — lead delivery records to partners

### Strategy (004_strategy.sql)
- `goals` — demand gen goals (description, target_metric, target_value, current_value, status)
- `strategies` — AI-generated strategies (channel, skills_needed, estimated_leads, confidence_score, status)
- `strategy_variations` — autosearch variations with simulation scores
- `knowledge_entries` — what the system learns (category, insight, confidence, evidence, metric_name, metric_value)
- `compliance_rules` — per-mission brand/legal/geographic constraints

### Attribution (005_attribution.sql)
- `attribution_events` — legacy event log
- `visitors` — fingerprint-based visitor records (site_id, fingerprint_hash, first_seen, last_seen)
- `sessions` — visit sessions (visitor_id, source, medium, campaign, referrer, landed_on)
- `touchpoints` — granular events per session (page_view, cta_click, calculator_complete, form_submit)

### Multi-brand (006_multibrand.sql)
- `partner_webhooks` — webhook configs per partner
- `cta_variants` — CTA variant definitions per site
- `content_versions` — content A/B version history

### Personas (007_personas.sql)
- `personas` — digital personas (name, age, city, backstory, personality_traits, platforms, posting_schedule)
- `persona_identities` — platform accounts per persona (handle, encrypted password, API keys)
- `social_schedule_config` — posting schedule per persona/platform

### Operations (008_operations.sql)
- `channel_performance` — daily channel metrics (channel, date, visits, leads, qualified_leads, conversions, cost, revenue)
- `fact_daily_asset_performance` — daily per-asset metrics
- `fact_daily_channel_performance` — daily per-channel fact table
- `metrics_daily` — aggregated daily business metrics

### Execution (009_execution.sql)
- `tasks` — skill execution tasks (skill_name, input_json, status, output_json, attempts, actual_cost)
- `skill_runs` — individual skill execution records
- `experiments` — A/B experiments (hypothesis, variant_a/b_json, visits_a/b, winner, learnings)
- `jobs` — background job queue

### Social (010_social.sql)
- Additional social platform fields and triggers

### Cycle Runs (011_cycle_runs.sql)
- `cycle_runs` — strategy loop run history (status, opportunities_generated, experiments_created, tasks_auto_run, tasks_queued_approval, kill_reason)

### Maintenance (012_maintenance.sql)
- `audit_log` — every mutative API action logged
- `backup_snapshots` — DB backup tracking
- `retention_policies` — data retention config

### Client Intelligence (013_client_intelligence.sql)
- `client_profiles` — per-site market research (company_name, country, pain_points, competitors, content_angles, buying_triggers, research_depth, research_version)
- `market_research` — append-only research log (research_type, query, findings, structured_data, confidence)

**Also present (created by migrations/seeding):**
- `approvals` — human approval queue (entity_type, entity_id, action, status)
- `feature_flags` — runtime feature toggles
- `prompt_versions` — content prompt version history

---

## API Endpoints (89 total)

### Auth
All endpoints require `X-API-Key: <API_SECRET_KEY>` header EXCEPT:
- `GET /health`, `GET /api/status`, `GET /api/sites`, `GET /api/sitemap`
- `GET /api/health/business`, `GET /api/loop/status`
- `POST /api/leads/capture`, `POST /api/attribution/event`
- `POST /api/tracking/visitor`, `POST /api/tracking/session`, `POST /api/tracking/event`
- `GET /api/content/*`, `GET /api/content/by-slug/*`

### System
```
GET  /health                        → liveness check
GET  /api/status                    → budget + content counts + feature flags
GET  /api/health/business           → leads, conversions, revenue, error rate
GET  /api/budget                    → spent/remaining/warning
GET  /api/budget/history            → daily cost summary
GET  /api/alerts                    → undismissed alerts
POST /api/alerts/{id}/dismiss
GET  /api/missions                  → list missions
GET  /api/missions/{id}
GET  /api/sites                     → list active sites
GET  /api/sites/{id}
GET  /api/clusters                  → topic clusters
GET  /api/demand                    → demand signals
GET  /api/sitemap                   → approved articles for sitemap
GET  /api/flags                     → feature flags
PATCH /api/flags/{id}               → toggle feature flag
```

### Content
```
POST /api/content/generate          → body: {keyword, mission_id, site_id?}
GET  /api/content                   → ?status=&site_id=&limit=
GET  /api/content/by-slug/{slug}    → public
GET  /api/content/{id}              → public
GET  /api/content/{id}/image        → generate hero image
POST /api/content/{id}/review       → body: {action: "approve"|"reject"}
```

### Leads (state machine: new → confirmed → nurturing → qualified → delivered → accepted/rejected → closed)
```
GET  /api/leads                     → ?site_id=&status=&limit=
GET  /api/leads/{id}
POST /api/leads/capture             → PUBLIC — body: {email, nombre, utm_*, asset_id, site_id, ...}
POST /api/leads/{id}/transition     → body: {to_status, reason}
GET  /api/leads/{id}/outcome
POST /api/leads/{id}/outcome        → body: {status, revenue_value, partner}
```

### Strategy
```
POST /api/goals                     → body: {description, target_metric, target_value}
GET  /api/goals
POST /api/strategies/generate       → ?goal_id=
GET  /api/strategies                → ?goal_id=
POST /api/strategies/{id}/approve
POST /api/strategies/{id}/run
GET  /api/knowledge                 → ?category=&limit=
POST /api/knowledge
GET  /api/knowledge/insights        → ?limit= — top by confidence
```

### Execution
```
POST /api/opportunities             → create
GET  /api/opportunities             → ?goal_id=&site_id=&execution_status=
GET  /api/opportunities/{id}
PATCH /api/opportunities/{id}/status
POST /api/opportunities/plan        → ?goal_id=&site_id= — AI generates opportunities
POST /api/experiments
GET  /api/experiments               → ?site_id=&status=&opportunity_id=
GET  /api/experiments/{id}
POST /api/experiments/{id}/evaluate
PATCH /api/experiments/{id}
POST /api/tasks
GET  /api/tasks                     → ?site_id=&experiment_id=&status=&limit=
GET  /api/tasks/{id}
POST /api/tasks/{id}/run
GET  /api/approvals                 → ?status=pending&site_id=
POST /api/approvals/{id}/resolve    → body: {action: "approve"|"reject", notes?}
```

### Intelligence
```
POST /api/intelligence/research     → body: {site_id, company, country, company_url?, industry?}
GET  /api/intelligence/profile/{site_id}
PATCH /api/intelligence/profile/{site_id}
GET  /api/intelligence/research-log/{site_id}  → ?limit=
POST /api/intelligence/refresh/{site_id}       → body: {focus_areas?: [...]}
```

### Attribution + Reports
```
POST /api/tracking/visitor          → PUBLIC — {site_id, fingerprint_hash?}
POST /api/tracking/session          → PUBLIC — {site_id, visitor_id, source, ...}
POST /api/tracking/event            → PUBLIC — {site_id, event_type, asset_id, ...}
POST /api/attribution/event         → PUBLIC (legacy)
GET  /api/attribution/funnel        → ?days=30
GET  /api/attribution/report        → ?days=30
GET  /api/reports/funnel            → ?days=&site_id= — visitors→sessions→leads→qualified
GET  /api/reports/leads-by-asset    → ?days=&site_id=
GET  /api/reports/leads-by-brand    → ?days=
GET  /api/reports/leads-by-cta      → ?days=&site_id=
GET  /api/reports/revenue-by-asset  → ?site_id=
GET  /api/reports/attribution-chain → ?days=&site_id= — full chain with revenue
GET  /api/channels/performance      → ?days=&site_id=
```

### Personas
```
GET  /api/personas                  → ?site_id=
POST /api/personas
GET  /api/personas/{id}
PATCH /api/personas/{id}
GET  /api/personas/{id}/identities  → ?reveal=true requires X-Master-Key
POST /api/personas/{id}/identities
PUT  /api/personas/identities/{id}
DELETE /api/personas/identities/{id}
POST /api/personas/{id}/email/send
GET  /api/social/queue              → ?persona_id=&platform=&status=&limit=
PATCH /api/social/queue/{id}
GET  /api/personas/{id}/schedule
PUT  /api/personas/{id}/schedule
```

### Loop
```
POST /api/loop/run                  → body: {dry_run?: bool}
GET  /api/loop/history              → ?limit=
GET  /api/loop/status               → PUBLIC — scheduler status + last cycle
```

---

## Core Rules

1. **All LLM calls through `packages/ai/complete()`** — never call Anthropic/OpenAI directly
2. **All DB calls through `packages/core/db`** — never use Supabase client directly
3. **Cost circuit breaker: $30/day** — `BudgetExceededError` is raised, not swallowed
4. **Content requires human approval** — pipeline sets status="review", not "approved"
5. **Never hardcode prompts** — all prompts in `packages/ai/prompts/`
6. **Never hardcode keys** — all config from environment via `packages/core/config`
7. **Client intelligence is mandatory** — `get_content_context(site_id)` must be called before content generation; empty profile = warning banner in dashboard
8. **No schema changes without migrations** — add a new `migrations/0XX_name.sql` and apply via Supabase MCP

---

## Client Intelligence Layer

When a new client/site is onboarded:
1. Operator provides: company name, country, industry, website
2. System runs deep market research via `POST /api/intelligence/research`
3. Research stored in `client_profiles` + `market_research` tables
4. ALL content generation uses `ClientIntelligence.get_content_context(site_id)`
5. ALL strategy decisions use `ClientIntelligence.get_strategy_context(site_id)`
6. Research refreshable via `POST /api/intelligence/refresh/{site_id}` with optional `focus_areas`

The system NEVER generates generic marketing content.
Every piece of content is informed by:
- Client's value proposition and differentiators
- Target audience pain points and desires
- Competitor landscape and positioning gaps
- Market trends and buying triggers

Key module: `packages/intelligence/__init__.py` — `ClientIntelligence` class
Key method: `get_content_context(site_id)` — injected into ALL content prompts
Key method: `get_strategy_context(site_id)` — injected into ALL strategy prompts

---

## AI Provider Routing

```python
# packages/ai/__init__.py — model routing by pipeline_step
"brief"      → DeepSeek (cheapest, fast)
"humanize"   → DeepSeek
"draft"      → OpenAI gpt-4o (quality)
"strategy_*" → Anthropic sonnet (best reasoning)
"research"   → Anthropic sonnet
default      → Anthropic haiku (fallback)
```

Available model aliases: `haiku`, `sonnet`, `gpt4o`, `gpt4o-mini`, `deepseek`

---

## What Still Needs Building

Priority order from strategy:
- `attribution` skill — proper UTM chain close loop
- `community_engagement` — Reddit/forum draft responses (approval required)
- `whatsapp` — WhatsApp Business API for lead qualification
- `outreach` — backlink building, collaborative content
- `social_distribution` — article → Instagram/TikTok/X/LinkedIn posts
- `conversion_optimizer` — A/B test headlines, CTAs, layouts
- Autosearch explorer — generate many strategy variations automatically
- Continuous loop scheduler (ENABLE_AUTOLOOP=true when ready)

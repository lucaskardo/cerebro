# CEREBRO — Growth Operating System

## What This Is
Industry-agnostic lead generation engine. Generates content, captures leads,
tracks attribution, learns from results, and improves autonomously.
NOT fintech-specific — works for any segment via mission + site config.

## Production URLs
- API (Railway): https://web-production-c6ed5.up.railway.app
- Web (Vercel): https://web-ten-woad-99.vercel.app
- Supabase: https://dcnzgifhjezkeqvlkqne.supabase.co
- GitHub: github.com/lucaskardo/cerebro

## Architecture
```
cerebro/
├── apps/
│   ├── api/app/
│   │   ├── main.py              # FastAPI app, mounts routers + middleware
│   │   ├── routers/             # 9 routers: system, content, leads, strategy,
│   │   │                        #   personas, attribution, execution, loop, intelligence
│   │   ├── schemas/             # Pydantic models: content, leads, execution,
│   │   │                        #   strategy, personas, loop (7 files)
│   │   └── middleware/          # auth.py, logging_mw.py, ratelimit.py
│   └── web/src/app/
│       ├── dashboard/           # Operator dashboard (sidebar layout)
│       │   ├── layout.tsx       # Sidebar + header + brand selector
│       │   ├── page.tsx         # Business Health home
│       │   ├── leads/           # Lead management
│       │   ├── content/         # Content management
│       │   ├── strategy/        # Goals + opportunities
│       │   ├── experiments/     # Experiment tracking
│       │   ├── attribution/     # Funnel + revenue tracking
│       │   ├── approvals/       # Approval queue
│       │   ├── intelligence/    # Client profile + market research
│       │   ├── personas/        # AI persona management
│       │   └── system/          # Jobs, flags, alerts, audit log
│       ├── articulo/[slug]/     # Public article renderer
│       ├── marca/[slug]/        # Brand landing pages
│       └── herramientas/        # Public tools (calculator, quiz)
├── packages/
│   ├── core/__init__.py         # SupabaseClient, Config, CostTracker, logger
│   ├── core/crypto.py           # Encryption for persona identities
│   ├── core/flags.py            # Feature flag helpers
│   ├── ai/__init__.py           # Multi-provider: Anthropic/OpenAI/DeepSeek
│   ├── ai/prompts/              # All prompt templates (NEVER inline prompts)
│   ├── content/pipeline.py      # research → brief → draft → humanize → validate
│   ├── content/seo_rules.py     # SEO validation
│   ├── intelligence/__init__.py # ClientIntelligence: research + profile + context
│   ├── strategy/__init__.py     # Opportunity planner
│   ├── strategy/evaluator.py    # Experiment evaluator
│   ├── strategy/knowledge.py    # Knowledge updater
│   ├── skills/__init__.py       # Skill ABC + registry
│   ├── jobs/__init__.py         # Persistent queue with idempotency + DLQ
│   ├── loop/__init__.py         # Supervised cycle with kill switches
│   ├── attribution/__init__.py  # Attribution tracking
│   ├── email/__init__.py        # Resend email
│   └── images/__init__.py       # Image generation
├── migrations/                  # 001-013, ~48 tables (numbered, run in order)
├── tests/test_smoke.py          # Pytest smoke tests
└── .github/workflows/ci.yml    # CI: pytest + next build
```

## Database: ~48 Tables (Supabase/PostgreSQL)
Core: missions, domain_sites, cost_events, operator_alerts
Content: clusters, content_assets, content_versions, pages, cta_variants,
         prompt_versions, seo_rule_versions, social_content_queue
Leads: leads, lead_events, lead_outcomes, partner_deliveries, partner_webhooks
Strategy: goals, strategies, strategy_variations, knowledge_entries,
          compliance_rules, opportunities, experiments
Attribution: attribution_events, channel_performance, metrics_daily, visitors,
             sessions, touchpoints, fact_daily_asset_performance,
             fact_daily_channel_performance
Intelligence: client_profiles, market_research
Multi-brand: domain_sites (brand columns), email_sequences
Personas: personas, persona_identities, social_schedule_config
Operations: jobs, audit_log, approvals, feature_flags, demand_signals,
            backup_snapshots, retention_policies
Execution: tasks, skill_runs
Loop: cycle_runs

## Key Design Decisions
- site_id on every table (multi-brand isolation)
- Chain: Goal → Opportunity → Experiment → Task Graph → Skill Runs → Outcomes → Learnings
- Lead lifecycle: new → confirmed → nurturing → qualified → delivered → accepted/rejected
- Client Intelligence: client_profiles + market_research feed ALL content and strategy
- Auth: X-API-Key for mutations + dashboard GETs, whitelist for public endpoints
- Jobs: persistent with idempotency keys, retries, dead letter queue
- Content pipeline always uses client intelligence context (never generic)
- Prompts are parametrized templates (never hardcoded to a niche)

## Client Intelligence Layer
CEREBRO maintains a living memory of each client's business and market.

When a new client is onboarded:
1. Operator provides: company name, country, industry, website
2. System runs deep market research automatically
3. Research is stored in client_profiles and market_research tables
4. ALL content generation uses client intelligence (never generic)
5. ALL strategy decisions use client intelligence
6. Research can be refreshed anytime to incorporate new findings

The system NEVER generates generic marketing content.
Every piece of content must be informed by:
- Client's value proposition and differentiators
- Target audience pain points and desires
- Competitor landscape and positioning gaps
- Market trends and buying triggers

If no client_profile exists for a site, the system warns the operator
and uses minimal brand context from domain_sites as fallback.

## Environment Variables (required)
```
SUPABASE_URL, SUPABASE_SERVICE_KEY    # Database
ANTHROPIC_API_KEY                      # Primary AI provider
API_SECRET_KEY                         # Auth for dashboard/mutations
DAILY_BUDGET_USD                       # Cost circuit breaker (default 30)
```

## Environment Variables (optional)
```
OPENAI_API_KEY, DEEPSEEK_API_KEY       # Alternative AI providers
SERPAPI_KEY                            # Web search for research
RESEND_API_KEY, EMAIL_FROM             # Email sending
ENCRYPTION_KEY, MASTER_KEY             # Persona identity encryption
ALLOWED_ORIGINS                        # Extra CORS origins
PRIMARY_DOMAIN                         # Main domain
```

## How to Run
```bash
# API locally
cd apps/api && uvicorn app.main:app --reload --port 8000

# Web locally
cd apps/web && npm run dev

# Tests
pytest tests/ -v

# Deploy API (Railway auto-deploys on push)
git push origin main

# Deploy Web (from apps/web directory)
cd apps/web && npx vercel --prod --yes
```

## API Endpoints (Public — no auth)
```
GET  /health
GET  /api/status
GET  /api/sites
GET  /api/sitemap
GET  /api/health/business
GET  /api/loop/status
GET  /api/content/by-slug/{slug}
GET  /api/content/*
POST /api/leads/capture
POST /api/attribution/event
POST /api/tracking/visitor|session|event
```

## API Endpoints (Auth required — X-API-Key header)
```
# Content
GET/POST /api/content, /api/content/generate, /api/content/{id}/review
GET/POST /api/clusters

# Leads
GET /api/leads, /api/leads/{id}, /api/leads/{id}/outcome
POST /api/leads/{id}/transition, /api/leads/{id}/outcome

# Strategy
GET/POST /api/goals, /api/strategies, /api/strategies/generate
POST /api/strategies/{id}/approve, /api/strategies/{id}/run
GET/POST /api/opportunities, /api/opportunities/plan
GET/PATCH /api/opportunities/{id}
GET/POST /api/experiments, /api/experiments/{id}/evaluate

# Attribution & Reports
GET /api/attribution/report, /api/attribution/funnel, /api/channels/performance
GET /api/reports/attribution-chain, /api/reports/funnel
GET /api/reports/leads-by-asset, /api/reports/leads-by-brand
GET /api/reports/leads-by-cta, /api/reports/revenue-by-asset

# Intelligence
POST /api/intelligence/research
GET  /api/intelligence/profile/{site_id}
PATCH /api/intelligence/profile/{site_id}
GET  /api/intelligence/research-log/{site_id}
POST /api/intelligence/refresh/{site_id}

# Knowledge
GET /api/knowledge, /api/knowledge/insights

# Personas
GET/POST /api/personas, /api/personas/{id}
GET/POST /api/personas/{id}/identities
GET/PATCH /api/personas/{id}/schedule
POST /api/personas/{id}/email/send

# System
GET /api/alerts, /api/flags, /api/budget, /api/budget/history
GET /api/missions, /api/sites, /api/demand
GET /api/tasks, /api/tasks/{id}
GET /api/approvals
POST /api/loop/run, /api/flags/{id}, /api/alerts/{id}/dismiss
POST /api/approvals/{id}/resolve, /api/tasks/{id}/run
```

## Critical Rules
1. NEVER generate generic content — always use client_profiles intelligence
2. Every endpoint MUST have try/except (return empty data, never 500)
3. Every table MUST have site_id
4. All dashboard pages MUST be "use client" with useEffect + loading skeleton
5. All prompts in packages/ai/prompts/ — never inline
6. All schemas in apps/api/app/schemas/ — never inline in routers
7. Test every new endpoint with a smoke test
8. System is industry-agnostic — no hardcoded niche references in code

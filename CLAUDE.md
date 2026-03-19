## SPEED RULES (MANDATORY FOR ALL TASKS)
1. NEVER use brainstorming, writing-plans, or code-reviewer skills
2. NEVER use worktrees — work directly on main
3. NEVER write design docs or plan documents
4. NEVER do spec reviews or code quality reviews
5. Execute directly: read → implement → test → push
6. Maximum 10 minutes per session
7. If tests pass, it ships

## What is CEREBRO
Autonomous Growth Operating System. First client: NauralSleep (mattresses, Panama).

## Production URLs
- API: https://web-production-c6ed5.up.railway.app (Railway, FastAPI)
- Dashboard: https://web-ten-woad-99.vercel.app (Vercel, Next.js)
- Public site: https://colchonespanama.com (Vercel, Next.js)
- Supabase: dcnzgifhjezkeqvlkqne
- NauralSleep site_id: d3920d22-2c34-40b1-9e8e-59142af08e2a

## Architecture
cerebro/ (monorepo)
├── apps/api/          → Railway (FastAPI)
├── apps/web/          → Vercel (Dashboard)
├── apps/sites/colchones-panama/ → Vercel (Public site)
├── packages/core/     → DB client, scoring, utils
├── packages/ai/       → LLM providers (Anthropic, OpenAI, DeepSeek)
├── packages/content/  → Content pipeline
├── packages/intelligence/ → Intelligence Layer (NEW)
│   ├── service.py     → IntelligenceService (context builders)
│   ├── updater.py     → Event listeners (on_lead, on_sale, on_content)
│   ├── analyzer.py    → Weekly analyzer (8 phases, 2x/week)
│   └── migrate.py     → Data migration from blob to structured
├── packages/conversation/ → Chat engine
├── migrations/        → 001-020
└── tests/             → 34 smoke tests passing

## Intelligence Layer (CURRENT STATE)
11 tables: intelligence_entities, intelligence_observations, intelligence_facts,
intelligence_fact_evidence, intelligence_relations, intelligence_insights,
discovery_candidates, discovery_policies, research_runs,
intelligence_context_receipts + intelligence_receipt_facts,
monthly_observation_rollups

8 SQL functions: upsert_intelligence_fact (atomic ON CONFLICT),
update_fact_utility (atomic diminishing returns), claim_unprocessed_observations
(FOR UPDATE SKIP LOCKED), mark_observations_processed, rollup_observations_monthly,
decay_stale_facts, check_entity_completeness, update_updated_at trigger

Current data: 37 entities, 46 facts, 62 relations for NauralSleep

Entity types: product, competitor, brand, store, competitor_product, segment,
pain_point, objection, channel, persona, location, feature, promotion

IMPORTANT: "competitor" is being migrated to "brand" (real competitors) and
"store" (distribution channels/partners). Brands compete with you. Stores sell
brands. A store is NOT a competitor — it's a potential partner.

## Content Pipeline
Research → Brief → Sources → Draft (Sonnet) → Internal Links → Humanize →
Anti-words → Score (Haiku) → Review
Uses IntelligenceService.for_content() for context (falls back to old blob if empty)
body_html generated from body_md via Python markdown lib (not LLM)

## Key Conventions
- Supabase REST API (PostgREST) — use db.query() and db.rpc()
- All JSONB arrays, not TEXT arrays (Supabase compat)
- fact_key naming: {entity_type}.{entity_slug}.{metric_type}
- Tags always slug format: dolor_espalda (no spaces, no accents)
- Background tasks: asyncio.create_task for non-blocking
- Every endpoint needs try/except
- CORS: add new domains to main.py static list
- Auth: public endpoints need explicit entry in PUBLIC_GET_PREFIXES

## Lessons Learned (CRITICAL)
1. CORS must be added BEFORE deploying new domains
2. Trailing slashes matter in PUBLIC_GET_PREFIXES
3. Never hardcode local paths (crashes Vercel)
4. CSS position:fixed breaks grid layout
5. JSONB arrays must use read-modify-write pattern
6. Chat tools need site_id injected (Claude invents UUIDs)
7. Railway kills bg tasks on restart — always handle CancelledError
8. Anthropic timeout needs 180s for Sonnet full articles
9. max_tokens=2048 truncates JSON — use 4096 for briefs
10. body_html should be generated in Python, not LLM (saves tokens)

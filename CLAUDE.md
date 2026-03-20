## SPEED RULES (MANDATORY FOR ALL TASKS)
1. NEVER use brainstorming, writing-plans, or code-reviewer skills
2. NEVER use worktrees — work directly on main
3. NEVER write design docs or plan documents
4. NEVER do spec reviews or code quality reviews
5. Execute directly: read → implement → test → push
6. Maximum 10 minutes per session (25 for intelligence layer fixes)
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
├── packages/core/     → DB client (raw Supabase REST), scoring, utils
├── packages/ai/       → LLM providers (Anthropic, OpenAI, DeepSeek)
├── packages/content/  → Content pipeline
├── packages/intelligence/ → Intelligence Layer v2
│   ├── __init__.py    → ClientIntelligence (OLD blob research — legacy, still used by chat)
│   ├── service.py     → IntelligenceService (NEW pure-SQL context builders)
│   ├── updater.py     → Event listeners (on_lead, on_sale, on_content)
│   ├── analyzer.py    → Weekly analyzer (8 phases, 2x/week)
│   ├── context_builder.py → Per-article focused context (Haiku call)
│   ├── performance_analyzer.py → Content performance analysis
│   └── migrate.py     → Seed structured layer from client_profiles blob
├── packages/conversation/ → Chat engine (still reads client_profiles — TODO: migrate to v2)
├── migrations/        → 001-022
└── tests/             → 34 smoke tests passing

## Intelligence Layer v2 (CURRENT STATE)
11 tables: intelligence_entities, intelligence_observations, intelligence_facts,
intelligence_fact_evidence, intelligence_relations, intelligence_insights,
discovery_candidates, discovery_policies, research_runs,
intelligence_context_receipts + intelligence_receipt_facts,
monthly_observation_rollups

8 SQL functions: upsert_intelligence_fact (atomic ON CONFLICT),
update_fact_utility (atomic diminishing returns), claim_unprocessed_observations
(FOR UPDATE SKIP LOCKED — returns normalized_tags + source_ref),
mark_observations_processed, rollup_observations_monthly (idempotent delete+insert),
decay_stale_facts, check_entity_completeness, update_updated_at trigger

Entity types: product, competitor, competitor_product, brand, store, segment,
pain_point, objection, channel, persona, location, feature, promotion, market, other

Relation types: solves, recommended_for, cheaper_than, competes_with, targets,
supports, contradicts, related_to, derived_from, sold_at, owned_by, belongs_to,
potential_partner, competes_directly_with, alternative_to, stronger_than,
best_response_to, upsells_to, cross_sells_with, mentioned_together, triggers,
causes, converts_to

Unique index on relations: uq_relations_entity_pair(site_id, COALESCE(from_entity_id), COALESCE(to_entity_id), relation_type)

## SCHEMA-RUNTIME CONTRACT (CRITICAL — READ THIS)
These are the EXACT column names. Using wrong names silently returns empty data via PostgREST.

intelligence_facts columns: id, site_id, entity_id, fact_key, category (NOT fact_type),
  value_text, value_number, value_json, confidence, utility_score, evidence_count,
  quarantined, tags, source, last_verified, created_at, updated_at
  CONSTRAINT: exactly_one_value — exactly one of value_text/value_number/value_json must be non-null

intelligence_entities columns: id, site_id, entity_type, name (NOT display_name),
  slug (NOT entity_key), description, status, metadata, created_at, updated_at
  UNIQUE(site_id, entity_type, slug)

intelligence_context_receipts columns: id, site_id, consumer_type (NOT context_type),
  consumer_ref (NOT prompt_hash), facts_count, created_at
  consumer_type CHECK: 'content_pipeline','strategy_planner','persona','loop','other'

intelligence_receipt_facts columns: receipt_id, fact_id — PK(receipt_id, fact_id)
  NO was_relevant column

intelligence_relations columns: from_entity_id / to_entity_id (NOT source_entity_id / target_entity_id)
  strength: 0-10 scale (NOT 0-1)

discovery_policies columns: min_observations (NOT min_evidence_threshold),
  research_budget_monthly (NOT budget_per_run_usd)
  NO max_discoveries_per_week column

Valid fact categories: pricing, positioning, audience, competitor, content, product,
  market, performance, objection, trigger, differentiator, other

Valid observation_types: content_performance, lead_conversion, search_signal,
  competitor_signal, market_signal, user_behavior, research_finding

Valid source_types: pipeline, analytics, search, manual, ai_research, webhook

observation_type → fact category mapping:
  lead_conversion → audience, content_performance → performance,
  search_signal → market, competitor_signal → competitor,
  market_signal → market, user_behavior → audience, research_finding → other

## Content Pipeline
Research → Brief → Sources → Draft (Sonnet) → Internal Links → Humanize →
Anti-words → Score (Haiku) → Review
Uses IntelligenceService.for_content() for context → falls back to context_builder (Haiku)
→ falls back to ClientIntelligence.get_content_context() (old blob)
body_html generated from body_md via Python markdown lib (not LLM)

## Key Conventions
- Supabase REST API (PostgREST) — use db.query() and db.rpc()
- All JSONB arrays, not TEXT arrays (Supabase compat)
- fact_key naming: {category}.{entity_slug}.{metric} (e.g. audience.dolor.si-frecuentemente)
- Slugs ALWAYS use hyphens: dolor-espalda (NEVER underscores)
- Tags slug format with hyphens: quiz-dolor, val-si-frecuentemente
- Background tasks: asyncio.create_task for non-blocking
- Every endpoint needs try/except
- CORS: add new domains to main.py static list
- Auth: public endpoints need explicit entry in PUBLIC_GET_PREFIXES
- Discovery approval MUST materialize entity (not just update status)

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
11. NEVER pass both value_number AND value_json to upsert_intelligence_fact — violates exactly_one_value
12. observation_type is NOT the same as fact category — use the mapping above
13. Column names in schema are the ONLY source of truth — PostgREST silently ignores wrong column names
14. Slugs must use hyphens (-) not underscores (_) — all existing entities use hyphens
15. consumer_type has CHECK constraint — only 5 valid values (see contract above)

## Deploy Rules (CRITICAL)
16. NEVER run `npx vercel` or `vercel --prod` from CLI — it can disconnect Git integration
17. Deploy happens automatically on `git push origin main` — just push and wait
18. Dashboard (web-ten-woad-99.vercel.app) = Vercel project "cerebro-dashboard", root: apps/web
19. Public site (colchonespanama.com) = Vercel project "colchones-panama", root: apps/sites/colchones-panama
20. If Vercel shows "Connect Git Repository" on any project, STOP and tell the operator — deploy is broken

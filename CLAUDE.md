# CEREBRO — Autonomous Growth Operating System

## Architecture Source of Truth
ALWAYS read `docs/CEREBRO-Architecture.md` before making architecture decisions.
Contains: vision, 7 principles, 4 laws, 4-layer engine design, 9 data layers, 6 specialist agents (including Content Craft Agent), repo structure rules, tool policy, roadmap with hard gates, and anti-patterns.
If a decision contradicts this document, STOP and flag it.
If the plan needs to change, update this document FIRST, then implement.

## SPEED RULES (MANDATORY)
- NEVER use brainstorming, writing-plans, or code-reviewer skills
- NEVER use worktrees — work directly on main
- NEVER write design docs or plan documents
- Execute directly: read → implement → test → push
- Maximum 10 minutes per session (25 for intelligence layer)
- If tests pass, it ships

## Production URLs
- API: https://web-production-c6ed5.up.railway.app (Railway, FastAPI)
- Dashboard: https://web-ten-woad-99.vercel.app (Vercel, Next.js)
- Public site: https://colchonespanama.com (Vercel, Next.js)
- Supabase project: dcnzgifhjezkeqvlkqne
- NauralSleep site_id: d3920d22-2c34-40b1-9e8e-59142af08e2a

## Architecture
```
cerebro/ (monorepo)
├── apps/api/              → Railway (FastAPI)
├── apps/web/              → Vercel (Dashboard)
├── apps/sites/colchones-panama/ → Vercel (Public site)
├── packages/core/         → DB client (Supabase REST), scoring, utils
├── packages/ai/           → LLM providers (Anthropic, OpenAI, DeepSeek)
├── packages/content/      → Content pipeline + feedback loop
│   └── pipeline.py        → research→brief→draft→humanize→score + rules injection
├── packages/intelligence/ → Intelligence Layer v2
│   ├── __init__.py        → ClientIntelligence (LEGACY — still used by chat)
│   ├── service.py         → IntelligenceService (context builders, NO client_profiles)
│   ├── updater.py         → Event listeners (on_lead, on_sale, on_content)
│   ├── analyzer.py        → Weekly analyzer (8 phases, DB-driven slots)
│   ├── researcher.py      → 6-gate research engine (DuckDuckGo + Haiku)
│   ├── context_builder.py → Per-article focused context (Haiku call)
│   └── knowledge_engine.py → [PENDING] Authority source ingestion
├── packages/conversation/ → Chat engine (still reads client_profiles — TODO: migrate)
├── migrations/            → 001-030 applied
└── tests/                 → 34 smoke tests passing
```

## Current State (as of March 20, 2026)
- 41 active entities, 300 facts (188 trusted, 112 quarantined)
- 35 entity slots across 7 entity types
- 13 canonical relation types
- ~39 content assets (16 approved, ~13 review, ~6 error)
- 2 content_rules active (feedback loop working)
- 30 migrations applied (001-030)
- 0 leads, 0 traffic (Search Console just connected)

---

## SCHEMA-RUNTIME CONTRACT (CRITICAL)
These are the EXACT column names. Wrong names silently return empty data via PostgREST.

### intelligence_entities
```
id UUID PK, site_id UUID, entity_type TEXT, name TEXT (NOT display_name),
slug TEXT (NOT entity_key), description TEXT, status TEXT (active|archived),
metadata JSONB, cognee_cognit_id TEXT [PENDING], last_cognified_at TIMESTAMPTZ [PENDING],
created_at, updated_at
UNIQUE(site_id, entity_type, slug)
```

### intelligence_facts
```
id UUID PK, site_id UUID, entity_id UUID (nullable — generic knowledge has no entity),
fact_key TEXT, category TEXT, value_text TEXT, value_number NUMERIC, value_json JSONB,
confidence NUMERIC (0-1), utility_score NUMERIC, evidence_count INT,
quarantined BOOLEAN, tags JSONB[], source TEXT, evidence_type TEXT (own_data|web_research|inferred|manual),
evidence_quote TEXT, knowledge_type TEXT CHECK(knowledge_type IN ('atomic_market','authority_claim','llm_seed','derived_summary')) [PENDING], last_cognified_at TIMESTAMPTZ [PENDING],
last_verified TIMESTAMPTZ, created_at, updated_at
CONSTRAINT: exactly_one_value (only 1 of value_text/value_number/value_json non-null)
```

**Four knowledge types (IMPORTANT — pipeline behavior differs):**
- **atomic_market** (source=ai_research|pipeline): atomic values like "$500-$800". Compose retrieval text at runtime using entity name + category.
- **authority_claim** (source=authority_content): complete expert statements from authority sources. Inject into pipeline AS-IS.
- **llm_seed** (source=llm_knowledge): facts from LLM training data (cold start). Inject with LOWER priority than authority_claim. Gets replaced when authority data arrives.
- **derived_summary** (source=synthesis): conclusions from cross-source correlation. Use as supporting context only, not primary claims.

### intelligence_entity_slots
```
id UUID PK, site_id UUID, entity_type TEXT, slot_name TEXT, slot_kind TEXT,
priority INT (1-10), stale_after_days INT, description TEXT, created_at
UNIQUE(site_id, entity_type, slot_name)
```
Replaces old hardcoded ENTITY_SCHEMAS dict. Phase 4 reads slots from DB.

### intelligence_relations
```
id UUID PK, site_id UUID, from_entity_id UUID (NOT source_entity_id),
to_entity_id UUID (NOT target_entity_id), relation_type TEXT,
strength NUMERIC (0-10 scale, NOT 0-1), metadata JSONB, created_at, updated_at
UNIQUE(site_id, COALESCE(from), COALESCE(to), relation_type)
```

### intelligence_observations
```
id UUID PK, site_id UUID, entity_id UUID (nullable), observation_type TEXT,
source_type TEXT, source_ref TEXT, raw_value JSONB, normalized_tags JSONB,
processed BOOLEAN, processing_run_id UUID, observed_at TIMESTAMPTZ, created_at
```

### intelligence_insights
```
id UUID PK, site_id UUID, insight_type TEXT, title TEXT, body TEXT,
supporting_facts UUID[], impact_score NUMERIC (0-10), status TEXT (active|actioned|dismissed),
actionability_score NUMERIC, target_entity_id UUID, recommended_action TEXT,
created_at, updated_at
```
insight_type CHECK: opportunity|threat|gap|trend|positioning|recommendation|anomaly|content_gap|winning_message|competitor_weakness|objection_play

### content_assets
```
id UUID PK, site_id UUID, mission_id UUID, title TEXT, slug TEXT, keyword TEXT,
body_md TEXT, body_html TEXT, meta_description TEXT, faq_section JSONB,
status TEXT (draft|generating|review|approved|published|error),
quality_score NUMERIC, score_humanity NUMERIC, score_specificity NUMERIC,
score_structure NUMERIC, score_seo NUMERIC, score_readability NUMERIC,
score_feedback TEXT, metadata JSONB (includes feedback_history[], active_rule_ids[]),
error_message TEXT, pipeline_step TEXT, created_at, updated_at
```

### content_rules
```
id UUID PK, site_id UUID, rule_text TEXT, rule_context TEXT, rule_exception TEXT,
category TEXT (accuracy|market_specificity|tone|style|structure|seo|product_error|competitor_error|missing_info|cta),
scope TEXT DEFAULT 'keyword', scope_value TEXT,
status TEXT (testing|proven|trusted|inactive) — use status NOT active column,
strength NUMERIC (0-1, starts at 0.5), rule_polarity TEXT [PENDING] (positive|negative),
times_applied INT, times_helped INT, times_failed INT,
created_at, updated_at
```
**KNOWN BUGS:**
- `active BOOLEAN` column exists but is redundant — use `status NOT IN ('inactive','suspended')`
- `times_applied` double-counts (incremented in both pipeline AND boost/weaken functions)
- `policy_set` in feedback_events is empty (should come from metadata.active_rule_ids)

### feedback_events
```
id UUID PK, site_id UUID, asset_id UUID, decision TEXT (approve|reject|regenerate),
primary_reason TEXT, severity TEXT, free_text TEXT, make_rule BOOLEAN,
policy_set UUID[], created_at
```

### operator_alerts
```
id UUID PK, site_id UUID, alert_type TEXT, title TEXT, body TEXT,
severity TEXT, status TEXT, metadata JSONB, created_at
```

---

## Valid Enums

### Fact categories
pricing, positioning, audience, competitor, content, product, market, performance, objection, trigger, differentiator, other

### Observation types
content_performance, lead_conversion, search_signal, competitor_signal, market_signal, user_behavior, research_finding

### Source types
pipeline, analytics, search, manual, ai_research, webhook

### Evidence types
own_data, web_research, inferred, manual

### Entity types
product, competitor, competitor_product, brand, store, segment, pain_point, objection, channel, persona, location, feature, promotion, market, other

### Relation types (13 canonical — trimmed from 24)
solves, recommended_for, competes_with, targets, contradicts, related_to, sold_at, owned_by, belongs_to, alternative_to, attracts, responds_to, derived_from

### Content rule categories
accuracy, market_specificity, tone, style, structure, seo, product_error, competitor_error, missing_info, cta

### observation_type → fact category mapping
lead_conversion → audience, content_performance → performance, search_signal → market, competitor_signal → competitor, market_signal → market, user_behavior → audience, research_finding → other

---

## Intelligence Layer v2

### 8-Phase Analyzer (runs 2x/week)
1. **Consolidate** — observations → facts (canonical keys)
2. **Performance** — content assets → lead-count facts
3. **Discover** — cluster observations → propose entities
4. **Gaps** — entities vs slots → priority-scored gap list (slot.priority × entity_importance × staleness)
5. **Research** — DuckDuckGo + Haiku + 6-gate quality → new facts (600s timeout)
6. **Insights** — Haiku analyzes all facts → strategic insights with actionability_score
7. **Janitor** — archive stale/empty entities
8. **Decay** — reduce utility_score over time

### 6-Gate Research Quality
1. Source Trust (domain score 0-0.95)
2. Geo Validation (Haiku confirms Panama, evidence_quote)
3. Composite Score (haiku × source × geo × recency → >0.6 trusted, 0.3-0.6 quarantine)
4. Contradiction (same fact_key different value → quarantine both + operator_alert)
5. Schema (valid category, fact_key format, evidence_quote)
6. Human Review (dashboard approve/reject)

### Context Consumers (5 packets)
- for_content() → ContentPacket (best fact per category, ~250 words)
- for_whatsapp() → WhatsAppPacket (stub)
- for_quiz() → QuizPacket (stub)
- for_dashboard() → DashboardPacket (working)
- for_briefing() → BriefingPacket (template)

---

## Content Pipeline

### Flow
Research → Brief → Sources → Draft (Sonnet) → Internal Links → Humanize → Anti-words → Score (Haiku) → Review

### Knowledge injection (4 tiers by knowledge_type)
1. **authority_claim** — expert statements from NapLab, SleepFoundation etc. Inject value_text directly into prompt.
2. **atomic_market** — local prices, competitor data. Compose "{entity_name} — {category}: {value}" at runtime.
3. **llm_seed** — cold start facts from Haiku. Lower priority, replaced by authority_claim when available.
4. **derived_summary** — synthesized conclusions. Supporting context only.
5. **Writing rules** — max 7 active content_rules (max 1 per category, max 3 negative + 4 positive)

### Feedback loop
1. User reviews article (approve/reject/regenerate with structured feedback)
2. Feedback creates content_rules (if make_rule=true)
3. Rules are injected into future article drafts
4. Regenerate includes feedback as REVIEWER FEEDBACK section
5. Rules start at strength 0.5, status=testing
6. After 3 successful uses → proven → trusted
7. Circuit breaker: auto-suspend if avg_score drops >5 after 3+ applications

### Regeneration
- POST /api/content/{asset_id}/feedback with decision="regenerate"
- Sets status to "generating", stores feedback in metadata.feedback_history[]
- Pipeline re-runs with original keyword + feedback context + active rules

---

## API Endpoints (key ones)

### Content
- GET /api/content/{site_id} — list articles
- GET /api/content/{asset_id} — full article with body_html
- POST /api/content/generate — generate from keyword + topic
- GET /api/content/recommend/{site_id} — AI recommendations from insights/entities
- POST /api/content/{asset_id}/feedback — structured review (approve/reject/regenerate)
- POST /api/content/{asset_id}/regenerate — re-run pipeline with feedback
- DELETE /api/content/{asset_id} — delete error/draft articles only

### Content Rules
- GET /api/content/rules/{site_id} — list active rules
- PATCH /api/content/rules/{rule_id} — edit rule
- DELETE /api/content/rules/{rule_id} — delete rule

### Intelligence
- POST /api/intelligence/analyze — run 8-phase analyzer
- GET /api/intelligence/entities/{site_id} — list entities
- GET /api/intelligence/facts/{site_id} — list facts
- GET /api/intelligence/facts/{site_id}/quarantined — quarantined facts
- POST /api/intelligence/facts/{fact_id}/approve — approve quarantined
- POST /api/intelligence/facts/{fact_id}/reject — reject quarantined
- POST /api/intelligence/research — trigger research run
- [PENDING] POST /api/intelligence/knowledge/cold-start — LLM knowledge extraction
- [PENDING] POST /api/intelligence/knowledge/ingest — authority URL ingestion
- [PENDING] GET /api/intelligence/knowledge/{site_id} — knowledge stats

### System
- GET /api/health — health check
- GET /api/sites — list sites
- GET /api/sites/{site_id}/dashboard — dashboard data

---

## Key Conventions

### Database
- Supabase REST API (PostgREST) — use db.query() and db.rpc()
- All JSONB arrays, not TEXT arrays
- fact_key naming: {category}.{entity-slug}.{metric}
- Slugs ALWAYS use hyphens: dolor-espalda (NEVER underscores)
- Tags slug format with hyphens: quiz-dolor, val-si-frecuentemente
- db.insert(), db.update(), db.get(), db.get_by_id(), db.query(), db.rpc()
- NO db.upsert() — use query + check + insert/update pattern

### Code
- Background tasks: asyncio.create_task for non-blocking
- Every endpoint needs try/except
- Auth: public endpoints need explicit entry in PUBLIC_GET_PREFIXES
- Discovery approval MUST materialize entity (not just update status)
- body_html generated from body_md via Python markdown lib (not LLM)
- Import asyncio at top when using BackgroundTasks

### Entity creation rules (for knowledge engine)
- CREATE entities for: specific brands, products, stores, health conditions, customer segments
- DO NOT create entities for: generic materials (memory foam), construction concepts (comfort layer), properties (ILD, density), universal principles (pressure relief)
- Generic knowledge facts correctly have entity_id=null

### Retrieval priority for pipeline
- Categories pricing, durability, temperature, market → LOCAL data first (ai_research)
- Categories material_science, health_sleep, construction → AUTHORITY data first (authority_content)
- When local AND authority data exist for same topic → include BOTH (the contrast IS the content)

---

## Lessons Learned (CRITICAL)
- CORS must be added BEFORE deploying new domains
- Trailing slashes matter in PUBLIC_GET_PREFIXES
- Never hardcode local paths (crashes Vercel)
- CSS position:fixed breaks grid layout
- JSONB arrays must use read-modify-write pattern
- Chat tools need site_id injected (Claude invents UUIDs)
- Railway kills bg tasks on restart — handle CancelledError
- Anthropic timeout needs 180s for Sonnet full articles
- max_tokens=2048 truncates JSON — use 4096 for briefs
- body_html generated in Python, not LLM (saves tokens)
- NEVER pass both value_number AND value_json — violates exactly_one_value
- observation_type is NOT the same as fact category — use the mapping
- Column names are the ONLY source of truth — PostgREST silently ignores wrong names
- Slugs must use hyphens (-) not underscores (_)
- consumer_type has CHECK constraint — only 5 valid values
- content_rules: use `status` not `active` column for filtering
- times_applied: ONLY increment in pipeline, not in boost/weaken [BUG: currently double-counts]
- When Gate 4 detects contradiction → create operator_alert (5 lines in researcher.py)
- Knowledge claims (authority_content) inject AS-IS into prompts — don't compose
- Market data (ai_research) compose retrieval text at runtime — don't store expanded
- Entity creation: ONLY for brands/products/stores/segments/conditions. NOT for generic materials/concepts
- Local facts (ai_research) win over authority for pricing/durability/climate categories
- Authority facts win for material_science/health_sleep/construction categories
- When both exist for same topic, include BOTH — the contrast IS valuable content
- Draft prompt tone: "amigo que sabe mucho" NOT "experto académico" — conversational with data
- Contradictions local vs global: ALWAYS resolve with concrete Panama recommendation, never leave tension open

## Deploy Rules (CRITICAL)
- NEVER run `npx vercel` or `vercel --prod` from CLI — disconnects Git integration
- Deploy = `git push origin main` — automatic
- Dashboard = Vercel project "cerebro-dashboard", root: apps/web
- Public site = Vercel project "colchones-panama-com", root: apps/sites/colchones-panama
- If Vercel shows "Connect Git Repository", STOP — deploy is broken

## Pending Work (next prompts in order)
1. Multi-select feedback (feedbackReason: string → string[])
2. Migration SQL: rule_polarity, knowledge_type CHECK, Cognee-prep columns, drop active, scope default
3. Logic fixes: times_applied, policy_set, rule selection polarity balance, generation snapshot in metadata
4. Knowledge engine (cold start + authority ingestion + pipeline knowledge injection + DuckDuckGo fallback)
5. Dashboard UI for knowledge engine (Fuentes de Conocimiento section)
6. Generate 8 Tier 1 articles (informational questions, NOT branded keywords)
7. Dashboard audit (remove hardcoded "colchones" references)
8. Cognee integration (sidecar for discovery, NOT in pipeline — week 7-10, needs Gate: 2/3 of recall+latency+uplift)

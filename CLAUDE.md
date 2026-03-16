# CEREBRO — AI Demand Generation Engine

## What Changed
The system is NOT a content generator. It is an **AI Demand Generation Engine**.
Content is ONE skill among many. The core purpose is: **generate qualified leads and prove their origin through measurable attribution.**

## Current Code Status (What Works)
- ✅ FastAPI backend with endpoints (apps/api/)
- ✅ Supabase with 20 tables, seed data, ikigii mission
- ✅ Content pipeline: keyword → brief → draft → humanize → validate
- ✅ AI client with cost tracking + $30/day circuit breaker
- ✅ Next.js dashboard: overview, content list, leads, alerts
- ✅ Public pages: article renderer, calculator, email capture
- ✅ Email via Resend
- ✅ 5 articles generated and in Supabase

## New Architecture: Skills + Strategy Loop

The old "10 engines" model is replaced by **Skills + a Strategy Loop**.

### The Strategy Loop (core of the system)
```
Goal (from user)
  → Strategy Generation (AI proposes approaches)
  → Strategy Exploration (autosearch: generate many variations)
  → Simulation & Scoring (estimate which will work best)
  → Execution (run the best strategies using Skills)
  → Measurement & Attribution (track everything)
  → Knowledge Update (learn what worked)
  → Improved Strategies (loop back)
```

This loop runs continuously. It is the brain of the system.

### Skills (modular capabilities)
Skills are independent modules the system can use. Each skill does one thing well.

Current skills (already built):
- **content_creation** — SEO articles (packages/content/)
- **landing_pages** — article renderer + calculator (apps/web/)
- **email_nurturing** — Resend emails (packages/email/)
- **lead_capture** — forms + intent scoring (API endpoint)

Skills to build (priority order):
- **strategy_engine** — generates and evaluates strategies given a goal
- **knowledge_base** — accumulates what works, what doesn't (Supabase tables)
- **attribution** — tracks: asset → visitor → lead → conversion
- **community_engagement** — Reddit, forums, Facebook groups (human-approved)
- **whatsapp** — WhatsApp Business API for lead qualification
- **outreach** — backlink building, collaborative content
- **social_distribution** — adapt content to Instagram/TikTok/X/LinkedIn
- **conversion_optimizer** — A/B test headlines, CTAs, layouts

## File Map
```
cerebro/
├── apps/
│   ├── api/app/main.py              ← FastAPI (expand with new endpoints)
│   └── web/src/                     ← Next.js dashboard + public site
│
├── packages/
│   ├── core/__init__.py             ← DB, config, costs, logger (KEEP)
│   ├── ai/__init__.py               ← LLM client (KEEP)
│   ├── ai/prompts/                  ← All prompts (KEEP + expand)
│   │
│   ├── skills/                      ← NEW: modular skill system
│   │   ├── __init__.py              ← Skill registry + base class
│   │   ├── content_creation.py      ← MOVE from packages/content/
│   │   ├── landing_pages.py         ← Landing page generation
│   │   ├── email_nurturing.py       ← MOVE from packages/email/
│   │   ├── lead_capture.py          ← Lead forms + intent scoring
│   │   ├── community_engagement.py  ← Reddit/forum responses
│   │   ├── whatsapp.py              ← WhatsApp Business API
│   │   ├── social_distribution.py   ← Content → social posts
│   │   ├── outreach.py              ← Backlink/collab outreach
│   │   └── conversion_optimizer.py  ← A/B testing
│   │
│   ├── strategy/                    ← NEW: strategy loop
│   │   ├── __init__.py
│   │   ├── loop.py                  ← The continuous strategy loop
│   │   ├── generator.py             ← AI generates strategy options
│   │   ├── explorer.py              ← Autosearch: test many variations
│   │   ├── simulator.py             ← Score strategies before execution
│   │   └── executor.py              ← Run strategies using skills
│   │
│   ├── knowledge/                   ← NEW: system memory
│   │   ├── __init__.py
│   │   ├── store.py                 ← What worked, what didn't
│   │   └── graph.py                 ← Entity relationships
│   │
│   ├── attribution/                 ← NEW: tracking + reporting
│   │   ├── __init__.py
│   │   └── tracker.py               ← asset → visitor → lead → conversion
│   │
│   ├── content/                     ← KEEP (wraps into skill)
│   ├── email/                       ← KEEP (wraps into skill)
│   └── compliance/                  ← NEW: brand safety + client rules
│       └── __init__.py
│
├── docs/
│   └── program.md                   ← AutoLoop protocol (KEEP)
│
├── schema.sql                       ← Expand with new tables
└── CLAUDE.md                        ← THIS FILE
```

## New Database Tables Needed

Add these to Supabase (run in SQL Editor):

```sql
-- GOALS (what the user wants to achieve)
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    target_metric TEXT NOT NULL,
    target_value NUMERIC,
    current_value NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','achieved','paused')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- STRATEGIES (AI-generated approaches)
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    channel TEXT NOT NULL,
    skills_needed JSONB DEFAULT '[]',
    estimated_leads INTEGER DEFAULT 0,
    estimated_cost NUMERIC(10,2) DEFAULT 0,
    confidence_score NUMERIC(5,2) DEFAULT 0,
    status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed','approved','running','completed','failed')),
    results JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- STRATEGY VARIATIONS (autosearch exploration)
CREATE TABLE IF NOT EXISTS strategy_variations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
    variation_type TEXT NOT NULL,
    parameters JSONB NOT NULL,
    simulation_score NUMERIC(5,2) DEFAULT 0,
    actual_score NUMERIC(5,2),
    status TEXT DEFAULT 'simulated' CHECK (status IN ('simulated','running','completed','discarded')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- KNOWLEDGE ENTRIES (what the system learns)
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,
    insight TEXT NOT NULL,
    evidence JSONB DEFAULT '{}',
    confidence NUMERIC(5,2) DEFAULT 0,
    source_strategy_id UUID REFERENCES strategies(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ATTRIBUTION EVENTS (full tracking chain)
CREATE TABLE IF NOT EXISTS attribution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id TEXT,
    session_id TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('pageview','click','form_start','lead_capture','conversion')),
    asset_id UUID,
    asset_type TEXT,
    channel TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CHANNEL PERFORMANCE (which channels work best)
CREATE TABLE IF NOT EXISTS channel_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel TEXT NOT NULL,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    cost NUMERIC(10,2) DEFAULT 0,
    revenue NUMERIC(10,2) DEFAULT 0,
    UNIQUE(channel, date)
);

-- COMPLIANCE RULES (client constraints)
CREATE TABLE IF NOT EXISTS compliance_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('legal','brand','geographic','claim','approval')),
    description TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_strategies_goal ON strategies(goal_id);
CREATE INDEX idx_strategies_status ON strategies(status);
CREATE INDEX idx_variations_strategy ON strategy_variations(strategy_id);
CREATE INDEX idx_knowledge_category ON knowledge_entries(category);
CREATE INDEX idx_attribution_visitor ON attribution_events(visitor_id);
CREATE INDEX idx_attribution_type ON attribution_events(event_type);
CREATE INDEX idx_channel_perf_date ON channel_performance(date);
```

## API Endpoints to Add

```
# Goals
POST /api/goals                → create goal {description, target_metric, target_value}
GET  /api/goals                → list goals

# Strategies
POST /api/strategies/generate  → AI generates strategies for a goal
GET  /api/strategies           → list strategies
POST /api/strategies/{id}/approve → human approves strategy
POST /api/strategies/{id}/run  → execute strategy

# Knowledge
GET  /api/knowledge            → what the system has learned
GET  /api/knowledge/insights   → top insights by confidence

# Attribution
GET  /api/attribution/report   → full attribution report
POST /api/attribution/event    → track an event (pageview, click, lead)
GET  /api/attribution/funnel   → funnel: visits → leads → conversions

# Channels
GET  /api/channels/performance → which channels produce best results
```

## Dashboard Pages to Add

- `/dashboard/goals` — Active goals with progress bars
- `/dashboard/strategies` — Strategy proposals with approve/reject + results
- `/dashboard/attribution` — Funnel visualization: traffic → leads → conversions
- `/dashboard/channels` — Channel comparison: which produces most leads
- `/dashboard/knowledge` — What the system has learned (insights list)

## Implementation Priority

### Phase 1: Strategy Foundation (do this first)
1. Create `packages/skills/__init__.py` with base Skill class
2. Wrap existing content pipeline as a skill
3. Create `packages/strategy/generator.py` — given a goal, AI proposes 3-5 strategies
4. Add goals + strategies tables to Supabase
5. Add API endpoints for goals and strategies
6. Add dashboard pages for goals and strategies

### Phase 2: Attribution + Knowledge
1. Create attribution tracking (events table + API)
2. Add UTM tracking to all links and pages
3. Create knowledge store (learns from experiment results)
4. Add attribution dashboard page

### Phase 3: Multi-Channel Skills
1. Community engagement skill (Reddit/forum draft responses, human-approved)
2. Social distribution skill (article → Instagram/TikTok/X posts)
3. WhatsApp skill (Business API integration)
4. Outreach skill (backlink opportunities)

### Phase 4: Autosearch + Simulation
1. Strategy explorer (generate many variations automatically)
2. Simulator (score strategies before execution)
3. Continuous loop runner (cron job that runs the strategy loop)

## Core Decision Principle
Before any action: **"Will this increase qualified leads?"**
If uncertain: test it as an experiment.

## Rules (unchanged)
- All LLM calls through packages/ai/
- All DB through packages/core/
- Cost circuit breaker: $30/day
- Content needs human approval
- Never hardcode keys or prompts
- Author persona: Carlos Medina

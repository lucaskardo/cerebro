# CEREBRO v7 — AI Demand Generation Engine

> An autonomous system that generates qualified leads for financial products through content, tools, and multi-channel distribution. Built for [ikigii](https://ikigii.com) (Towerbank Panamá) — targeting Colombians who want USD bank accounts, remittances, and financial protection.

**Live:**
- Frontend → [dolarafuera.co](https://dolarafuera.co) (Vercel)
- API → [web-production-c6ed5.up.railway.app](https://web-production-c6ed5.up.railway.app) (Railway)
- Database → Supabase (20 tables, PostgreSQL)

---

## What This Is

CEREBRO is not a content generator. Content is one skill among many. The core purpose:

**Generate qualified leads → prove their origin → improve the strategy → repeat.**

The system runs a continuous loop:

```
Goal (user sets target: "100 leads/month from Colombian professionals")
  → Strategy Generation    AI proposes 3-5 approaches given the goal + past data
  → Simulation & Scoring   Estimate which strategy will produce best results
  → Execution              Run the strategy using modular Skills
  → Attribution            Track every step: asset → visitor → lead → conversion
  → Knowledge Update       Learn what worked, store as insight
  → Improved Strategy      Feed results back into next generation
```

This loop is the brain. Skills are the hands.

---

## Architecture

```
cerebro/
├── apps/
│   ├── api/app/main.py          FastAPI — all HTTP endpoints
│   └── web/src/                 Next.js 16 — dashboard + public site
│
├── packages/
│   ├── core/        DB client, config, cost tracker, logger
│   ├── ai/          Multi-provider LLM client (Anthropic, OpenAI, DeepSeek)
│   ├── content/     Content pipeline: keyword → brief → draft → humanize
│   ├── email/       Transactional email via Resend
│   ├── images/      Hero image generation (SVG placeholder + Gemini)
│   │
│   ├── skills/      [in progress] Modular capability registry
│   ├── strategy/    [in progress] Strategy loop (generator, simulator, executor)
│   ├── knowledge/   [in progress] System memory (what worked, what didn't)
│   └── attribution/ [in progress] Full tracking chain
│
├── schema.sql       Full Supabase schema
├── Dockerfile       Railway deployment
└── CLAUDE.md        AI coding instructions (read this if using Claude Code)
```

### Multi-Provider LLM Routing

All LLM calls go through `packages/ai/`. Provider is auto-selected by pipeline step:

| Step | Provider | Model | Why |
|------|----------|-------|-----|
| `brief`, `humanize` | DeepSeek | deepseek-chat | Cheapest for structured tasks |
| `draft` | OpenAI | gpt-4o | Best long-form writing quality |
| `strategy_*` | Anthropic | claude-sonnet-4 | Best reasoning for strategy |
| everything else | Anthropic | claude-haiku | Fallback |

Circuit breaker: **$30/day** hard limit on all LLM spend. Tracked in `cost_events` table.

### Multi-Brand Content

Three brands, each with its own persona and audience:

| Brand | Domain | Persona | Audience | Color |
|-------|--------|---------|----------|-------|
| **Múdate a Panamá** | mudateapanama.com | Ana Gutiérrez | Families relocating to Panama | Blue |
| **Dolarízate** | dolarizate.co | Carlos Medina | Colombians protecting savings in USD | Green |
| **Remesas.co** | remesas.co | Diego Restrepo | Migrants sending money home | Orange |

All three brands funnel to ikigii account opens.

---

## What's Built (Current State)

| Component | Status | Location |
|-----------|--------|----------|
| FastAPI backend | ✅ Live | `apps/api/app/main.py` |
| Supabase schema | ✅ 20 tables | `schema.sql` |
| Content pipeline | ✅ Working | `packages/content/pipeline.py` |
| Multi-provider LLM | ✅ Working | `packages/ai/__init__.py` |
| Cost tracking | ✅ Working | `packages/core/__init__.py` |
| Goals API | ✅ Live | `POST /api/goals` |
| Strategies API | ✅ Live | `POST /api/strategies/generate` |
| Attribution API | ✅ Live | `POST /api/attribution/event` |
| Next.js dashboard | ✅ Live | `apps/web/src/app/` |
| Public article pages | ✅ Live | `/articulo/[slug]` |
| Brand homepages | ✅ Live | `/marca/[slug]` |
| Public homepage | ✅ Live | `/` |
| Landing pages | ✅ Live | `/comparar/*`, `/guia/*`, `/herramientas/*` |
| Email capture | ✅ Live | `packages/email/` |
| Hero image generation | ✅ Working | `packages/images/__init__.py` |
| Strategy loop | 🔧 In progress | `packages/strategy/` |
| Community engagement skill | 📋 Planned | `packages/skills/community_engagement.py` |
| WhatsApp skill | 📋 Planned | `packages/skills/whatsapp.py` |
| Social distribution skill | 📋 Planned | `packages/skills/social_distribution.py` |
| Outreach skill | 📋 Planned | `packages/skills/outreach.py` |

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account (free tier works)
- Anthropic API key (required)
- OpenAI API key (optional — falls back to Claude)
- DeepSeek API key (optional — falls back to Claude Haiku)

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USER/cerebro.git
cd cerebro
cp .env.example .env
# Edit .env with your keys
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. SQL Editor → paste `schema.sql` → Run
3. Copy the project URL and service role key into `.env`

### 3. Run the API

```bash
cd apps/api
pip install -r requirements.txt
cd ../..
uvicorn apps.api.app.main:app --reload --port 8000
```

Verify:
```bash
curl http://localhost:8000/health
# → {"status": "ok", "version": "7.0.0"}
```

### 4. Run the Frontend

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000
```

### 5. Generate Your First Article

```bash
# Get your mission ID
curl http://localhost:8000/api/missions

# Generate an article (runs in background, ~60-90 seconds)
curl -X POST http://localhost:8000/api/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "YOUR_MISSION_ID",
    "keyword": "como abrir cuenta en dolares desde colombia"
  }'

# Check status
curl http://localhost:8000/api/content
```

### 6. Set Up a Goal and Generate Strategies

```bash
# Create a goal
curl -X POST http://localhost:8000/api/goals \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Get 100 qualified leads per month from Colombian professionals",
    "target_metric": "leads_per_month",
    "target_value": 100
  }'

# Generate strategies for the goal
curl -X POST http://localhost:8000/api/strategies/generate \
  -H "Content-Type: application/json" \
  -d '{"goal_id": "YOUR_GOAL_ID"}'
```

---

## Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...

# Optional (system falls back to Anthropic if missing)
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=...            # For real hero image generation

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=you@yourdomain.com

# Domain
PRIMARY_DOMAIN=yourdomain.com
NEXT_PUBLIC_API_URL=http://localhost:8000

# Budget
DAILY_BUDGET_USD=30.0         # Hard limit on daily LLM spend

# Feature Flags (enable as you build each phase)
ENABLE_AUTO_PUBLISH=false
ENABLE_DEMAND_ENGINE=false
ENABLE_AUTOLOOP=false
ENABLE_SOCIAL_ENGINE=false
```

---

## API Reference

### Content
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/content` | List all articles |
| `POST` | `/api/content/generate` | Generate an article (background job) |
| `GET` | `/api/content/{id}` | Get article by ID |
| `POST` | `/api/content/{id}/approve` | Approve for publishing |
| `GET` | `/api/content/{id}/image` | Get/generate hero image |

### Strategy
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/goals` | Create a goal |
| `GET` | `/api/goals` | List goals |
| `POST` | `/api/strategies/generate` | AI generates 3-5 strategies for a goal |
| `GET` | `/api/strategies` | List strategies |
| `POST` | `/api/strategies/{id}/approve` | Approve a strategy |
| `POST` | `/api/strategies/{id}/run` | Execute a strategy |

### Attribution
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/attribution/event` | Track an event (pageview, click, lead, conversion) |
| `GET` | `/api/attribution/report` | Full attribution report |
| `GET` | `/api/attribution/funnel` | Funnel: visits → leads → conversions |
| `GET` | `/api/channels/performance` | Which channels produce best results |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/status` | System status + budget |
| `GET` | `/api/budget` | Today's LLM spend |
| `GET` | `/api/leads` | List leads |
| `GET` | `/api/knowledge` | What the system has learned |

---

## Deployment

### Backend (Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Link to your project
railway link

# Set environment variables
railway variables set ANTHROPIC_API_KEY=sk-ant-... --service api
railway variables set SUPABASE_URL=https://... --service api
# (repeat for all required vars)

# Deploy
railway up
```

The Dockerfile handles everything. Railway auto-detects it via `railway.toml`.

### Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

cd apps/web
vercel --prod
```

Set these environment variables in the Vercel dashboard:
- `NEXT_PUBLIC_API_URL` — your Railway backend URL
- `PRIMARY_DOMAIN` — your domain

---

## Roadmap

### Phase 1 — Strategy Foundation ✅
- Goals + strategies tables
- AI generates strategies given a goal
- Human approves/rejects via dashboard
- Attribution event tracking

### Phase 2 — Multi-Brand Content ✅
- 3 brands with independent personas and audiences
- Brand-filtered content pipeline
- Per-brand landing pages and homepages
- Editorial article layout with TOC, reading progress, social share

### Phase 3 — Attribution + Knowledge 🔧
- [ ] UTM tracking on all outbound links
- [ ] Funnel dashboard: traffic source → lead → conversion
- [ ] Knowledge store: what content/channels produce best leads
- [ ] Strategy simulation: score approaches before spending budget

### Phase 4 — Multi-Channel Skills 📋
- [ ] **Community engagement** — draft Reddit/forum responses for human approval
- [ ] **Social distribution** — adapt articles to Instagram/TikTok/X/LinkedIn posts
- [ ] **WhatsApp** — Business API for lead qualification flows
- [ ] **Outreach** — identify backlink and collaboration opportunities
- [ ] **Conversion optimizer** — A/B test headlines, CTAs, layouts

### Phase 5 — AutoLoop 📋
- [ ] Continuous strategy loop (cron job that runs evaluate → generate → execute)
- [ ] Automated strategy explorer: test many keyword/angle variations
- [ ] Self-improving prompts based on performance data
- [ ] Multi-client support (apply system to different brands/products)

---

## Contributing

The system is designed to grow through independent, modular skills. Good first contributions:

**Add a new skill** (`packages/skills/your_skill.py`):
- Inherit from the base `Skill` class in `packages/skills/__init__.py`
- Implement `execute(params) -> SkillResult`
- Register in the skill registry
- Add an API endpoint in `apps/api/app/main.py`
- Add a dashboard page in `apps/web/src/app/dashboard/your_skill/page.tsx`

**Good first issues:**
- UTM parameter injection on all CTA links
- Keyword research integration (SerpAPI key is already in config)
- A/B testing framework for article headlines
- WhatsApp Business API integration
- Automated sitemap submission to Google Search Console

**Code conventions:**
- All LLM calls through `packages/ai/complete()`
- All database through `packages/core/db`
- Never hardcode API keys or prompts
- Prompts live in `packages/ai/prompts/`
- All new content requires human approval before publishing (`status = 'approved'`)

---

## Key Design Decisions

**Why not just use LangChain/CrewAI?** We control the full stack. No framework overhead, easier to debug, costs are transparent.

**Why multi-provider LLM routing?** Different tasks need different models. DeepSeek for cheap structured output, GPT-4o for quality long-form, Claude for reasoning. Auto-routing keeps costs low while maintaining quality.

**Why Supabase + raw REST instead of an ORM?** The async REST client in `packages/core/` is 50 lines and does everything needed. No migrations complexity, no ORM magic to debug.

**Why human approval gates?** The system generates content autonomously, but publishing without a human check is a compliance and brand risk. The `ENABLE_AUTO_PUBLISH` flag exists for when you trust the system enough to remove the gate.

---

## License

MIT

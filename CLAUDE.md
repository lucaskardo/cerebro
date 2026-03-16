# CEREBRO v7 — Claude Code Instructions

## What is this?
CEREBRO is an autonomous traffic & lead generation system. It creates SEO-optimized content, publishes it, captures leads, and self-optimizes using a Karpathy AutoResearch-inspired experiment loop.

First client: ikigii (Towerbank app for Colombians).

## Architecture
10 engines: Mission → Demand → Opportunity → Content → Experience → Social → Conversion → Lead → Measurement → Learning

## Tech Stack
- **Backend**: Python/FastAPI (apps/api/)
- **Frontend**: Next.js 15 (apps/web/) — not built yet
- **Database**: Supabase (PostgreSQL) — schema in schema.sql
- **LLM**: Claude via Anthropic API — all calls through packages/ai/
- **SEO data**: SerpAPI

## Project Structure
```
cerebro/
├── apps/api/app/main.py     ← FastAPI endpoints
├── packages/
│   ├── core/__init__.py      ← DB client, config, cost tracker, logger
│   ├── ai/__init__.py        ← LLM wrapper with circuit breaker
│   ├── ai/prompts/           ← All prompt templates
│   ├── content/pipeline.py   ← Content generation pipeline
│   └── content/seo_rules.py  ← Modular SEO validation
├── schema.sql                ← Full Supabase schema (run once)
├── docs/program.md           ← AutoLoop experiment protocol
└── .env.example              ← Environment template
```

## Current Sprint: Sprint 1
Goal: Pipeline working, 5 articles published, dashboard showing data.

### What's built:
- ✅ Database schema (20 tables)
- ✅ FastAPI with all CRUD endpoints
- ✅ Content pipeline (brief→draft→humanize→validate)
- ✅ AI client with cost tracking + circuit breaker
- ✅ SEO rules module
- ✅ Program.md for AutoLoop

### What needs building:
- [ ] Next.js dashboard (apps/web/)
- [ ] Deploy setup (Vercel + Railway + Supabase)
- [ ] First 5 keywords → pipeline test
- [ ] Social media persona profiles
- [ ] Content publishing to site (SSG or ISR)

## Key Patterns
1. **All LLM calls** go through `packages/ai/` — never call Anthropic directly
2. **Cost circuit breaker**: $30/day default, stops all LLM calls if exceeded
3. **Content pipeline**: always keyword → brief(haiku) → draft(sonnet) → humanize(haiku) → validate(rules)
4. **Supabase is source of truth** — all state lives in the database
5. **Feature flags** in .env control what engines are active

## Commands
```bash
# Run API
cd apps/api && uvicorn app.main:app --reload --port 8000

# Test endpoint
curl http://localhost:8000/health
curl http://localhost:8000/api/status

# Generate content
curl -X POST http://localhost:8000/api/content/generate \
  -H "Content-Type: application/json" \
  -d '{"mission_id": "UUID", "keyword": "como abrir cuenta en dolares desde colombia"}'
```

## Rules
- Never hardcode API keys — always use env vars
- Never hardcode prompts — use packages/ai/prompts/
- Log all LLM costs — the circuit breaker depends on this
- Supabase queries use the REST API (httpx), not the Python SDK
- Content needs human approval before Sprint 4 (no auto-publish)

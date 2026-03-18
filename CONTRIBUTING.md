# Contributing to CEREBRO

## Architecture Overview

CEREBRO is an **AI Demand Generation Engine**. The core loop:

```
Goal → Strategy → Skills → Execution → Measurement → Learning → Improved Strategy
```

### Repository Layout

```
cerebro/
├── apps/
│   ├── api/          FastAPI backend (Python 3.11)
│   └── web/          Next.js 16 frontend (TypeScript)
├── packages/
│   ├── core/         DB client, config, cost tracker, logger
│   ├── ai/           LLM client + prompt templates
│   ├── content/      SEO content pipeline
│   ├── email/        Resend transactional emails
│   ├── jobs/         Persistent job queue + built-in handlers
│   ├── skills/       Modular skill system (ABC base + registry)
│   ├── loop/         Continuous strategy loop engine
│   ├── strategy/     Strategy generator and executor
│   ├── knowledge/    Learning store
│   └── attribution/  UTM tracking + funnel reports
├── migrations/       SQL migrations (001–012), apply in order
└── tests/            Pytest smoke tests
```

---

## Development Setup

### Prerequisites
- Python 3.11+
- Node 18+
- A Supabase project (or local via `supabase start`)

### Python (API)

```bash
pip install -r apps/api/requirements.txt
cp .env.example .env          # fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.
python -m apps.api.app.main   # or: uvicorn apps.api.app.main:app --reload
```

### Next.js (Web)

```bash
cd apps/web
npm ci
cp .env.local.example .env.local
npm run dev
```

### Database

Apply all migrations in order via Supabase SQL editor or CLI:

```bash
supabase db push   # if using supabase CLI
# or run migrations/001_core.sql … 012_maintenance.sql manually
```

---

## Rules

### General
- **No hardcoded brand data in code.** Brand context (name, persona, tone, audience) must come from the DB (`domain_sites` or `missions` tables). See `packages/content/pipeline.py::_build_brand_context`.
- **All LLM calls go through `packages/ai/`.** Never call Anthropic directly from business logic.
- **All DB access goes through `packages/core/db`.** Never use raw HTTP to Supabase outside the client.
- **Cost circuit breaker.** The `$30/day` limit is enforced in `packages/ai/`. Never bypass it.
- **Human approval required** for: content publish, social posts, community engagement, email sequences. See `approval_policy` on each Skill.

### API
- New endpoints go in `apps/api/app/routers/`. Add the router to `main.py`.
- Pydantic request/response models go in `apps/api/app/schemas/`. Import from there — no inline models in routers.
- Auth is enforced by `AuthMiddleware` at the app level. Public routes require an entry in `PUBLIC_ROUTES` or `PUBLIC_GET_PREFIXES` in `middleware/auth.py`.
- Rate limits: 300 req/60s (authenticated), 60 req/60s (public), 10 req/60s (lead capture).

### Skills
- New skills extend `packages/skills/Skill` (ABC).
- Declare `approval_policy = "auto_run" | "requires_approval"`.
- Register with `@register_skill` or add to the registry in `packages/skills/__init__.py`.
- Skills must be idempotent — the job worker may retry on failure.

### Jobs
- New job types: add `@register("job_type")` handler in `packages/jobs/__init__.py`.
- Always use `idempotency_key` when enqueueing recurring/daily jobs.
- Dead-lettered jobs (3 failed attempts) are logged and alert the operator.

### Frontend
- Dashboard pages live at `apps/web/src/app/dashboard/[section]/page.tsx`.
- Use the CSS utility classes defined in `globals.css` (`.dash-card`, `.stat-value`, `.badge-*`, etc.).
- Server components fetch directly with auth headers via `process.env.API_SECRET_KEY`.
- Client components use `process.env.NEXT_PUBLIC_*` variables.

---

## Testing

```bash
# API smoke tests (fast, no real DB/LLM)
pytest tests/ -v

# Next.js build check
cd apps/web && npm run build
```

Smoke tests cover: public endpoint access, auth enforcement on sensitive GETs, schema imports, core exceptions. They use `TestClient` with no real DB connections.

**Do not mock the DB in integration tests.** If you add integration tests, point them at a local Supabase instance.

---

## Adding a Migration

1. Create `migrations/0NN_description.sql`
2. Apply via Supabase dashboard SQL editor or CLI
3. Update `schema.sql` if it's the canonical schema file
4. Document new tables/columns in this file or in CLAUDE.md

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `API_SECRET_KEY` | ✅ | X-API-Key for dashboard/API access |
| `RESEND_KEY` | — | Resend API key (email) |
| `PRIMARY_DOMAIN` | — | Primary domain (e.g. `example.com`) |
| `ALLOWED_ORIGINS` | — | Extra CORS origins (comma-separated) |
| `DAILY_BUDGET` | — | LLM cost limit USD/day (default: 30) |
| `AUTO_PUBLISH` | — | Skip human review for content (default: false) |
| `LOOP_SCHEDULER_ENABLED` | — | Enable continuous strategy loop (default: false) |
| `ENCRYPTION_KEY` | — | For persona credential encryption |
| `MASTER_KEY` | — | For revealing encrypted credentials |

---

## API Versioning

Current version: **v1** (all routes at `/api/...`).

Breaking changes will be released at `/api/v2/`. The response header `X-API-Version: 1` is set on all responses. Non-breaking additions (new fields, new endpoints) do not require a version bump.

See interactive docs at `/api/docs` (Swagger UI) or `/api/redoc`.

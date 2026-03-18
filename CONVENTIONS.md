# CEREBRO — Development Conventions

## Python (API + Packages)
- async/await everywhere, type hints on all function signatures
- Every new endpoint: try/except returning empty data on error ([], {}, safe defaults)
- Every new table: MUST have site_id column
- Every new router: register in main.py with comment, add to auth whitelist if public
- Schemas: Pydantic models in apps/api/app/schemas/ (never inline in routers)
- Prompts: in packages/ai/prompts/ (never inline in business logic)
- Imports: absolute from project root (packages.core, packages.ai, etc.)
- Logging: use get_logger(__name__), log errors with context

## Frontend (Next.js)
- All dashboard pages: "use client" with useEffect fetch + try/catch + loading skeleton
- Styling: Tailwind utility classes only, no inline styles, no external CSS
- API calls: use lib/api.ts helper, include X-API-Key header
- Empty states: helpful text + action button ("No experiments. Create one?")
- Color coding: green=active/good, yellow=pending, red=failed, blue=running, gray=archived

## Database
- site_id on every table (multi-brand isolation)
- Migrations: numbered (001, 002...), idempotent (IF NOT EXISTS), in migrations/ folder
- JSONB for flexible fields, TEXT with CHECK for enums
- Always add indexes for foreign keys and common query patterns

## Git & Deploy
- Commits: prefix with Fix:, Feat:, Refactor:, Docs:, Chore:
- Push to main → Railway auto-deploys API
- Web deploy: cd apps/web && npx vercel --prod --yes
- Always run pytest before pushing

## Content & Intelligence
- NEVER generate generic content — always inject client_profiles context
- All content must be informed by: value proposition, pain points, competitors, market trends
- Prompts use {client_intelligence} placeholder filled from ClientIntelligence.get_content_context()
- If no client_profile exists for a site, warn the operator (don't silently use defaults)

## Testing
- Every new endpoint gets a smoke test in tests/test_smoke.py
- Test both happy path and auth protection
- Mock DB calls with AsyncMock (no real DB in tests)

## Deployment Rules (Learned from Production)
- **CORS before deploy**: Every new domain/site MUST be in CORS origins BEFORE deploying the site. Both `https://domain.com` and `https://www.domain.com`. Best: use dynamic CORS (read from `domain_sites` table at startup) so new sites auto-work without code changes.
- **Auth whitelist**: Every new endpoint called by public sites MUST be in `PUBLIC_ROUTES` or `PUBLIC_GET_PREFIXES` in `middleware/auth.py` before going live.
- **Dashboard pages**: MUST be `"use client"` with `useEffect` — never SSR fetch to the API.
- **No 500s**: Every API endpoint MUST have `try/except` returning empty data — never propagate 500s.
- **crypto.randomUUID fallback**: Not available in all browsers — always use a fallback (e.g. `Math.random().toString(36)`).
- **Vercel env vars**: When deploying a new site project, ALWAYS set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_ID` in Vercel env vars before the first deploy.
- **Auth changes**: After any auth middleware change, verify public endpoints (lead capture, tracking, content by slug) still work without auth.
- **CORS middleware order**: MUST be the FIRST middleware added so CORS headers are sent even on 500 errors.
- **Separate Vercel projects**: Every site in `apps/sites/` deploys as a SEPARATE Vercel project with Root Directory set to its folder.
- **Pre-deploy check**: Run `make check` (or `python scripts/check_deploy.py`) before every deploy.

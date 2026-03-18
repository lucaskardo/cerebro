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

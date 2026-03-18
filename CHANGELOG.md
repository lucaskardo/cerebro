# CEREBRO Changelog

## 2026-03-18 — Client Intelligence Layer + Truth Layer
- Added client_profiles and market_research tables (migration 013)
- Created packages/intelligence/ — deep market research pipeline
- Integrated client intelligence into content pipeline and strategy planner
- Fixed utm_campaign missing in lead capture
- Added attribution chain endpoint
- Updated intelligence dashboard page

## 2026-03-18 — Dashboard Fix + Content Pipeline Fix
- Fixed await bug in AI providers (_build_result was async but not awaited)
- Wrapped all GET endpoints in try/except (no more 500s)
- Fixed CORS for Vercel deployment
- Verified full pipeline: site → content generation → lead capture → dashboard visible
- Configured API_SECRET_KEY in Railway

## 2026-03-18 — Dashboard Build
- Created full dashboard with sidebar navigation
- 10 pages: Health, Leads, Content, Strategy, Experiments, Attribution, Approvals, Intelligence, Personas, System
- Brand selector in header (filters by site_id)
- Loading skeletons, toast notifications, CSV export
- All pages are "use client" (no SSR dependency on API)

## 2026-03-17 — v7 Core Build
- 44 tables across 11 migrations
- 9 API routers with ~70 endpoints
- Auth middleware with explicit whitelist
- Job system with idempotency + dead letter queue
- Content pipeline: research → brief → draft → humanize → validate
- Strategy loop with kill switches
- Lead state machine with full event tracking
- Multi-brand support via domain_sites + site_id
- Persona system with encrypted identities
- CI with GitHub Actions

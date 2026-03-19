# Client Intelligence Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a living client intelligence system that injects deep market research (pain points, competitors, content angles) into every content generation and strategy planning call.

**Architecture:** New `packages/intelligence/__init__.py` module runs AI-powered research to populate `client_profiles` and `market_research` tables. A new `/api/intelligence/*` router exposes CRUD + trigger endpoints. `get_content_context(site_id)` is injected into the content pipeline and strategy planner so every LLM call has real client knowledge. The intelligence dashboard page is rebuilt to show and manage client profiles.

**Tech Stack:** FastAPI, Supabase (via `packages.core.db`), `packages.ai.complete`, Next.js with existing `api.ts` pattern, TailwindCSS dashboard styles.

---

## File Map

### New Files
- `migrations/013_client_intelligence.sql` — DDL for `client_profiles` and `market_research` tables + indexes
- `packages/intelligence/__init__.py` — `ClientIntelligence` class with `research_client`, `refresh_research`, `get_profile`, `get_content_context`, `get_strategy_context`
- `apps/api/app/routers/intelligence.py` — FastAPI router: `POST /research`, `GET /profile/{site_id}`, `PATCH /profile/{site_id}`, `GET /research-log/{site_id}`, `POST /refresh/{site_id}`

### Modified Files
- `apps/api/app/main.py` — import and include `intelligence` router; add "Intelligence" to `_OPENAPI_TAGS`
- `packages/ai/prompts/content_prompts.py` — add `{client_intelligence}` placeholder in `BRIEF_SYSTEM`, `BRIEF_USER`, `DRAFT_SYSTEM`, `DRAFT_USER`
- `packages/content/pipeline.py` — call `ClientIntelligence().get_content_context(site_id)` after getting site; pass `client_intelligence` into `_build_brand_context` and then into all prompt calls that accept it
- `packages/strategy/__init__.py` — call `ClientIntelligence().get_strategy_context(site_id)` in `plan_opportunities` and `generate_strategies`; inject into prompt
- `apps/web/src/app/dashboard/intelligence/page.tsx` — full rewrite: shows client profile card, pain points, competitors table, content angles, research log, Run Research / Refresh buttons, PATCH capability
- `apps/web/src/lib/api.ts` — add `ClientProfile`, `MarketResearch` interfaces; add `intelligenceProfile`, `intelligenceResearchLog`, `intelligenceResearch`, `intelligenceRefresh`, `intelligencePatch` methods
- `apps/api/app/schemas/leads.py` — add `utm_campaign: Optional[str] = None`
- `apps/api/app/routers/leads.py` — add `"utm_campaign": lead.utm_campaign` to insert dict
- `apps/api/app/routers/attribution.py` — add `GET /api/reports/attribution-chain` endpoint
- `apps/web/src/app/dashboard/attribution/page.tsx` — add "Revenue by Asset" table with attribution chain data

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/013_client_intelligence.sql`

Note: existing migrations go up to `migrations/012_maintenance.sql`. Use 013.

- [ ] **Step 1: Write migration file**

```sql
-- 013_client_intelligence.sql
-- Client/market intelligence profiles — one per site
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_url TEXT,
  country TEXT NOT NULL,
  industry TEXT,
  value_proposition TEXT,
  core_competencies JSONB DEFAULT '[]',
  pain_points JSONB DEFAULT '[]',
  desires JSONB DEFAULT '[]',
  target_segments JSONB DEFAULT '[]',
  advantages JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  competitors JSONB DEFAULT '[]',
  content_angles JSONB DEFAULT '[]',
  customer_objections JSONB DEFAULT '[]',
  buying_triggers JSONB DEFAULT '[]',
  market_trends JSONB DEFAULT '[]',
  key_differentiators JSONB DEFAULT '[]',
  brand_voice_notes TEXT,
  research_depth TEXT DEFAULT 'none' CHECK (research_depth IN ('none','initial','standard','deep')),
  research_version INTEGER DEFAULT 0,
  last_researched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id)
);

-- Individual market research entries — append-only log
CREATE TABLE IF NOT EXISTS market_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES domain_sites(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
  research_type TEXT NOT NULL CHECK (research_type IN (
    'company_analysis', 'competitor_analysis', 'audience_research',
    'pain_point_discovery', 'market_trends', 'content_gap_analysis',
    'keyword_opportunity', 'positioning_analysis'
  )),
  query TEXT NOT NULL,
  findings TEXT,
  structured_data JSONB DEFAULT '{}',
  confidence TEXT DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  source TEXT DEFAULT 'ai_research',
  applied_to_profile BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_site ON client_profiles(site_id);
CREATE INDEX IF NOT EXISTS idx_market_research_site ON market_research(site_id);
CREATE INDEX IF NOT EXISTS idx_market_research_type ON market_research(site_id, research_type);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with the SQL above. Verify success (no errors).

- [ ] **Step 3: Verify tables exist**

Use `mcp__plugin_supabase_supabase__list_tables` and confirm `client_profiles` and `market_research` appear.

- [ ] **Step 4: Commit**

```bash
cd /Users/lucaskay/Desktop/cerebro
git add migrations/013_client_intelligence.sql
git commit -m "feat: add client_profiles and market_research tables (migration 013)"
```

---

## Task 2: Intelligence Module

**Files:**
- Create: `packages/intelligence/__init__.py`

- [ ] **Step 1: Create the module**

```python
"""
CEREBRO — Client Intelligence Layer
Maintains living market knowledge per client/site.
"""
import json
from datetime import datetime, timezone
from packages.core import db, get_logger
from packages.ai import complete

logger = get_logger("intelligence")

_RESEARCH_PROMPT = """You are a senior marketing strategist conducting deep market research.
Analyze this company as if preparing a $50,000 consulting engagement.

Company: {company}
Country: {country}
Industry: {industry}
Website: {company_url}

Provide a comprehensive analysis in JSON format:
{{
  "value_proposition": "What this company uniquely offers (1-2 sentences)",
  "core_competencies": ["3-5 core strengths"],
  "pain_points": ["5-10 specific pain points of their target audience"],
  "desires": ["5-7 aspirations/goals of their target audience"],
  "target_segments": [
    {{"name": "segment name", "description": "who they are", "size": "estimated size", "priority": "high/medium/low"}}
  ],
  "advantages": ["3-5 competitive advantages"],
  "weaknesses": ["2-4 areas of vulnerability"],
  "competitors": [
    {{"name": "competitor", "url": "if known", "positioning": "how they position", "weakness": "where they're vulnerable"}}
  ],
  "content_angles": ["5-8 unique content perspectives that differentiate from competitors"],
  "customer_objections": ["5-7 common objections or hesitations"],
  "buying_triggers": ["5-7 events or situations that trigger purchase decisions"],
  "market_trends": ["3-5 relevant trends in this industry/country"],
  "key_differentiators": ["3-5 things that make this company different"],
  "brand_voice_notes": "Recommended tone and personality for content"
}}

Be specific to {country} market. Use real competitor names.
Reference actual market dynamics, not generic business advice."""

_RESEARCH_SYSTEM = (
    "You are a senior marketing strategist with deep experience in Latin American markets. "
    "Output ONLY valid JSON — no preamble, no explanation."
)


class ClientIntelligence:

    async def research_client(
        self,
        site_id: str,
        company: str,
        country: str,
        company_url: str = None,
        industry: str = None,
    ) -> dict:
        """Run full research pipeline for a client. Creates or updates client_profile."""
        logger.info(f"Starting research for {company} ({country})")

        # Get or create profile
        existing = await db.query("client_profiles", params={
            "select": "*",
            "site_id": f"eq.{site_id}",
            "limit": "1",
        })
        profile_id = existing[0]["id"] if existing else None

        if not profile_id:
            profile = await db.insert("client_profiles", {
                "site_id": site_id,
                "company_name": company,
                "company_url": company_url,
                "country": country,
                "industry": industry,
                "research_depth": "initial",
                "research_version": 1,
            })
            profile_id = profile["id"]
        else:
            profile_id = existing[0]["id"]

        # Run AI research
        result = await complete(
            prompt=_RESEARCH_PROMPT.format(
                company=company,
                country=country,
                industry=industry or "general business",
                company_url=company_url or "not provided",
            ),
            system=_RESEARCH_SYSTEM,
            model="sonnet",
            json_mode=True,
            pipeline_step="client_research",
        )

        data = result.get("parsed") or {}
        if not data:
            logger.warning(f"Research returned empty for {company}")
            return await self.get_profile(site_id) or {}

        # Store raw research entry
        await db.insert("market_research", {
            "site_id": site_id,
            "profile_id": profile_id,
            "research_type": "company_analysis",
            "query": f"Full analysis: {company} in {country}",
            "findings": json.dumps(data, ensure_ascii=False)[:5000],
            "structured_data": data,
            "confidence": "high",
            "applied_to_profile": True,
        })

        # Merge into profile
        now = datetime.now(timezone.utc).isoformat()
        update_payload = {
            "company_name": company,
            "company_url": company_url,
            "country": country,
            "industry": industry,
            "value_proposition": data.get("value_proposition"),
            "core_competencies": data.get("core_competencies", []),
            "pain_points": data.get("pain_points", []),
            "desires": data.get("desires", []),
            "target_segments": data.get("target_segments", []),
            "advantages": data.get("advantages", []),
            "weaknesses": data.get("weaknesses", []),
            "competitors": data.get("competitors", []),
            "content_angles": data.get("content_angles", []),
            "customer_objections": data.get("customer_objections", []),
            "buying_triggers": data.get("buying_triggers", []),
            "market_trends": data.get("market_trends", []),
            "key_differentiators": data.get("key_differentiators", []),
            "brand_voice_notes": data.get("brand_voice_notes"),
            "research_depth": "standard",
            "last_researched_at": now,
            "updated_at": now,
        }

        # Increment version if already had profile
        if existing:
            update_payload["research_version"] = (existing[0].get("research_version") or 0) + 1

        await db.update("client_profiles", profile_id, update_payload)
        logger.info(f"Research complete for {company}: {len(data.get('pain_points', []))} pain points, {len(data.get('competitors', []))} competitors")
        return await self.get_profile(site_id) or {}

    async def refresh_research(self, site_id: str, focus_areas: list = None) -> dict:
        """Re-run research, merging new data additively."""
        profile = await self.get_profile(site_id)
        if not profile:
            raise ValueError(f"No client profile found for site_id={site_id}. Run research_client first.")

        return await self.research_client(
            site_id=site_id,
            company=profile["company_name"],
            country=profile["country"],
            company_url=profile.get("company_url"),
            industry=profile.get("industry"),
        )

    async def get_profile(self, site_id: str) -> dict | None:
        """Return full client_profile record or None."""
        rows = await db.query("client_profiles", params={
            "select": "*",
            "site_id": f"eq.{site_id}",
            "limit": "1",
        })
        return rows[0] if rows else None

    async def get_content_context(self, site_id: str) -> str:
        """
        Returns formatted string injected into EVERY content generation prompt.
        Falls back to minimal brand context from domain_sites if no profile.
        NEVER returns empty string.
        """
        if not site_id:
            return "Content specialist. Professional, helpful tone."

        profile = await self.get_profile(site_id)

        if not profile or profile.get("research_depth") == "none":
            # Fallback: use domain_sites brand fields
            site = await db.get_by_id("domain_sites", site_id)
            if site:
                return (
                    f"Brand: {site.get('brand_name') or 'Unknown'}\n"
                    f"Persona: {site.get('brand_persona') or 'Content specialist'}\n"
                    f"Tone: {site.get('brand_tone') or 'professional, helpful'}\n"
                    f"[WARNING: No deep client research available. Run /api/intelligence/research to unlock full context.]"
                )
            return "Content specialist. Professional, helpful tone."

        pain_points = profile.get("pain_points") or []
        competitors = profile.get("competitors") or []
        content_angles = profile.get("content_angles") or []
        buying_triggers = profile.get("buying_triggers") or []

        competitors_summary = "; ".join(
            f"{c['name']} ({c.get('positioning', '')})" if isinstance(c, dict) else str(c)
            for c in competitors[:5]
        )

        return f"""CLIENT INTELLIGENCE — {profile['company_name']} ({profile['country']})
Value Proposition: {profile.get('value_proposition') or 'Not researched yet'}
Tone/Voice: {profile.get('brand_voice_notes') or 'Professional, helpful'}

AUDIENCE PAIN POINTS:
{chr(10).join(f'- {p}' for p in pain_points[:7])}

AUDIENCE DESIRES:
{chr(10).join(f'- {d}' for d in (profile.get('desires') or [])[:5])}

COMPETITORS TO DIFFERENTIATE FROM:
{competitors_summary or 'None identified yet'}

CONTENT ANGLES (use these perspectives):
{chr(10).join(f'- {a}' for a in content_angles[:6])}

BUYING TRIGGERS (address these):
{chr(10).join(f'- {t}' for t in buying_triggers[:5])}

KEY DIFFERENTIATORS:
{chr(10).join(f'- {d}' for d in (profile.get('key_differentiators') or [])[:4])}"""

    async def get_strategy_context(self, site_id: str) -> str:
        """
        Formatted for strategy decisions. Includes: market trends, competitor weaknesses,
        untapped segments, high-potential content angles, buying triggers.
        """
        if not site_id:
            return ""

        profile = await self.get_profile(site_id)
        if not profile or profile.get("research_depth") == "none":
            return ""

        competitors = profile.get("competitors") or []
        comp_weaknesses = [
            f"{c['name']}: {c.get('weakness', 'unknown')}"
            for c in competitors[:5] if isinstance(c, dict) and c.get("weakness")
        ]

        segments = profile.get("target_segments") or []
        high_priority = [
            f"{s['name']} — {s.get('description', '')}"
            for s in segments if isinstance(s, dict) and s.get("priority") == "high"
        ]

        return f"""MARKET INTELLIGENCE — {profile['company_name']} ({profile['country']})

COMPETITOR WEAKNESSES (exploit these):
{chr(10).join(f'- {w}' for w in comp_weaknesses) or '- None identified'}

HIGH-PRIORITY SEGMENTS (target first):
{chr(10).join(f'- {s}' for s in high_priority) or '- Not segmented yet'}

MARKET TRENDS:
{chr(10).join(f'- {t}' for t in (profile.get('market_trends') or [])[:4])}

BUYING TRIGGERS (align content timing to these):
{chr(10).join(f'- {t}' for t in (profile.get('buying_triggers') or [])[:5])}

CONTENT ANGLES WITH HIGHEST DIFFERENTIATION POTENTIAL:
{chr(10).join(f'- {a}' for a in (profile.get('content_angles') or [])[:5])}

CUSTOMER OBJECTIONS TO PREEMPT:
{chr(10).join(f'- {o}' for o in (profile.get('customer_objections') or [])[:4])}"""
```

- [ ] **Step 2: Smoke-test the module (no LLM call)**

Run in project root:
```bash
cd /Users/lucaskay/Desktop/cerebro
python -c "
import asyncio, sys
sys.path.insert(0, '.')
from packages.intelligence import ClientIntelligence
intel = ClientIntelligence()
print('Module loads OK')
print('Methods:', [m for m in dir(intel) if not m.startswith('_')])
"
```
Expected: prints `Module loads OK` and lists 5 methods.

- [ ] **Step 3: Commit**

```bash
git add packages/intelligence/__init__.py
git commit -m "feat: add ClientIntelligence module with research, context, and strategy methods"
```

---

## Task 3: Intelligence API Router

**Files:**
- Create: `apps/api/app/routers/intelligence.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Create the router**

```python
"""Intelligence router — client profile research and retrieval."""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List

from packages.intelligence import ClientIntelligence
from packages.core import db, get_logger
from apps.api.app.middleware.auth import require_auth

logger = get_logger("router.intelligence")
router = APIRouter(tags=["Intelligence"], prefix="/api/intelligence")
_intel = ClientIntelligence()


class ResearchRequest(BaseModel):
    site_id: str
    company: str
    country: str
    company_url: Optional[str] = None
    industry: Optional[str] = None


class ProfilePatch(BaseModel):
    company_name: Optional[str] = None
    company_url: Optional[str] = None
    country: Optional[str] = None
    industry: Optional[str] = None
    value_proposition: Optional[str] = None
    brand_voice_notes: Optional[str] = None
    pain_points: Optional[List] = None
    desires: Optional[List] = None
    competitors: Optional[List] = None
    content_angles: Optional[List] = None
    customer_objections: Optional[List] = None
    buying_triggers: Optional[List] = None
    market_trends: Optional[List] = None
    key_differentiators: Optional[List] = None
    advantages: Optional[List] = None
    weaknesses: Optional[List] = None
    core_competencies: Optional[List] = None
    target_segments: Optional[List] = None


class RefreshRequest(BaseModel):
    focus_areas: Optional[List[str]] = None


@router.post("/research", dependencies=[Depends(require_auth)])
async def run_research(req: ResearchRequest):
    """Trigger full market research for a client. Creates or updates client_profile."""
    try:
        profile = await _intel.research_client(
            site_id=req.site_id,
            company=req.company,
            country=req.country,
            company_url=req.company_url,
            industry=req.industry,
        )
        return profile
    except Exception as e:
        logger.error(f"Research failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.get("/profile/{site_id}", dependencies=[Depends(require_auth)])
async def get_profile(site_id: str):
    """Return client_profile + count of market_research entries."""
    profile = await _intel.get_profile(site_id)
    if not profile:
        raise HTTPException(404, f"No profile found for site_id={site_id}")

    research_count_rows = await db.query("market_research", params={
        "select": "id",
        "site_id": f"eq.{site_id}",
    })
    return {**profile, "research_entry_count": len(research_count_rows)}


@router.patch("/profile/{site_id}", dependencies=[Depends(require_auth)])
async def patch_profile(site_id: str, body: ProfilePatch):
    """Manually update any client_profile fields."""
    profile = await _intel.get_profile(site_id)
    if not profile:
        raise HTTPException(404, f"No profile found for site_id={site_id}")

    from datetime import datetime, timezone
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    updated = await db.update("client_profiles", profile["id"], update)
    return updated


@router.get("/research-log/{site_id}", dependencies=[Depends(require_auth)])
async def get_research_log(site_id: str, limit: int = 50):
    """Return all market_research entries ordered by created_at desc."""
    rows = await db.query("market_research", params={
        "select": "*",
        "site_id": f"eq.{site_id}",
        "order": "created_at.desc",
        "limit": str(limit),
    })
    return rows


@router.post("/refresh/{site_id}", dependencies=[Depends(require_auth)])
async def refresh_research(site_id: str, body: RefreshRequest = None):
    """Re-run research for this site, merging new findings into existing profile."""
    try:
        profile = await _intel.refresh_research(
            site_id=site_id,
            focus_areas=body.focus_areas if body else None,
        )
        return profile
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Refresh failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))
```

- [ ] **Step 2: Register router in main.py**

In `apps/api/app/main.py`:

**Line 63** — add to `_OPENAPI_TAGS` list (after the Loop entry):
```python
    {"name": "Intelligence", "description": "Client intelligence: market research, competitor analysis, profile management."},
```

**Line 164** — replace the existing router import:
```python
# OLD:
from apps.api.app.routers import system, content, leads, strategy, personas, attribution, execution, loop
# NEW:
from apps.api.app.routers import system, content, leads, strategy, personas, attribution, execution, loop, intelligence
```

**After line 173** (`app.include_router(loop.router)`), add:
```python
app.include_router(intelligence.router)
```

- [ ] **Step 3: Test the router imports cleanly**

```bash
cd /Users/lucaskay/Desktop/cerebro
python -c "
import sys; sys.path.insert(0, '.')
from apps.api.app.routers.intelligence import router
print('Intelligence router OK, routes:', [r.path for r in router.routes])
"
```
Expected: prints 5 route paths.

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/routers/intelligence.py apps/api/app/main.py
git commit -m "feat: add intelligence API router with research, profile, patch, refresh, and log endpoints"
```

---

## Task 4: Content Pipeline Integration

**Files:**
- Modify: `packages/ai/prompts/content_prompts.py`
- Modify: `packages/content/pipeline.py`

- [ ] **Step 1: Add `{client_intelligence}` to content prompts**

In `packages/ai/prompts/content_prompts.py`:

Replace `BRIEF_SYSTEM`:
```python
BRIEF_SYSTEM = """Eres {brand_persona}.
Creas briefs de contenido SEO para {brand_audience_summary} que maximizan potencial SEO y conversión.
Tono requerido: {brand_tone}.

{client_intelligence}

Responde SOLO en JSON válido."""
```

Replace `BRIEF_USER` (add `{client_intelligence}` block after the Misión section):
```python
BRIEF_USER = """Crea un brief para el keyword: "{keyword}"

Misión:
- País: {country}
- Partner: {partner_name}
- Audiencia: {target_audience}
- Topics: {core_topics}
- CTA: {cta_config}

{client_intelligence}

JSON exacto:
{{
    "title_suggestions": ["3 títulos SEO-optimizados"],
    "search_intent": "informational|transactional|comparison",
    "target_word_count": 1500,
    "h2_sections": ["5-8 secciones H2"],
    "key_points": ["5-7 puntos clave obligatorios"],
    "cta_placement": "dónde mencionar partner naturalmente",
    "internal_links_suggested": ["3-5 temas para linking"],
    "faq_questions": ["5 preguntas People Also Ask"],
    "comparison_angle": "qué comparar si aplica",
    "data_points_needed": ["datos verificables para E-E-A-T"],
    "tone": "{brand_tone_example}",
    "first_paragraph_hook": "respuesta directa 30-50 palabras"
}}"""
```

Replace `DRAFT_SYSTEM`:
```python
DRAFT_SYSTEM = """Eres {brand_persona}.
Tono: {brand_tone}.

{client_intelligence}

REGLAS:
1. Párrafo 1: respuesta directa 30-50 palabras (Google AI Overviews)
2. Secciones H2: 75-300 palabras, auto-contenidas
3. FAQ con preguntas reales al final
4. Partner ({partner_name}) máximo 2 veces, natural
5. NUNCA inventes datos. Si no seguro: [VERIFICAR]
6. Usa COP Y USD en ejemplos
7. Cita fuentes con datos específicos
8. Mínimo un ejemplo numérico concreto

Responde SOLO en JSON válido."""
```

Replace `DRAFT_USER` (add after `Hook:` line):
```python
DRAFT_USER = """Escribe artículo completo:

Título: {title}
Secciones: {h2_sections}
Puntos clave: {key_points}
FAQs: {faq_questions}
Datos: {data_points_needed}
CTA: {cta_placement}
Hook: {first_paragraph_hook}
Target: {target_word_count} palabras

{client_intelligence}

JSON:
{{
    "title": "título final",
    "meta_description": "150-160 chars con keyword",
    "outline": {{"h2_sections": ["secciones"]}},
    "body_md": "artículo COMPLETO en Markdown ## H2 ### H3",
    "faq_section": [{{"question": "?", "answer": "2-4 oraciones"}}],
    "internal_links_needed": ["temas para links"],
    "data_claims": [{{"claim": "dato", "confidence": "verified|inferred|needs_verification", "source": "fuente"}}],
    "partner_mentions": [{{"position": "párrafo N", "context": "cómo"}}]
}}"""
```

- [ ] **Step 2: Integrate ClientIntelligence into pipeline.py**

In `packages/content/pipeline.py`, modify `run_pipeline` to fetch client context after getting site. Add this block right after `brand = _build_brand_context(mission, site)`:

```python
    # Get client intelligence context
    client_intelligence = ""
    if site_id:
        try:
            from packages.intelligence import ClientIntelligence
            intel = ClientIntelligence()
            client_intelligence = await intel.get_content_context(site_id)
        except Exception as e:
            logger.warning(f"[{run_id}] Could not load client intelligence: {e}")
```

Pass `client_intelligence` to `_build_brand_context` by adding it to brand dict:
```python
    brand = _build_brand_context(mission, site)
    brand["client_intelligence"] = client_intelligence
```

- [ ] **Step 3: Thread `client_intelligence` through prompt calls in pipeline.py**

In `_generate_brief` (around line 226-245), update the two `.format()` calls:

```python
    result = await complete(
        prompt=prompts.BRIEF_USER.format(
            keyword=keyword,
            country=brand.get("country", ""),
            partner_name=brand.get("partner_name", ""),
            target_audience=json.dumps(brand.get("target_audience", {}), ensure_ascii=False),
            core_topics=json.dumps(brand.get("core_topics", []), ensure_ascii=False),
            cta_config=json.dumps(brand.get("cta_config", {}), ensure_ascii=False),
            brand_tone_example=brand.get("brand_tone", "directo, honesto, útil"),
            client_intelligence=brand.get("client_intelligence", ""),  # NEW
        ) + research_context,
        system=prompts.BRIEF_SYSTEM.format(
            brand_persona=brand.get("brand_persona", "experto en el tema"),
            brand_tone=brand.get("brand_tone", "directo, honesto, útil"),
            brand_audience_summary=audience_summary or "personas interesadas en el tema",
            client_intelligence=brand.get("client_intelligence", ""),  # NEW
        ),
        ...
    )
```

In `_generate_draft` (around line 270-292), update the two `.format()` calls:

```python
    result = await complete(
        prompt=prompts.DRAFT_USER.format(
            title=title,
            h2_sections=json.dumps(brief.get("h2_sections", []), ensure_ascii=False),
            key_points=json.dumps(brief.get("key_points", []), ensure_ascii=False),
            faq_questions=json.dumps(brief.get("faq_questions", []), ensure_ascii=False),
            data_points_needed=json.dumps(brief.get("data_points_needed", []), ensure_ascii=False),
            cta_placement=brief.get("cta_placement", "natural"),
            first_paragraph_hook=brief.get("first_paragraph_hook", ""),
            target_word_count=brief.get("target_word_count", 1500),
            client_intelligence=brand.get("client_intelligence", ""),  # NEW
        ),
        system=prompts.DRAFT_SYSTEM.format(
            brand_persona=brand.get("brand_persona", "experto en el tema"),
            brand_tone=brand.get("brand_tone", "directo, honesto, útil"),
            partner_name=brand.get("partner_name", ""),
            client_intelligence=brand.get("client_intelligence", ""),  # NEW
        ),
        ...
    )
```

Note: `_research_keyword` and `_humanize` prompts do NOT need `{client_intelligence}` — only brief and draft prompts are updated per the spec.

- [ ] **Step 4: Verify pipeline imports cleanly**

```bash
cd /Users/lucaskay/Desktop/cerebro
python -c "
import sys; sys.path.insert(0, '.')
from packages.content import pipeline
print('Pipeline OK')
"
```
Expected: prints `Pipeline OK` with no import errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/prompts/content_prompts.py packages/content/pipeline.py
git commit -m "feat: inject client intelligence context into content pipeline prompts"
```

---

## Task 5: Strategy Planner Integration

**Files:**
- Modify: `packages/strategy/__init__.py`

- [ ] **Step 1: Add strategy context to `plan_opportunities`**

In `packages/strategy/__init__.py`, in `plan_opportunities`, add after pulling `facts`:

```python
    # Get client intelligence for strategy context
    strategy_intel = ""
    if site_id:
        try:
            from packages.intelligence import ClientIntelligence
            intel = ClientIntelligence()
            strategy_intel = await intel.get_strategy_context(site_id)
        except Exception as e:
            logger.warning(f"Could not load strategy intelligence: {e}")
```

Then in the `complete(prompt=...)` call, add the intelligence block to the prompt string. Replace the `GOAL:` section start with:

```python
        prompt=f"""Generate 3-5 concrete demand generation opportunities.

GOAL: {goal['description']}
TARGET METRIC: {goal['target_metric']} = {goal['target_value']}
CURRENT VALUE: {goal.get('current_value', 0)}

{strategy_intel}

KNOWLEDGE (what has worked):
{json.dumps(knowledge[:5], indent=2, ensure_ascii=False) if knowledge else "No knowledge yet — propose experiments."}
...
```

- [ ] **Step 2: Add strategy context to `generate_strategies`**

Same pattern in `generate_strategies`. After getting `past_strategies`, add the intel call:

```python
    # Get client intelligence
    strategy_intel = ""
    goal_site_id = goal.get("site_id")
    if goal_site_id:
        try:
            from packages.intelligence import ClientIntelligence
            intel = ClientIntelligence()
            strategy_intel = await intel.get_strategy_context(goal_site_id)
        except Exception as e:
            logger.warning(f"Could not load strategy intelligence: {e}")
```

Add `{strategy_intel}` block in the prompt after `MISSION CONTEXT:` section.

- [ ] **Step 3: Verify strategy module imports cleanly**

```bash
cd /Users/lucaskay/Desktop/cerebro
python -c "
import sys; sys.path.insert(0, '.')
from packages.strategy import generate_strategies, plan_opportunities
print('Strategy module OK')
"
```

- [ ] **Step 4: Commit**

```bash
git add packages/strategy/__init__.py
git commit -m "feat: inject client intelligence context into strategy planner prompts"
```

---

## Task 6: Intelligence Dashboard Page

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/dashboard/intelligence/page.tsx`

- [ ] **Step 1: Add types and API methods to api.ts**

Add these interfaces to `apps/web/src/lib/api.ts` (after existing interfaces):

```typescript
export interface ClientProfile {
  id: string;
  site_id: string;
  company_name: string;
  company_url: string | null;
  country: string;
  industry: string | null;
  value_proposition: string | null;
  core_competencies: string[];
  pain_points: string[];
  desires: string[];
  target_segments: Array<{ name: string; description: string; size: string; priority: string }>;
  advantages: string[];
  weaknesses: string[];
  competitors: Array<{ name: string; url?: string; positioning: string; weakness: string }>;
  content_angles: string[];
  customer_objections: string[];
  buying_triggers: string[];
  market_trends: string[];
  key_differentiators: string[];
  brand_voice_notes: string | null;
  research_depth: "none" | "initial" | "standard" | "deep";
  research_version: number;
  last_researched_at: string | null;
  research_entry_count?: number;
}

export interface MarketResearch {
  id: string;
  site_id: string;
  research_type: string;
  query: string;
  findings: string | null;
  confidence: "low" | "medium" | "high";
  source: string;
  created_at: string;
}
```

Add these methods to the `api` object (after `knowledgeInsights`):

```typescript
  intelligenceProfile: (siteId: string) =>
    fetchAPI<ClientProfile>(`/api/intelligence/profile/${siteId}`),
  intelligenceResearchLog: (siteId: string, limit = 20) =>
    fetchAPI<MarketResearch[]>(`/api/intelligence/research-log/${siteId}?limit=${limit}`),
```

Add these standalone functions (after `updateQueueItem`):

```typescript
export async function runIntelligenceResearch(data: {
  site_id: string;
  company: string;
  country: string;
  company_url?: string;
  industry?: string;
}): Promise<ClientProfile> {
  const res = await fetch(`${API_URL}/api/intelligence/research`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Research failed: ${res.status}`);
  return res.json();
}

export async function refreshIntelligence(siteId: string): Promise<ClientProfile> {
  const res = await fetch(`${API_URL}/api/intelligence/refresh/${siteId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  return res.json();
}

export async function patchIntelligenceProfile(
  siteId: string,
  data: Partial<ClientProfile>
): Promise<ClientProfile> {
  const res = await fetch(`${API_URL}/api/intelligence/profile/${siteId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Patch failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Rewrite the intelligence dashboard page**

Full replacement of `apps/web/src/app/dashboard/intelligence/page.tsx`:

```tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api, runIntelligenceResearch, refreshIntelligence } from "@/lib/api";
import type { ClientProfile, MarketResearch, Site } from "@/lib/api";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DEPTH_BADGE: Record<string, string> = {
  none: "badge badge-gray",
  initial: "badge badge-yellow",
  standard: "badge badge-blue",
  deep: "badge badge-green",
};

const CONF_BADGE: Record<string, string> = {
  low: "badge badge-yellow",
  medium: "badge badge-blue",
  high: "badge badge-green",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

function TagList({ items }: { items: string[] }) {
  if (!items?.length) return <p style={{ color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>—</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.375rem" }}>
      {items.map((item, i) => (
        <span key={i} style={{
          padding: "0.25rem 0.625rem",
          borderRadius: "0.375rem",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--dash-border)",
          fontSize: "0.75rem",
          color: "var(--dash-text)",
        }}>{item}</span>
      ))}
    </div>
  );
}

// ─── Research Form ─────────────────────────────────────────────────────────────

function ResearchForm({ sites, onSuccess }: { sites: Site[]; onSuccess: () => void }) {
  const [form, setForm] = useState({ site_id: sites[0]?.id || "", company: "", country: "", company_url: "", industry: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site_id || !form.company || !form.country) {
      setError("site_id, company, and country are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await runIntelligenceResearch({
        site_id: form.site_id,
        company: form.company,
        country: form.country,
        company_url: form.company_url || undefined,
        industry: form.industry || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-card" style={{ padding: "1.25rem" }}>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "1rem", color: "var(--dash-text)" }}>
        Run Deep Market Research
      </h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Site</label>
            <select
              value={form.site_id}
              onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.brand_name || s.domain}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Company Name *</label>
            <input
              value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              placeholder="e.g. ikigii"
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Country *</label>
            <input
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              placeholder="e.g. Colombia"
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Industry</label>
            <input
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              placeholder="e.g. fintech wealth management"
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)", display: "block", marginBottom: "0.25rem" }}>Website URL</label>
            <input
              value={form.company_url}
              onChange={e => setForm(f => ({ ...f, company_url: e.target.value }))}
              placeholder="https://example.com"
              style={{ width: "100%", padding: "0.5rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            />
          </div>
        </div>
        {error && <p style={{ color: "var(--dash-danger)", fontSize: "0.75rem" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: "0.625rem 1.25rem", background: "var(--dash-accent)", color: "#000", border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.8125rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, alignSelf: "flex-start" as const }}
        >
          {loading ? "Researching… (30-60s)" : "Run Research"}
        </button>
      </form>
    </div>
  );
}

// ─── Profile View ──────────────────────────────────────────────────────────────

function ProfileView({ profile, onRefresh, refreshing }: {
  profile: ClientProfile;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: "1.5rem" }}>
      {/* Profile header card */}
      <div className="dash-card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" as const }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--dash-text)" }}>
                {profile.company_name}
              </h2>
              <span className={DEPTH_BADGE[profile.research_depth]}>
                {profile.research_depth}
              </span>
              <span className="badge badge-gray">v{profile.research_version}</span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>
              {profile.country}{profile.industry ? ` · ${profile.industry}` : ""}
              {profile.company_url && (
                <> · <a href={profile.company_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--dash-accent)" }}>{profile.company_url}</a></>
              )}
            </p>
            {profile.value_proposition && (
              <p style={{ fontSize: "0.875rem", color: "var(--dash-text)", marginTop: "0.75rem", lineHeight: 1.5, maxWidth: "60ch" }}>
                {profile.value_proposition}
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: "0.5rem" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
              Last researched: {fmtDate(profile.last_researched_at)}
            </p>
            {profile.research_entry_count !== undefined && (
              <p style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                {profile.research_entry_count} research entries
              </p>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              style={{ padding: "0.5rem 1rem", background: "rgba(255,255,255,0.06)", border: "1px solid var(--dash-border)", borderRadius: "0.5rem", color: "var(--dash-text)", fontSize: "0.75rem", cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1 }}
            >
              {refreshing ? "Refreshing…" : "Refresh Research"}
            </button>
          </div>
        </div>
      </div>

      {/* Pain points + Desires */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Section title="Audience Pain Points">
          <div className="dash-card" style={{ padding: "1rem" }}>
            {profile.pain_points?.length ? (
              <ul style={{ margin: 0, padding: "0 0 0 1.125rem", display: "flex", flexDirection: "column" as const, gap: "0.375rem" }}>
                {profile.pain_points.map((p, i) => (
                  <li key={i} style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.5 }}>{p}</li>
                ))}
              </ul>
            ) : <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>—</p>}
          </div>
        </Section>
        <Section title="Audience Desires">
          <div className="dash-card" style={{ padding: "1rem" }}>
            {profile.desires?.length ? (
              <ul style={{ margin: 0, padding: "0 0 0 1.125rem", display: "flex", flexDirection: "column" as const, gap: "0.375rem" }}>
                {profile.desires.map((d, i) => (
                  <li key={i} style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.5 }}>{d}</li>
                ))}
              </ul>
            ) : <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)" }}>—</p>}
          </div>
        </Section>
      </div>

      {/* Competitors table */}
      <Section title="Competitor Landscape">
        <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
          {profile.competitors?.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Competitor</th>
                    <th>Positioning</th>
                    <th>Weakness (our opportunity)</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.competitors.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--dash-text)" }}>
                          {typeof c === "object" ? c.name : String(c)}
                        </span>
                        {typeof c === "object" && c.url && (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "0.6875rem", color: "var(--dash-accent)" }}>{c.url}</a>
                        )}
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", maxWidth: 220 }}>
                        {typeof c === "object" ? c.positioning : "—"}
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "#f59e0b", maxWidth: 220 }}>
                        {typeof c === "object" ? c.weakness : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--dash-text-dim)", fontSize: "0.8125rem" }}>No competitors identified</div>
          )}
        </div>
      </Section>

      {/* Content angles + Market trends */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Section title="Content Angles">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.content_angles || []} />
          </div>
        </Section>
        <Section title="Market Trends">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.market_trends || []} />
          </div>
        </Section>
      </div>

      {/* Buying triggers + Objections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Section title="Buying Triggers">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.buying_triggers || []} />
          </div>
        </Section>
        <Section title="Customer Objections">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.customer_objections || []} />
          </div>
        </Section>
      </div>

      {/* Key differentiators + Voice */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Section title="Key Differentiators">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <TagList items={profile.key_differentiators || []} />
          </div>
        </Section>
        <Section title="Brand Voice Notes">
          <div className="dash-card" style={{ padding: "1rem" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--dash-text)", lineHeight: 1.6 }}>
              {profile.brand_voice_notes || "—"}
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Research Log ──────────────────────────────────────────────────────────────

function ResearchLog({ entries }: { entries: MarketResearch[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!entries.length) return null;
  const shown = expanded ? entries : entries.slice(0, 3);
  return (
    <Section title={`Research Log (${entries.length})`}>
      <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Query</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><span className="mono" style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>{fmtDate(r.created_at)}</span></td>
                  <td><span className="badge badge-gray" style={{ fontSize: "0.6875rem" }}>{r.research_type}</span></td>
                  <td style={{ fontSize: "0.8125rem", color: "var(--dash-text)", maxWidth: 300 }}>{r.query}</td>
                  <td><span className={CONF_BADGE[r.confidence]}>{r.confidence}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {entries.length > 3 && (
          <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--dash-border)" }}>
            <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "var(--dash-accent)", fontSize: "0.8125rem", cursor: "pointer" }}>
              {expanded ? "Show less" : `Show all ${entries.length}`}
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

function IntelligenceContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("site_id") || "";

  const [sites, setSites] = useState<Site[]>([]);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [log, setLog] = useState<MarketResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeSiteId, setActiveSiteId] = useState(siteId);

  const load = async (sid: string) => {
    setLoading(true);
    const [sitesRes, profileRes, logRes] = await Promise.allSettled([
      api.sites(),
      sid ? api.intelligenceProfile(sid).catch(() => null) : Promise.resolve(null),
      sid ? api.intelligenceResearchLog(sid).catch(() => []) : Promise.resolve([]),
    ]);
    if (sitesRes.status === "fulfilled") {
      setSites(sitesRes.value);
      if (!sid && sitesRes.value[0]) {
        setActiveSiteId(sitesRes.value[0].id);
      }
    }
    if (profileRes.status === "fulfilled") setProfile(profileRes.value);
    if (logRes.status === "fulfilled") setLog(Array.isArray(logRes.value) ? logRes.value : []);
    setLoading(false);
  };

  useEffect(() => { load(activeSiteId); }, [activeSiteId]);

  const handleRefresh = async () => {
    if (!activeSiteId) return;
    setRefreshing(true);
    try {
      const updated = await refreshIntelligence(activeSiteId);
      setProfile(updated);
      const newLog = await api.intelligenceResearchLog(activeSiteId);
      setLog(Array.isArray(newLog) ? newLog : []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleResearchSuccess = () => {
    setShowForm(false);
    load(activeSiteId);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" as const }}>
        <div>
          <h1 className="page-title">Client Intelligence</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--dash-text-dim)", marginTop: "0.25rem" }}>
            Deep market research that informs every piece of content and strategy
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {sites.length > 1 && (
            <select
              value={activeSiteId}
              onChange={e => setActiveSiteId(e.target.value)}
              style={{ padding: "0.5rem 0.75rem", background: "var(--dash-surface)", border: "1px solid var(--dash-border)", borderRadius: "0.375rem", color: "var(--dash-text)", fontSize: "0.8125rem" }}
            >
              {sites.map(s => <option key={s.id} value={s.id}>{s.brand_name || s.domain}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ padding: "0.625rem 1.25rem", background: "var(--dash-accent)", color: "#000", border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer" }}
          >
            {showForm ? "Cancel" : "+ Run Research"}
          </button>
        </div>
      </div>

      {showForm && sites.length > 0 && (
        <ResearchForm sites={sites} onSuccess={handleResearchSuccess} />
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: "1rem" }}>
          {[...Array(3)].map((_, i) => <div key={i} className="dash-card skeleton" style={{ height: "8rem" }} />)}
        </div>
      ) : profile ? (
        <>
          <ProfileView profile={profile} onRefresh={handleRefresh} refreshing={refreshing} />
          <ResearchLog entries={log} />
        </>
      ) : (
        <div className="dash-card" style={{ textAlign: "center", padding: "4rem 1.5rem", color: "var(--dash-text-dim)" }}>
          <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>No client profile yet</p>
          <p style={{ fontSize: "0.75rem", color: "var(--dash-muted)" }}>Click "Run Research" to generate deep market intelligence for this client</p>
        </div>
      )}
    </div>
  );
}

export default function IntelligenceDashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--dash-text-dim)" }}>Loading…</div>}>
      <IntelligenceContent />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/lucaskay/Desktop/cerebro/apps/web
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors (or only pre-existing ones not in the modified files).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/dashboard/intelligence/page.tsx
git commit -m "feat: rebuild intelligence dashboard with client profile, competitors, content angles, research log"
```

---

## Task 7: Fix utm_campaign in Lead Capture

**Files:**
- Modify: `apps/api/app/schemas/leads.py`
- Modify: `apps/api/app/routers/leads.py`

This is a small bug fix. The `utm_campaign` field exists in `AttributionEvent` but is missing from `LeadCapture`.

- [ ] **Step 1: Add utm_campaign to LeadCapture schema**

In `apps/api/app/schemas/leads.py`, after `utm_content`:
```python
    utm_campaign: Optional[str] = None
```

- [ ] **Step 2: Add utm_campaign to insert dict in leads.py**

In `apps/api/app/routers/leads.py`, in the `db.insert("leads", {...})` call, after `"utm_content": lead.utm_content`:
```python
            "utm_campaign": lead.utm_campaign,
```

- [ ] **Step 3: Verify no syntax errors**

```bash
cd /Users/lucaskay/Desktop/cerebro
python -c "
import sys; sys.path.insert(0, '.')
from apps.api.app.routers.leads import router
from apps.api.app.schemas.leads import LeadCapture
import inspect
fields = LeadCapture.model_fields
print('utm_campaign in schema:', 'utm_campaign' in fields)
"
```
Expected: `utm_campaign in schema: True`

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/schemas/leads.py apps/api/app/routers/leads.py
git commit -m "fix: add missing utm_campaign to LeadCapture schema and insert dict"
```

---

## Task 8: Attribution Chain Endpoint

**Files:**
- Modify: `apps/api/app/routers/attribution.py`

The existing `/api/reports/revenue-by-asset` joins leads → outcomes but loses asset title and UTM data. The new `attribution-chain` endpoint enriches it with content_assets metadata and per-CTA/UTM breakdowns.

- [ ] **Step 1: Add the attribution-chain endpoint**

In `apps/api/app/routers/attribution.py`, add after `revenue_by_asset`:

```python
@router.get("/api/reports/attribution-chain")
async def attribution_chain(site_id: Optional[str] = None, days: int = 30):
    """
    Full attribution chain: asset → leads → qualified → accepted → revenue.
    Joins content_assets + leads + lead_outcomes.
    """
    from datetime import date, timedelta
    since = (date.today() - timedelta(days=days)).isoformat()

    # Get leads with site/date filter
    leads_params = {
        "select": "id,asset_id,site_id,current_status,cta_variant,utm_source",
        "created_at": f"gte.{since}T00:00:00Z",
    }
    if site_id:
        leads_params["site_id"] = f"eq.{site_id}"
    leads = await db.query("leads", params=leads_params)

    if not leads:
        return []

    # Get accepted outcomes for revenue
    all_lead_ids = [l["id"] for l in leads]
    outcomes = await db.query("lead_outcomes", params={
        "select": "lead_id,revenue_value,status",
        "status": "eq.accepted",
    })
    revenue_by_lead = {o["lead_id"]: float(o.get("revenue_value") or 0) for o in outcomes}

    # Get content_assets titles
    asset_ids = list({l["asset_id"] for l in leads if l.get("asset_id")})
    assets_map: dict = {}
    if asset_ids:
        # PostgREST `in.()` filter syntax: `id=in.(uuid1,uuid2,...)`
        # The db.query() method passes params as URL query params, so this works.
        ids_str = ",".join(asset_ids)
        asset_rows = await db.query("content_assets", params={
            "select": "id,title,keyword",
            "id": f"in.({ids_str})",
        })
        assets_map = {a["id"]: a for a in asset_rows}

    # Aggregate per asset
    agg: dict = {}
    for lead in leads:
        aid = lead.get("asset_id") or "unknown"
        if aid not in agg:
            asset = assets_map.get(aid, {})
            agg[aid] = {
                "asset_id": aid,
                "asset_title": asset.get("title", "Unknown"),
                "asset_keyword": asset.get("keyword", ""),
                "leads_generated": 0,
                "leads_qualified": 0,
                "leads_accepted": 0,
                "revenue": 0.0,
                "_cta_counts": {},
                "_utm_counts": {},
            }

        agg[aid]["leads_generated"] += 1

        status = lead.get("current_status", "")
        if status in ("qualified", "delivered", "accepted", "closed"):
            agg[aid]["leads_qualified"] += 1
        if status == "accepted":
            agg[aid]["leads_accepted"] += 1
            agg[aid]["revenue"] += revenue_by_lead.get(lead["id"], 0)

        # Track CTA/UTM for top variant
        cta = lead.get("cta_variant") or "unknown"
        utm = lead.get("utm_source") or "direct"
        agg[aid]["_cta_counts"][cta] = agg[aid]["_cta_counts"].get(cta, 0) + 1
        agg[aid]["_utm_counts"][utm] = agg[aid]["_utm_counts"].get(utm, 0) + 1

    # Clean up and sort
    result = []
    for row in agg.values():
        cta_counts = row.pop("_cta_counts")
        utm_counts = row.pop("_utm_counts")
        row["top_cta_variant"] = max(cta_counts, key=cta_counts.get) if cta_counts else None
        row["top_utm_source"] = max(utm_counts, key=utm_counts.get) if utm_counts else None
        row["revenue"] = round(row["revenue"], 2)
        result.append(row)

    return sorted(result, key=lambda x: x["leads_generated"], reverse=True)
```

- [ ] **Step 2: Verify it imports**

```bash
cd /Users/lucaskay/Desktop/cerebro
python -c "
import sys; sys.path.insert(0, '.')
from apps.api.app.routers.attribution import router
paths = [r.path for r in router.routes]
print('attribution-chain in routes:', any('attribution-chain' in p for p in paths))
"
```
Expected: `attribution-chain in routes: True`

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/routers/attribution.py
git commit -m "feat: add attribution-chain endpoint joining assets, leads, and outcomes with CTA/UTM breakdown"
```

---

## Task 9: Attribution Dashboard Update

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app/dashboard/attribution/page.tsx`

- [ ] **Step 1: Add AttributionChain type and api method to api.ts**

After `RevenueByAsset` interface, add:
```typescript
export interface AttributionChain {
  asset_id: string;
  asset_title: string;
  asset_keyword: string;
  leads_generated: number;
  leads_qualified: number;
  leads_accepted: number;
  revenue: number;
  top_cta_variant: string | null;
  top_utm_source: string | null;
}
```

In the `api` object, add after `revenueByAsset`:
```typescript
  attributionChain: (days = 30, siteId?: string) =>
    fetchAPI<AttributionChain[]>(`/api/reports/attribution-chain?days=${days}${siteId ? `&site_id=${siteId}` : ""}`),
```

- [ ] **Step 2: Add "Revenue by Asset" table to attribution/page.tsx**

Note: `NoData` component and `trunc()` helper already exist in this file. `AttributionChain` type is defined in api.ts (Task 9 Step 1). Read the full file first to find the exact insertion point, then:

1. Add `AttributionChain` to the import line:
   ```typescript
   import type { Funnel, LeadsByAsset, LeadsByBrand, AttributionChain } from "@/lib/api";
   ```

2. Add state: `const [chain, setChain] = useState<AttributionChain[] | null>(null);`

3. In `useEffect`, add `api.attributionChain(days, siteId)` to `Promise.allSettled` and set the result.

4. Add a new section after the existing tables:

```tsx
{/* Attribution Chain */}
<section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
  <h2 className="section-title">Revenue by Asset</h2>
  {loading ? (
    <div className="dash-card skeleton" style={{ height: "8rem" }} />
  ) : !chain?.length ? (
    <NoData />
  ) : (
    <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Article</th>
              <th style={{ textAlign: "right" }}>Leads</th>
              <th style={{ textAlign: "right" }}>Qualified</th>
              <th style={{ textAlign: "right" }}>Accepted</th>
              <th style={{ textAlign: "right" }}>Revenue</th>
              <th>Top CTA</th>
              <th>Top Source</th>
            </tr>
          </thead>
          <tbody>
            {chain.slice(0, 15).map((row) => (
              <tr key={row.asset_id}>
                <td>
                  <span style={{ fontSize: "0.8125rem", color: "var(--dash-text)", fontWeight: 500 }}>
                    {trunc(row.asset_title, 45)}
                  </span>
                  {row.asset_keyword && (
                    <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--dash-text-dim)" }}>
                      {row.asset_keyword}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="mono">{row.leads_generated}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="mono" style={{ color: "#f59e0b" }}>{row.leads_qualified}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="mono" style={{ color: "var(--dash-accent)" }}>{row.leads_accepted}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="mono" style={{ fontWeight: 600, color: row.revenue > 0 ? "var(--dash-accent)" : "var(--dash-text-dim)" }}>
                    {row.revenue > 0 ? `$${row.revenue.toFixed(0)}` : "—"}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                    {row.top_cta_variant || "—"}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: "0.75rem", color: "var(--dash-text-dim)" }}>
                    {row.top_utm_source || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )}
</section>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/lucaskay/Desktop/cerebro/apps/web
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/dashboard/attribution/page.tsx
git commit -m "feat: add attribution chain table to dashboard showing revenue per content asset"
```

---

## Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Client Intelligence Layer section to CLAUDE.md**

After the `## New Architecture: Skills + Strategy Loop` section, add:

```markdown
## Client Intelligence Layer

CEREBRO maintains a living memory of each client's business and market.

When a new client is onboarded:
1. Operator provides: company name, country, industry, website
2. System runs deep market research automatically via POST /api/intelligence/research
3. Research is stored in client_profiles and market_research tables
4. ALL content generation uses client intelligence (never generic)
5. ALL strategy decisions use client intelligence
6. Research can be refreshed anytime via POST /api/intelligence/refresh/{site_id}

The system NEVER generates generic marketing content.
Every piece of content must be informed by:
- Client's value proposition and differentiators
- Target audience pain points and desires
- Competitor landscape and positioning gaps
- Market trends and buying triggers

If no client_profile exists for a site, the system warns the operator
and uses minimal brand context from domain_sites as fallback.

Key module: `packages/intelligence/__init__.py` — ClientIntelligence class
Key method: `get_content_context(site_id)` — injected into ALL content prompts
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document Client Intelligence Layer in CLAUDE.md"
```

---

## Task 11: Deploy

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Verify Railway deploy succeeds**

Check Railway dashboard or use `railway status`. Watch for import errors on startup.

- [ ] **Step 3: Test intelligence endpoint**

Replace `YOUR_KEY` and `SITE_ID` with real values from the system:
```bash
# First get site ID
curl -H "X-API-Key: YOUR_KEY" https://web-production-c6ed5.up.railway.app/api/sites

# Then run research
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  https://web-production-c6ed5.up.railway.app/api/intelligence/research \
  -d '{"site_id": "SITE_ID", "company": "ikigii", "country": "Colombia", "industry": "fintech wealth management"}'
```
Expected: JSON object with `pain_points`, `competitors`, `content_angles`, etc.

- [ ] **Step 4: Test attribution chain**

```bash
curl -H "X-API-Key: YOUR_KEY" \
  "https://web-production-c6ed5.up.railway.app/api/reports/attribution-chain?days=30"
```
Expected: JSON array (may be empty if no leads with assets yet).

---

## Summary

| Task | Scope | Risk |
|------|-------|------|
| 1 — Migration | New tables, no existing data impact | Low |
| 2 — Intelligence module | New file | Low |
| 3 — Intelligence router | New file + main.py registration | Low |
| 4 — Pipeline integration | Additive `{client_intelligence}` placeholder | Low — empty string if no profile |
| 5 — Strategy integration | Additive context injection | Low — empty string if no profile |
| 6 — Dashboard page | Full page rewrite (was loop/knowledge, now intelligence) | Medium — verify TSC |
| 7 — utm_campaign fix | Schema + insert bug fix | Low |
| 8 — Attribution chain | New endpoint, no DB writes | Low |
| 9 — Attribution dashboard | Additive table section | Low |
| 10 — CLAUDE.md | Docs | None |
| 11 — Deploy | Push + smoke test | Low |

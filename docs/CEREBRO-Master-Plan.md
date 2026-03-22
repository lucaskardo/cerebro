# CEREBRO — Master Plan
## Everything We've Built, Decided, and Where We're Going
### Sessions 1-7 Complete Summary · March 2026

---

## THE MISSION

CEREBRO is a Business Intelligence engine for solopreneurs selling online. It's NOT a content tool, chatbot, or CRM. It's the intelligence layer that makes ALL tools smarter.

A solopreneur with CEREBRO has the equivalent of a board of top managers — marketing director, sales director, product director, market researcher — all looking at the same data, giving actionable recommendations. The human makes the final decision.

**North Star:** "No publica lo que leyó. Publica lo que entendió."

**First customer:** NauralSleep (mattress brand in Panama). First tool being tested: content generation for ColchonesPanama.com.

---

## THE VISION

CEREBRO feeds ALL tools with intelligence from crossing data layers:
- Content generation
- WhatsApp scripts/responses
- Social media
- Email campaigns
- Quiz logic
- Sales decisions

Each tool CONSUMES intelligence AND PRODUCES data back. Content is the FIRST tool being tested.

**The proprietary value:** Cross-layer intelligence. No competitor can replicate it because it requires YOUR business data crossed with domain knowledge, audience data, and local market context.

**Analogy:** "Like having a board of top managers advising a solopreneur."

---

## 7 IMMUTABLE PRINCIPLES

1. **Validate before scale** — Test 10 facts before crawling 300. Test 2 articles before generating 20.
2. **User knows more than LLM** — User corrections = confidence 1.0, always override LLM.
3. **Intelligence = crossing data layers** — No tool does this. It's CEREBRO's differentiator.
4. **Audience language wins** over expert language. Always translate.
5. **Local data wins** over global for local topics.
6. **Ship before optimize** — Working output with 80% quality > perfect architecture with 0 output.
7. **Complexity must earn its place** — Every component must justify itself with measurable benefit.

## 4 LAWS (Non-Negotiable)

1. Crawl without distillation = organized noise
2. Graph without correlation = expensive screensaver
3. Feedback without upstream correction = patch, not cure
4. Facts and editorial text must never be mixed

---

## THE 4-LAYER ENGINE

```
Sources (raw data) 
    ↓
┌─────────────────────────────────────────┐
│            CEREBRO ENGINE               │
│                                         │
│  Layer 1: EXTRACTION                    │
│  Raw sources → tagged claims            │
│                                         │
│  Layer 2: DISTILLATION                  │
│  4,000 claims → 400 verified facts      │
│                                         │
│  Layer 3: CORRELATION                   │
│  Cross 9 layers → new intelligence      │
│                                         │
│  Layer 4: DECISION PRODUCTS             │
│  Intelligence → concrete actions        │
│                                         │
└─────────────────────────────────────────┘
    ↓
Tools (content, WhatsApp, social, email, quiz, sales)
    ↓
Outcomes → feed back into Sources
```

### Layer 1: Extraction
Extract EVERYTHING from sources, filter nothing. 5 types per source:
1. Universal principles/science
2. Testing methodology
3. Feature evaluations (real vs hype)
4. Brand-specific data (tagged with entity)
5. Craft patterns (how pros write/structure content)

### Layer 2: Distillation
Runs AFTER extraction. Dedup → Contradict → Consensus → Gap detection → Pattern → Promote.

### Layer 3: Correlation (Multi-Agent)
Board of advisors pattern: 5-6 specialist agents each analyze, synthesis agent combines. Output = recommendation + reasoning + confidence + dissenting opinions.

### Layer 4: Decision Products
Packages intelligence into concrete actions per tool. If a correlation doesn't produce a concrete action, it's not done processing.

---

## 9 DATA LAYERS

| # | Layer | Source | Status |
|---|-------|--------|--------|
| 1 | Domain knowledge | Authority sites (SleepFoundation, NapLab) | 80 facts ✓ |
| 2 | Audience | WhatsApp history, quiz, search data | Designed, not populated |
| 3 | Competitor intel | Competitor sites (Simmons, Serta, Indufoam) | Basic entities ✓ |
| 4 | Own product | User input (cold start) | Basic specs ✓ |
| 5 | Local market | Panama prices, stores, financing, delivery | Basic ✓ |
| 6 | Financial context | Income ranges, financing, payment methods, quincena | Not populated |
| 7 | Purchase journey | Triggers, decision makers, timeline, closers | Not populated |
| 8 | Social proof | Review patterns, testimonial themes, referral behavior | Not populated |
| 9 | Adjacent products | Pillows, bases, protectors, sheets | Not populated |

WhatsApp 5-year history = immediate audience data source (fills layers 2, 6, 7 without waiting for web traffic).

---

## 6 SPECIALIST AGENTS (Living .md Playbooks)

Each agent has a markdown playbook stored in DB:
- What I know / What I don't know / Active hypotheses / Rules I follow / Investigation queue

### The agents:
1. **Domain Expert** — science, materials, construction, health/sleep
2. **Audience Analyst** — vocabulary, objections, triggers, journey, misconceptions
3. **Competitor Strategist** — pricing, gaps, positioning, messaging
4. **Product Specialist** — specs, strengths, weaknesses, differentiation
5. **Market Analyst** — Panama prices, financing, delivery, seasonal patterns
6. **Content Craft Agent** — writing style, narrative structure, voice rules

### The Craft Agent (3 layers):
- **Playbook** (.md in DB) — full craft knowledge, too long for every prompt, the reference
- **Rules** (content_rules table) — concise instructions derived FROM playbook, ALL injected into prompt
- **Feedback loop** — founder reviews + article performance → playbook updates → rules refined

### Learning loop:
1. CEREBRO correlates across layers
2. Updates each agent's .md
3. Agents research using their intelligence
4. Return new claims to extraction
5. CEREBRO distills + correlates again
6. Cycle repeats

---

## TECH STACK & INFRASTRUCTURE

### Repo Structure (monorepo, enforced boundary)
```
cerebro-main/
├── apps/api/                    ← CEREBRO backend (FastAPI, Railway)
├── apps/web/                    ← CEREBRO dashboard (Next.js, Vercel)
├── apps/sites/
│   └── colchones-panama/        ← Authority site (Next.js, Vercel)
├── packages/intelligence/       ← Extraction, distillation, correlation
├── packages/content/            ← Content generation pipeline
├── packages/ai/prompts/         ← All LLM prompts
└── docs/
    ├── CEREBRO-Architecture.md  ← Single source of truth
    └── CEREBRO-Content-Style.md ← Craft Agent playbook
```

**Rule:** Sites in apps/sites/ ONLY call CEREBRO through API. Never import packages directly.

### Key URLs
- API: https://web-production-c6ed5.up.railway.app
- Dashboard: https://web-ten-woad-99.vercel.app
- Site: https://colchonespanama.com
- NauralSleep site_id: d3920d22-2c34-40b1-9e8e-59142af08e2a
- Supabase: dcnzgifhjezkeqvlkqne
- Mission ID: 55d459fd-33d3-4be4-94a8-cc7143876da5

### DB State
- 31 migrations applied, 34/34 tests passing
- 497 facts (80 authority_claim from SleepFoundation, 417 atomic_market)
- 10 content rules (7 new style + 3 original feedback)
- Prompt versions stored in DB table prompt_versions

### Tool Policy
| Tool | Status |
|------|--------|
| Cognee | AFTER Phase 4 (500+ facts + audience data) |
| Firecrawl | NOT approved (httpx sufficient) |
| CrewAI / AutoGen | NOT approved (structured multi-call sufficient) |
| Neo4j / pgvector | NOT approved (PostgreSQL sufficient) |

---

## COLCHONESPANAMA.COM

**Concept:** Panama's #1 independent mattress authority. NOT a store. Educational site that reviews, compares, recommends. NauralSleep appears as recommended brand through data-driven rankings.

**Design:** Deep indigo (#2D3561) + lavender (#8B7FB5) + gold (#C8A96E) + cream (#F5F0EB). Source Serif 4 + DM Sans.

**Sections:** Hero → Credibility bar → Guides grid → Quiz banner → Methodology → Rankings with score rings → Comparison table → Newsletter → Footer

**Status:** Redesigned and deployed (session 7). All content from CEREBRO API.

---

## CONTENT PIPELINE (Current State + Problem)

### Current 6-step pipeline:
1. Research keyword (Haiku)
2. Generate brief with sections/key_points (Haiku)
3. Research sources (Haiku)
4. **Generate draft (Sonnet, 8192 tokens)**
5. **Humanize (Haiku, 8192 tokens)** ← PROBABLE ROOT CAUSE
6. Score (Haiku, 5 dimensions)

### Post-processing:
- anti_words filter (banned phrase replacements + removals)
- Markdown → HTML conversion
- UTM link injection
- Quality validation

### What works:
- 10 rules injected (⛔ PROHIBIDO format for negatives, SÍ HACER for positives)
- Banned phrase filter catches "te lo digo claro", "dormidores", etc.
- Score reaches 100.0 after filter

### What's broken:
- Output still feels robotic, disorganized, not human
- Haiku "humanize" step likely DEGRADES Sonnet's draft
- Prompts live in packages/ai/prompts/content_prompts.py (not yet inspected)
- No examples of good writing in the prompts
- No outline step (brief is not the same as narrative outline)

### Session 8 plan:
1. Inspect content_prompts.py (the actual prompts sent to LLM)
2. Diagnose exactly where quality breaks
3. Design complete solution (likely: improve draft prompt, kill or upgrade humanize)
4. Validate with founder before implementing
5. Cost is not an issue (~$0.15/article, $9.72 credits available)

---

## CONTENT STYLE RULES (7 rules created session 7)

1. **voice.natural-vocabulary** (0.95, negative) — PROHIBIDO: dormidores, dolor matutino, superficie de descanso, etc.
2. **voice.no-clickbait** (0.95, negative) — PROHIBIDO: te lo digo claro, la verdad que nadie te cuenta, etc.
3. **structure.narrative-arc** (0.95, positive) — 4 fases: conexión → diagnóstico → solución → acción
4. **structure.data-in-narrative** (0.9, positive) — datos con 3 capas: por qué importa → qué significa → analogía
5. **structure.transitions** (0.85, positive) — secciones conectadas, no enciclopedia
6. **context.panama-relevance** (0.85, positive) — humedad 80%, financiamiento, clima, tiendas locales
7. **voice.segment-by-person** (0.8, positive) — segmentar por peso + posición de sueño

---

## PEER REVIEW PROCESS

AI peer reviews are INPUT, not decisions. The architect evaluates peer input against deep CEREBRO context (Manifesto, 7 principles, 4 laws, founder vision, market reality).

Logic: "They raised X point — does it make sense with everything I know?" Value: blind spots illuminated, not consensus.

---

## ROADMAP (Hard Gates)

### Phase A: Fix content quality ← CURRENT (partially done)
- ✅ 7 content rules deployed
- ✅ Rule selector fixed (10 rules, no cap)
- ✅ Banned phrase filter working
- ✅ API key fixed
- ❌ Content still not human-quality → Session 8 fix
- **GATE:** 1 article founder says "publish this"

### Phase B: Publish first 8 articles (after Phase A gate)
- Generate 8 Tier 1 articles with proven pipeline
- Founder reviews each → feedback refines rules
- Publish to ColchonesPanama.com → Google Search Console
- **GATE:** 8 articles live + indexed

### Phase C: Expand knowledge base (Week 2)
- Domain crawler (sitemap + batch ingestion)
- "Extract everything" approach (5 types per article)
- Crawl SleepFoundation (50 articles), aspirational brands, competitors
- Build distillation engine
- **GATE:** 500+ facts from multiple sources

### Phase D: Multi-agent intelligence (Week 3)
- Board of advisors (5 specialists + synthesis)
- Living agent .md playbooks
- Process 200+ WhatsApp conversations
- First cross-layer correlations
- **GATE:** Business decision with data from 5+ layers

### Phase E: Scale + second tool (Week 4+)
- 20+ articles, agent learning loop
- Dashboard engine visualization
- Connect second tool (WhatsApp or quiz)
- **GATE:** 2 tools fed by same intelligence, measurable improvement

---

## WHAT WAS BUILT (Sessions 1-7)

### Infrastructure
- FastAPI backend on Railway (34/34 tests passing)
- Next.js dashboard on Vercel
- ColchonesPanama.com redesigned + deployed
- Supabase PostgreSQL with 31 migrations
- Google Search Console configured

### Intelligence Layer
- Knowledge engine with authority source ingestion
- 497 facts in DB (80 authority, 417 market)
- Intelligence rules system
- Content generation pipeline (6-step)
- Quality scoring (5 dimensions)
- Feedback loop design

### Content System
- 10 content rules (style + feedback)
- Anti-words filter with smart replacements
- Article generation, preview, approval flow
- Lead capture forms
- Quiz system

### Documents
- CEREBRO-Architecture.md (in repo, referenced from CLAUDE.md)
- CEREBRO-Manifesto.md
- CEREBRO-Content-Style.md
- CEREBRO-AI-Peer-Review-Template.md

---

## ANTI-PATTERNS (What NOT to do)

- DO NOT flip-flop on architecture without new evidence
- DO NOT add tools before proving current approach works
- DO NOT crawl 300 pages before verifying 10 extractions
- DO NOT build multi-agent before single-agent content works
- DO NOT design systems without shipping output
- DO NOT let peer review consensus override deep context
- DO NOT mix facts with editorial text
- DO NOT filter during extraction — extract everything, distill after
- DO NOT patch symptoms without diagnosing root cause (learned session 7)
- DO NOT give solutions without investigating first (learned session 7)

---

## IMMEDIATE NEXT STEP

**Session 8:** Fix content pipeline quality.
- Inspect packages/ai/prompts/content_prompts.py
- Diagnose where quality breaks (likely humanize step)
- Design complete solution
- Validate with founder
- Implement and test
- Get 1 article approved for publication → Phase A gate closed

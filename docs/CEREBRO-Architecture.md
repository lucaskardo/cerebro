# CEREBRO Architecture — Single Source of Truth
## Version 2.0 · Updated 2026-03-22 · Sessions 1-7

> "No publica lo que leyó. Publica lo que entendió."

---

## What CEREBRO Is

A Business Intelligence engine for solopreneurs selling online. NOT a content tool, NOT a chatbot, NOT a CRM. The intelligence layer that makes ALL tools smarter.

A solopreneur with CEREBRO has the equivalent of a board of top managers — marketing director, sales director, product director, market researcher — all looking at the same data, giving actionable recommendations. The human makes the final decision.

The proprietary value is the cross-layer intelligence, not any individual tool. No competitor can replicate it because it requires YOUR business data crossed with domain knowledge, audience data, and local market context.

---

## 7 Immutable Principles

1. **Validate before scale** — Test 10 facts before crawling 300. Test 2 articles before generating 20.
2. **User knows more than LLM** — User corrections = confidence 1.0, always override LLM.
3. **Intelligence = crossing data layers** — No tool does this. It's CEREBRO's differentiator.
4. **Audience language wins** over expert language. Always translate.
5. **Local data wins** over global for local topics.
6. **Ship before optimize** — Working output with 80% quality > perfect architecture with 0 output.
7. **Complexity must earn its place** — Every component must justify itself with measurable benefit.

## 4 Laws (Non-Negotiable)

1. Crawl without distillation = organized noise
2. Graph without correlation = expensive screensaver
3. Feedback without upstream correction = patch, not cure
4. Facts and editorial text must never be mixed

---

## The 4-Layer Engine

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
│  Storage: intelligence_facts +          │
│           intelligence_rules +          │
│           agent_playbooks (PostgreSQL)  │
└─────────────────────────────────────────┘
    ↓
Tools (content, WhatsApp, social, email, quiz, sales)
    ↓
Outcomes → feed back into Sources
```

### Layer 1: Extraction

Turns every raw source into tagged claims. Extracts EVERYTHING, filters nothing.

**5 extraction types per source:**
1. Universal principles — science that applies to any brand
2. Testing methodology — how professionals evaluate, what they measure, scales, thresholds
3. Feature evaluations — what's real vs hype, under what conditions (copper, graphene, micro coils, certifications)
4. Brand-specific data — tagged with entity, for competitive intelligence
5. Craft patterns — how professional sites write, structure content, present data

**Source types with extraction modes:**
- Authority articles (SleepFoundation, NapLab) → all 5 types
- Competitor sites (simmons.com.pa, serta.com.pa) → pricing, claims, warranty fine print, content gaps
- WhatsApp conversations → vocabulary, objections, triggers, what closes sales, journey stages, misconceptions
- Quiz/analytics → search terms, drop-off points, segment patterns
- User input (cold start) → product specs, differentiators, weaknesses. Confidence 1.0
- Aspirational brands (Purple, Casper, Helix, Tempur-Pedic) → positioning, value props, content approach, conversion techniques
- Outcomes (sale results, promo results, article performance) → confidence 1.0

### Layer 2: Distillation

Runs AFTER extraction. Groups claims, finds patterns, eliminates noise.

**6 operations:**
1. Dedup — 40 claims say same thing → 1 fact, confidence 0.95, citing all sources
2. Contradict — conflicting claims → both kept, flagged, condition added
3. Consensus — 5+ sources agree → promoted to trusted fact
4. Gap detection — lots of claims about X, almost none about Y → research opportunity
5. Pattern — aggregate individual data points into statistical facts
6. Promote — claims passing consensus + evidence + relevance → canonical facts

### Layer 3: Correlation (Multi-Agent)

This is where CEREBRO thinks. Crosses facts from different layers using specialist agents.

**The Board of Advisors pattern:**
- Orchestrator classifies the question → activates relevant specialists
- 5-6 specialist agents each analyze with their domain's facts
- Synthesis agent combines all perspectives → unified recommendation
- Output includes: recommendation + reasoning from each specialist + confidence + dissenting opinions

**Specialist agents (each with living .md playbook):**
1. Domain Expert — science, materials, construction, health/sleep
2. Audience Analyst — vocabulary, objections, triggers, journey, misconceptions
3. Competitor Strategist — pricing, gaps, positioning, messaging
4. Product Specialist — specs, strengths, weaknesses, differentiation
5. Market Analyst — Panama prices, financing, delivery, seasonal patterns
6. Content Craft Agent — writing style, narrative structure, voice rules (see below)

### Layer 4: Decision Products

Packages intelligence into concrete actions per tool.

**Per-tool outputs:**
- Content → article briefs, translation rules, CTA variants, content calendar
- WhatsApp → response scripts by objection, follow-up sequences, re-engagement
- Social → post topics, ad copy variants, comment templates
- Email → subject lines, segment content, send timing (quincena)
- Quiz → question logic, follow-up recommendations, lead scoring
- Business decisions → data-backed recommendations with reasoning from all layers

**Rule:** If a correlation doesn't produce a concrete action, it's not done processing.

---

## 9 Data Layers (Mental Datasets)

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

Layers 6-9 come primarily from user input (cold start) and WhatsApp history — not crawling.

---

## Agent System (Living .md Playbooks)

Each specialist agent has a markdown playbook stored in DB that contains:
- **What I know** — accumulated intelligence from past cycles
- **What I don't know** — gaps flagged for investigation
- **Active hypotheses** — things being tested
- **Rules I follow** — behavioral constraints
- **Investigation queue** — what to research next

**The learning loop:**
1. CEREBRO runs correlation across all layers
2. Updates each agent's .md with new intelligence + investigation tasks
3. Agents research using their intelligence (focused, not random)
4. Return new claims to extraction
5. CEREBRO distills + correlates again
6. All .md files updated → cycle repeats

**Key principle:** Agents get smarter MUTUALLY through CEREBRO. One agent's research triggers new investigation tasks for ALL other agents.

---

## The Content Craft Agent (Detail)

The Craft Agent manages how content is written. It has 3 layers:

### Playbook (.md in DB)
The full craft knowledge: voice, structure, data integration patterns, Panama context, craft patterns extracted from authority sites, quality gates. This is the "brain" — too long for every prompt but the reference that generates rules.

Updated by: founder feedback, craft extraction from authority sites, performance data.

### Rules (content_rules table)
Concise, actionable instructions derived FROM the playbook. 1-3 sentences each. ALL injected into generation prompt — no cap, no filtering.

Organized as:
- NEGATIVE rules (never do this): artificial vocabulary, clickbait phrases
- POSITIVE rules (always do this): narrative arc, data in context, transitions, Panama relevance, audience segmentation

Current rules: 10 (7 new style rules + 3 original feedback rules)

### Content Generation Pattern (writer + critic)
- Call 1 (Writer): gets playbook summary + ALL rules + knowledge facts → writes article
- Call 2 (Critic): gets playbook + draft → checks every rule, flags violations, checks narrative arc → returns corrections
- Writer rewrites with corrections → final output

Later evolution: 4-agent (writer + audience critic + domain validator + craft coach)

---

## Peer Review Process

AI peer reviews are INPUT, not decisions. The lead architect evaluates peer input against deep CEREBRO context (Manifesto, 7 principles, 4 laws, founder vision, market reality).

Logic is NOT "3 AIs agree so I agree too." Logic is "they raised X point — does it make sense with everything I know about CEREBRO?"

Value is in blind spots illuminated, not in consensus.

Template: CEREBRO-AI-Peer-Review-Template.md

---

## Tech Architecture

### Repo Structure (monorepo, enforced boundary)
```
cerebro-main/
├── apps/api/                    ← CEREBRO backend (FastAPI, Railway)
├── apps/web/                    ← CEREBRO dashboard (Next.js, Vercel)
├── apps/sites/
│   └── colchones-panama/        ← Authority site (Next.js, Vercel)
├── packages/intelligence/       ← Extraction, distillation, correlation
├── packages/content/            ← Content generation pipeline
└── docs/
    ├── CEREBRO-Manifesto.md
    ├── CEREBRO-Architecture.md  ← THIS DOCUMENT
    └── CEREBRO-Content-Style.md ← Craft Agent playbook
```

**Rule:** Sites in apps/sites/ ONLY call CEREBRO through the API. Never import packages directly. When a site grows enough, move to its own repo — same API.

### Stack
- Backend: Python/FastAPI on Railway
- DB: Supabase PostgreSQL (ALL data stays here)
- Dashboard: Next.js on Vercel
- Sites: Next.js on Vercel (independent deploys)
- LLMs: Haiku for extraction, Sonnet for generation
- No external tools approved until gate criteria met (see Tool Policy)

### Key Endpoints
- API: https://web-production-c6ed5.up.railway.app
- Dashboard: https://web-ten-woad-99.vercel.app
- Site: https://colchonespanama.com
- NauralSleep site_id: d3920d22-2c34-40b1-9e8e-59142af08e2a

---

## Tool Policy

| Tool | Status | Condition |
|------|--------|-----------|
| Cognee | Approved AFTER Phase 4 | 500+ verified facts + audience data |
| Firecrawl | NOT approved | httpx + sitemap parsing sufficient |
| react-force-graph | Approved now | For knowledge graph visualization |
| CrewAI / AutoGen | NOT approved | Structured multi-call patterns sufficient |
| Neo4j / pgvector | NOT approved | PostgreSQL sufficient for current scale |
| Custom domain crawler | Approved | No external dependency |

---

## Pipeline Entry Criteria (Hard Gate)

**ENTERS the pipeline:**
- Promoted facts (confidence >0.7)
- Authority claims with evidence_quote
- Local market facts
- Rules with strength >0.3

**NEVER ENTERS:**
- Quarantined claims
- Single-source without corroboration
- Unresolved contradictions
- Free-form feedback not normalized

---

## Current Roadmap

### Phase A: Fix content quality (NOW)
- Deploy 7 content rules → fix pipeline to use ALL rules
- Implement writer + critic (2-pass) pattern
- Iterate until founder says "publish this"
- GATE: 1 article approved for publication

### Phase B: Publish first 8 articles (This week)
- Generate 8 Tier 1 articles with proven rules + knowledge facts
- Founder reviews each → feedback refines rules
- Publish to ColchonesPanama.com → submit to Google Search Console
- GATE: 8 articles live + indexed

### Phase C: Expand knowledge base (Week 2)
- Build domain crawler (sitemap + batch ingestion)
- Implement "extract everything" approach (5 types per article)
- Crawl SleepFoundation (50 articles first)
- Build distillation engine (dedup, contradict, consensus, promote)
- Crawl aspirational brands (Purple, Casper, Helix, Tempur-Pedic)
- Crawl competitor sites (simmons.com.pa, serta.com.pa)
- Cold start expansion: product specs, purchase journey, financial context
- GATE: 500+ facts from multiple sources, distillation working

### Phase D: Multi-agent intelligence (Week 3)
- Implement board of advisors (5 specialists + synthesis)
- Create living agent .md playbooks (initial versions)
- Process 20 WhatsApp conversations (test extraction quality)
- Scale to 200+ WhatsApp conversations
- First cross-layer correlations with real data from 5+ layers
- Test: ask CEREBRO a business decision question
- GATE: CEREBRO produces business decision with data from 5+ layers

### Phase E: Scale + second tool (Week 4+)
- Generate 20+ articles using full intelligence
- Build agent learning loop (investigate → return → correlate → repeat)
- Dashboard: engine visualization (audit logic visually)
- Connect second tool (WhatsApp scripts OR quiz logic)
- 3D knowledge graph visualization
- Measure: article performance, quiz completion, close rate
- GATE: 2 tools fed by same intelligence layer, measurable improvement

---

## ColchonesPanama.com (Authority Site)

**Concept:** Panama's #1 independent mattress authority. NOT a store. Educational site that reviews, compares, recommends. Like SleepFoundation but for Panama.

**Design:** Deep indigo (#2D3561) + lavender (#8B7FB5) + warm gold (#C8A96E) + cream (#F5F0EB). Source Serif 4 headings + DM Sans body.

**Sections:** Hero with trust badges → Credibility bar → Guides grid → Quiz banner → Methodology → Rankings with scores → Comparison table → Newsletter → Footer

**Content:** All content comes from CEREBRO. Articles, rankings, comparisons, quiz logic — all driven by the intelligence layer. The site is a rendering surface for CEREBRO's output.

**NauralSleep appears as a recommended brand** within rankings and comparisons — not as the owner. Including competitors (Simmons, Serta) with real scores builds the credibility that makes NauralSleep's recommendation believable.

---

## Anti-Patterns (What NOT to do)

- DO NOT flip-flop on architecture decisions without new evidence
- DO NOT add tools before proving current approach works
- DO NOT crawl 300 pages before verifying 10 extractions work
- DO NOT build multi-agent before single-agent content works
- DO NOT design systems without shipping output
- DO NOT let peer review consensus override deep CEREBRO context
- DO NOT mix facts with editorial text in the same data structure
- DO NOT filter during extraction — extract everything, distill after

---

## Change Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-20 | Initial architecture | Sessions 1-3 |
| 2026-03-21 | Manifesto created, 7 principles locked | Session 6 |
| 2026-03-22 | BI engine vision, multi-agent design, 9 data layers, Craft Agent, living .md playbooks, peer review process, repo structure decision | Session 7 |

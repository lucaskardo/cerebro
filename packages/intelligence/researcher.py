"""
CEREBRO — Web Research Engine with 6-Gate Quality System
Gates: Source Trust → Geo Validation → Composite Score → Contradiction → Schema → Human Review
"""
import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from packages.core import db, get_logger
from packages.ai import complete

logger = get_logger("intelligence.researcher")

# ── Config ────────────────────────────────────────────────────────────────────
MAX_SEARCH_RESULTS = 5
MAX_PAGE_CHARS = 4000
MAX_PAGES_PER_QUERY = 3
SEARCH_DELAY_SEC = 1.5
PAGE_TIMEOUT_SEC = 10

TRUST_THRESHOLD = 0.6
QUARANTINE_THRESHOLD = 0.3
MIN_VALUE_LENGTH = 5

# Only block truly irrelevant domains (wrong language/market entirely)
BLOCKED_DOMAINS = {
    "baidu.com", "weibo.com", "qq.com", "sogou.com",
    "yandex.ru", "mail.ru", "vk.com",
}

VALID_CATEGORIES = {
    "pricing", "positioning", "audience", "competitor", "content",
    "product", "market", "performance", "objection", "trigger",
    "differentiator", "other",
}

CATEGORY_MAP = {
    "store": "market", "brand": "competitor", "information": "other",
    "features": "product", "feature": "product", "segment": "audience",
    "persona": "audience", "pain": "objection", "price": "pricing",
    "location": "market", "distribution": "market", "weakness": "competitor",
    "general": "other", "trend": "market", "review": "audience",
}


# ══════════════════════════════════════════════════════════════════════════════
# GATE 1: Source Trust Scoring
# ══════════════════════════════════════════════════════════════════════════════

KNOWN_DOMAINS = {
    # OFFICIAL BRAND SITES (first-party data = highest trust)
    "simmons.com.pa": 0.95,
    "serta.com.pa": 0.95,
    "indufoam.com": 0.9,

    # SPECIALTY MATTRESS STORES (real inventory + prices)
    "sleepshoppanama.com": 0.9,
    "doncolchon.com.pa": 0.9,
    "dormicenterpanama.com": 0.9,

    # RETAIL CHAINS (real products + prices)
    "rodelag.com": 0.85,
    "doitcenter.com.pa": 0.85,
    "novey.com": 0.85,
    "jamar.com.pa": 0.85,
    "unicapanama.com": 0.85,
    "eltitan.com.pa": 0.85,
    "multimax.net": 0.8,

    # SOCIAL MEDIA (business profiles have promotions, prices, locations)
    "instagram.com": 0.7,
    "facebook.com": 0.4,
    "tiktok.com": 0.3,
    "twitter.com": 0.3,
    "x.com": 0.3,
    "linkedin.com": 0.3,

    # PANAMA NEWS
    "panamaamerica.com.pa": 0.7,
    "prensa.com": 0.7,
    "laestrella.com.pa": 0.7,

    # SECOND-HAND MARKETPLACES (low trust — used items, distorted prices)
    "encuentra24.com": 0.2,
    "mercadolibre.com.pa": 0.2,
    "olx.com.pa": 0.2,

    # LOW QUALITY
    "pinterest.com": 0.15,
    "reddit.com": 0.2,
}

# Industry keywords — Spanish with plurals + related terms
INDUSTRY_KEYWORDS = {
    "colchon", "colchones",
    "cama", "camas",
    "dormir", "descanso",
    "mattress", "sleep",
    "sommier", "box-spring", "boxspring",
    "almohada", "almohadas",
    "mueble", "muebles",
    "hogar",
}

DOMAIN_TRUST_RULES = [
    (lambda d: d.endswith(".pa"), 0.8),
    (lambda d: "panama" in d or "panamá" in d, 0.7),
    (lambda d: any(kw in d for kw in INDUSTRY_KEYWORDS), 0.7),
    (lambda d: d.endswith(".com") and len(d.split(".")) <= 2, 0.45),
    (lambda d: any(x in d for x in ["blog", "forum", "wiki", "answer"]), 0.25),
]


def score_source(url: str) -> float:
    """Gate 1: Score URL trustworthiness."""
    try:
        domain = urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return 0.1

    if domain in BLOCKED_DOMAINS:
        return 0.0

    if domain in KNOWN_DOMAINS:
        return KNOWN_DOMAINS[domain]

    for known, score in KNOWN_DOMAINS.items():
        if domain.endswith("." + known):
            return score

    for rule_fn, score in DOMAIN_TRUST_RULES:
        if rule_fn(domain):
            return score

    return 0.35


# ══════════════════════════════════════════════════════════════════════════════
# GATE 2: Geographic Validation (in Haiku prompt)
# ══════════════════════════════════════════════════════════════════════════════

EXTRACTION_SYSTEM = """You are a market research analyst extracting STRUCTURED FACTS from web content.
You are analyzing the {country} market for a specific industry.

CRITICAL RULES:
1. ONLY extract facts about entities confirmed to operate in {country}. If the content is about a company in Mexico, Colombia, Italy, USA, or any other country with NO mention of {country}, return [].
2. Each fact MUST include "evidence_quote" — the exact phrase (max 100 chars) from the content that supports it.
3. Each fact MUST include "country_confirmed" — true ONLY if content explicitly mentions {country}, cities in {country}, or uses a .{tld} domain.
4. Each fact MUST include "recency_year" — the year this info is from. Use null if no date found.
5. Only extract EXPLICITLY stated facts. Never infer or guess.
6. fact_key format: {{category}}.{{entity-slug}}.{{metric}} — lowercase, hyphens for spaces.
7. Confidence: 1.0 = stated with source, 0.8 = clearly stated, 0.5 = vaguely mentioned.

VALID CATEGORIES: pricing, positioning, audience, competitor, content, product, market, performance, objection, trigger, differentiator

Respond ONLY with a JSON array. No markdown, no explanation."""

EXTRACTION_PROMPT = """RESEARCH QUERY: {query}
ENTITY: {entity_name} ({entity_type})
TARGET COUNTRY: {country}
SOURCE URL: {url}

PAGE CONTENT:
{content}

Extract all {country}-relevant facts as JSON array. Each fact:
{{"category": "...", "fact_key": "...", "value_text": "..." OR "value_number": 123, "confidence": 0.8, "evidence_quote": "exact text from page", "country_confirmed": true/false, "recency_year": 2025}}

If content is NOT about {country} or has no relevant facts, return: []"""


# ══════════════════════════════════════════════════════════════════════════════
# GATE 3: Composite Confidence Score
# ══════════════════════════════════════════════════════════════════════════════

def compute_composite_score(haiku_confidence: float, source_trust: float,
                            country_confirmed: bool, recency_year: Optional[int]) -> float:
    """Gate 3: Combine all signals into single trust score."""
    geo_mult = 1.0 if country_confirmed else 0.2

    current_year = datetime.now().year
    if recency_year and recency_year >= current_year - 1:
        recency_mult = 1.0
    elif recency_year and recency_year >= current_year - 3:
        recency_mult = 0.7
    elif recency_year:
        recency_mult = 0.4
    else:
        recency_mult = 0.6

    return haiku_confidence * source_trust * geo_mult * recency_mult


# ══════════════════════════════════════════════════════════════════════════════
# GATE 4: Contradiction + Corroboration
# ══════════════════════════════════════════════════════════════════════════════

async def check_contradiction(site_id: str, fact_key: str, new_value: str,
                              new_number: Optional[float]) -> dict:
    """Gate 4: Check contradiction or corroboration with existing facts."""
    try:
        existing = await db.query("intelligence_facts", params={
            "select": "id,value_text,value_number,confidence,quarantined",
            "site_id": f"eq.{site_id}", "fact_key": f"eq.{fact_key}", "limit": "1",
        })
    except Exception:
        return {"action": "ok"}

    if not existing:
        return {"action": "ok"}

    ex = existing[0]

    if new_number is not None and ex.get("value_number") is not None:
        ex_num = ex["value_number"]
        if ex_num > 0:
            ratio = new_number / ex_num if ex_num != 0 else 999
            if 0.8 <= ratio <= 1.2:
                return {"action": "corroborate", "existing_fact_id": ex["id"]}
            if ratio > 3.0 or ratio < 0.33:
                return {"action": "quarantine_both", "existing_fact_id": ex["id"],
                        "reason": f"Value mismatch >3x: {ex_num} vs {new_number}"}
        return {"action": "quarantine_both", "existing_fact_id": ex["id"],
                "reason": f"Different values: {ex_num} vs {new_number}"}

    if new_value and ex.get("value_text"):
        if new_value.lower().strip() == ex["value_text"].lower().strip():
            return {"action": "corroborate", "existing_fact_id": ex["id"]}
        return {"action": "quarantine_both", "existing_fact_id": ex["id"],
                "reason": "Different text for same fact"}

    return {"action": "ok"}


# ══════════════════════════════════════════════════════════════════════════════
# GATE 5: Schema + Usefulness
# ══════════════════════════════════════════════════════════════════════════════

def validate_fact(fact: dict) -> Optional[str]:
    """Gate 5: Returns error string or None if valid."""
    cat = fact.get("category", "")
    if cat not in VALID_CATEGORIES and cat not in CATEGORY_MAP:
        return f"invalid category: {cat}"
    vt = fact.get("value_text")
    vn = fact.get("value_number")
    if vt is None and vn is None:
        return "no value"
    if vt and len(str(vt).strip()) < MIN_VALUE_LENGTH:
        return f"value too short: {len(str(vt).strip())} chars"
    if vt and len(str(vt)) > 2000:
        return "value too long"
    if not fact.get("fact_key"):
        return "missing fact_key"
    if not fact.get("evidence_quote"):
        return "missing evidence_quote"
    return None


# ══════════════════════════════════════════════════════════════════════════════
# Search + Read
# ══════════════════════════════════════════════════════════════════════════════

async def search_web(query: str, max_results: int = MAX_SEARCH_RESULTS) -> list[dict]:
    """Search DuckDuckGo. Tries both package names."""
    def _try_duckduckgo_search():
        try:
            from duckduckgo_search import DDGS
            with DDGS() as d:
                results = list(d.text(query, max_results=max_results, region="pa-es"))
            return [{"title": r.get("title", ""), "url": r.get("href", r.get("link", "")),
                     "snippet": r.get("body", r.get("snippet", ""))}
                    for r in results if r.get("href") or r.get("link")]
        except ImportError:
            return None
        except Exception as e:
            logger.warning(f"duckduckgo_search failed: {e}")
            return None

    def _try_ddgs():
        try:
            from ddgs import DDGS
            with DDGS() as d:
                results = list(d.text(query, max_results=max_results, region="pa-es", safesearch="off"))
            return [{"title": r.get("title", ""), "url": r.get("href", r.get("link", "")),
                     "snippet": r.get("body", r.get("snippet", ""))}
                    for r in results if r.get("href") or r.get("link")]
        except Exception as e:
            logger.warning(f"ddgs failed: {e}")
            return []

    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, _try_duckduckgo_search)
    if results is None:
        results = await loop.run_in_executor(None, _try_ddgs)
    return results or []


async def read_page(url: str, max_chars: int = MAX_PAGE_CHARS) -> Optional[str]:
    """Fetch URL and extract clean text."""
    if score_source(url) == 0.0:
        return None

    try:
        async with httpx.AsyncClient(
            timeout=PAGE_TIMEOUT_SEC, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; CerebroBot/1.0)"},
        ) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            ct = resp.headers.get("content-type", "")
            if "text/html" not in ct and "text/plain" not in ct:
                return None
            html = resp.text

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                         "form", "iframe", "noscript", "svg", "img"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 20]
        clean = "\n".join(lines)
        return clean[:max_chars] if clean else None
    except Exception as e:
        logger.debug(f"Failed to read {url}: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# Extract (Gate 2 in prompt)
# ══════════════════════════════════════════════════════════════════════════════

async def extract_facts(content: str, query: str, entity_name: str,
                        entity_type: str, url: str,
                        country: str = "Panama", tld: str = "pa") -> tuple[list[dict], dict]:
    """Haiku extraction with geo validation in prompt."""
    system = EXTRACTION_SYSTEM.format(country=country, tld=tld)
    prompt = EXTRACTION_PROMPT.format(
        query=query, entity_name=entity_name, entity_type=entity_type,
        url=url, content=content[:MAX_PAGE_CHARS], country=country,
    )

    try:
        result = await complete(
            prompt=prompt, system=system, model="haiku",
            max_tokens=2048, temperature=0.2, json_mode=False,
            pipeline_step="research_extraction",
        )
        usage = {"tokens_in": result.get("tokens_in", 0),
                 "tokens_out": result.get("tokens_out", 0),
                 "cost": result.get("cost", 0.0)}

        text = result.get("text", "")
        parsed = None
        for fn in [
            lambda t: json.loads(t),
            lambda t: json.loads(re.search(r'\[[\s\S]*\]', t).group()),
            lambda t: json.loads(re.search(r'\{[\s\S]*\}', t).group()),
        ]:
            try:
                parsed = fn(text)
                break
            except Exception:
                continue

        if parsed is None:
            return [], usage
        if isinstance(parsed, dict):
            parsed = parsed.get("facts") or parsed.get("results") or parsed.get("data") or []
        if not isinstance(parsed, list):
            parsed = []

        logger.info(f"extract_facts: {len(parsed)} raw facts from {url[:60]}")
        return parsed, usage
    except Exception as e:
        logger.warning(f"Fact extraction failed: {e}")
        return [], {"tokens_in": 0, "tokens_out": 0, "cost": 0.0}


# ══════════════════════════════════════════════════════════════════════════════
# Store with Gates 3-5
# ══════════════════════════════════════════════════════════════════════════════

def _slugify(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return re.sub(r'-+', '-', text)[:50]


async def store_fact_with_gates(
    site_id: str, entity_id: Optional[str], fact: dict,
    source_url: str, source_trust: float,
    research_run_id: Optional[str] = None,
) -> dict:
    """Apply gates 3-5, store fact. Returns {stored, quarantined, discarded, reason}."""

    # Gate 5
    err = validate_fact(fact)
    if err:
        return {"stored": False, "discarded": True, "reason": f"schema: {err}"}

    raw_cat = fact.get("category", "other")
    category = raw_cat if raw_cat in VALID_CATEGORIES else CATEGORY_MAP.get(raw_cat, "other")

    # Gate 3
    composite = compute_composite_score(
        fact.get("confidence", 0.5), source_trust,
        fact.get("country_confirmed", False), fact.get("recency_year"))

    if composite < QUARANTINE_THRESHOLD:
        return {"stored": False, "discarded": True, "reason": f"low_score: {composite:.3f}"}

    should_quarantine = composite < TRUST_THRESHOLD

    # Gate 4
    fact_key = fact.get("fact_key") or f"{category}.research.{_slugify(source_url)[:20]}"
    vt = str(fact["value_text"])[:2000] if fact.get("value_text") else None
    vn = float(fact["value_number"]) if fact.get("value_number") is not None else None

    contradiction = await check_contradiction(site_id, fact_key, vt, vn)
    if contradiction["action"] == "quarantine_both":
        should_quarantine = True
        eid = contradiction.get("existing_fact_id")
        if eid:
            try:
                await db.update("intelligence_facts", eid, {"quarantined": True})
            except Exception:
                pass
    elif contradiction["action"] == "corroborate":
        should_quarantine = False

    # Value columns
    val_text, val_num, val_json = None, None, None
    if vn is not None:
        val_num = vn
    elif vt:
        val_text = vt
    else:
        return {"stored": False, "discarded": True, "reason": "no_value"}

    # Tags
    tags = ["research", category]
    if research_run_id:
        tags.append(f"run:{research_run_id}")
    if not fact.get("country_confirmed", False):
        tags.append("unverified-location")
    if should_quarantine:
        tags.append("quarantined")
    tags.append(f"score:{composite:.2f}")
    evidence = fact.get("evidence_quote", "")
    if evidence:
        tags.append(f"evidence:{evidence[:80]}")

    try:
        await db.rpc("upsert_intelligence_fact", {
            "p_site_id": site_id, "p_entity_id": entity_id,
            "p_fact_key": fact_key, "p_category": category,
            "p_value_text": val_text, "p_value_number": val_num,
            "p_value_json": val_json, "p_confidence": composite,
            "p_tags": tags, "p_source": "ai_research",
            "p_quarantined": should_quarantine,
            "p_source_ref": source_url[:200],
        })
        status = "quarantined" if should_quarantine else "trusted"
        logger.info(f"Stored [{status}]: {fact_key} (score={composite:.3f})")
        return {"stored": True, "quarantined": should_quarantine,
                "discarded": False, "composite_score": composite}
    except Exception as e:
        logger.warning(f"Failed to store {fact_key}: {e}")
        return {"stored": False, "discarded": True, "reason": f"db: {e}"}


# ══════════════════════════════════════════════════════════════════════════════
# High-Level Functions
# ══════════════════════════════════════════════════════════════════════════════

async def research_entity(
    site_id: str, entity_id: Optional[str], entity_name: str,
    entity_type: str, missing_categories: list[str],
    country: str = "Panama",
) -> dict:
    stats = {
        "queries": 0, "pages_read": 0, "facts_found": 0,
        "facts_stored": 0, "facts_quarantined": 0, "facts_discarded": 0,
        "tokens_used": 0, "cost": 0.0, "errors": [],
    }

    queries = _build_queries(entity_name, entity_type, missing_categories, country)
    stats["queries"] = len(queries)
    all_facts = []

    for query in queries:
        results = await search_web(query)
        if not results:
            continue
        for result in results[:MAX_PAGES_PER_QUERY]:
            url = result.get("url", "")
            if not url:
                continue
            source_trust = score_source(url)
            if source_trust < 0.1:
                stats["facts_discarded"] += 1
                continue
            content = await read_page(url)
            if not content:
                continue
            stats["pages_read"] += 1
            facts, usage = await extract_facts(content, query, entity_name, entity_type, url, country=country)
            stats["tokens_used"] += usage.get("tokens_in", 0) + usage.get("tokens_out", 0)
            stats["cost"] += usage.get("cost", 0.0)
            stats["facts_found"] += len(facts)
            for f in facts:
                all_facts.append((f, url, source_trust))
        await asyncio.sleep(SEARCH_DELAY_SEC)

    deduped: dict[str, tuple] = {}
    for f, url, trust in all_facts:
        key = f.get("fact_key", "")
        if key not in deduped or f.get("confidence", 0) > deduped[key][0].get("confidence", 0):
            deduped[key] = (f, url, trust)

    for f, url, trust in deduped.values():
        r = await store_fact_with_gates(site_id=site_id, entity_id=entity_id,
                                        fact=f, source_url=url, source_trust=trust)
        if r.get("stored"):
            if r.get("quarantined"):
                stats["facts_quarantined"] += 1
            else:
                stats["facts_stored"] += 1
        elif r.get("discarded"):
            stats["facts_discarded"] += 1

    return stats


async def research_market(site_id: str, market: str = "colchones",
                          country: str = "Panama") -> dict:
    queries = [
        f"mercado {market} {country} 2025 2026",
        f"mejores {market} {country} precios",
        f"tendencias {market} {country}",
        f"tiendas {market} {country} comparativa",
    ]
    stats = {
        "queries": len(queries), "pages_read": 0, "facts_found": 0,
        "facts_stored": 0, "facts_quarantined": 0, "facts_discarded": 0,
        "tokens_used": 0, "cost": 0.0, "errors": [],
    }
    all_facts = []

    for query in queries:
        results = await search_web(query)
        if not results:
            continue
        for result in results[:2]:
            url = result.get("url", "")
            trust = score_source(url)
            if trust < 0.1:
                continue
            content = await read_page(url)
            if not content:
                continue
            stats["pages_read"] += 1
            facts, usage = await extract_facts(content, query, f"mercado {market} {country}", "market", url, country=country)
            stats["tokens_used"] += usage.get("tokens_in", 0) + usage.get("tokens_out", 0)
            stats["cost"] += usage.get("cost", 0.0)
            stats["facts_found"] += len(facts)
            for f in facts:
                all_facts.append((f, url, trust))
            await asyncio.sleep(SEARCH_DELAY_SEC)

    deduped: dict[str, tuple] = {}
    for f, url, trust in all_facts:
        key = f.get("fact_key", "")
        if key not in deduped or f.get("confidence", 0) > deduped[key][0].get("confidence", 0):
            deduped[key] = (f, url, trust)

    for f, url, trust in deduped.values():
        r = await store_fact_with_gates(site_id=site_id, entity_id=None,
                                        fact=f, source_url=url, source_trust=trust)
        if r.get("stored"):
            if r.get("quarantined"):
                stats["facts_quarantined"] += 1
            else:
                stats["facts_stored"] += 1
        elif r.get("discarded"):
            stats["facts_discarded"] += 1

    return stats


# ── Query Builder ─────────────────────────────────────────────────────────────

def _build_queries(entity_name: str, entity_type: str,
                   missing_categories: list[str], country: str) -> list[str]:
    queries = []
    templates = {
        "pricing": f"{entity_name} {country} precios colchones 2025",
        "price_range": f"{entity_name} {country} precios colchones 2025",
        "positioning": f"{entity_name} {country} colchones opiniones marca",
        "audience": f"{entity_name} {country} para quien segmento",
        "competitor": f"{entity_name} vs competidores {country} colchones",
        "product": f"{entity_name} modelos lineas productos {country}",
        "market": f"mercado colchones {country} tendencias 2025",
        "differentiator": f"{entity_name} {country} ventajas diferencias",
        "objection": f"{entity_name} {country} quejas problemas opiniones",
        "value_prop": f"{entity_name} {country} beneficios ventajas",
        "target_segment": f"{entity_name} {country} clientes ideal",
        "weakness": f"{entity_name} {country} desventajas criticas",
        "distribution": f"{entity_name} {country} tiendas distribuidores",
        "pain_point": f"{entity_name} problemas dolor {country} colchones",
        "desire": f"{entity_name} necesidades {country} colchones",
        "description": f"{entity_name} {country} que es como funciona",
        "response": f"como responder {entity_name} objecion colchones {country}",
        "location": f"{entity_name} {country} direccion ubicacion tienda",
        "brands_carried": f"{entity_name} {country} marcas colchones disponibles",
    }

    if entity_type == "brand":
        queries.append(f"{entity_name} colchones {country} tiendas precios")
    elif entity_type == "store":
        queries.append(f"{entity_name} {country} marcas colchones disponibles")
    elif entity_type == "competitor":
        queries.append(f"{entity_name} colchones {country} precios opiniones")
    else:
        queries.append(f"{entity_name} {country}")

    for cat in missing_categories[:2]:
        if cat in templates:
            queries.append(templates[cat])

    return queries[:3]

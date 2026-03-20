"""
CEREBRO — Web Research Engine
Uses DuckDuckGo (search) + httpx/BeautifulSoup (read) + Haiku (extract).
No API keys needed for search. Uses existing Anthropic key for extraction.
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
MAX_PAGE_CHARS = 4000          # chars of page text sent to Haiku
MAX_PAGES_PER_QUERY = 3        # read top N pages per search
SEARCH_DELAY_SEC = 1.5         # delay between DuckDuckGo queries (rate limit)
PAGE_TIMEOUT_SEC = 10           # timeout per page fetch
MIN_FACT_CONFIDENCE = 0.5       # discard facts below this confidence
BLOCKED_DOMAINS = {"facebook.com", "instagram.com", "twitter.com", "x.com",
                   "tiktok.com", "youtube.com", "linkedin.com", "pinterest.com",
                   "reddit.com"}


# ── Search ────────────────────────────────────────────────────────────────────

async def search_web(query: str, max_results: int = MAX_SEARCH_RESULTS) -> list[dict]:
    """Search via DuckDuckGo. Returns [{title, url, snippet}].
    Runs in thread pool because ddgs is sync.
    Uses Panama/Spanish region to get relevant results.
    """
    def _sync_search():
        try:
            from ddgs import DDGS
            with DDGS() as d:
                results = list(d.text(
                    query,
                    max_results=max_results,
                    region="pa-es",  # Panama Spanish
                    safesearch="off",
                ))
            return [
                {
                    "title": r.get("title", ""),
                    "url": r.get("href", r.get("link", "")),
                    "snippet": r.get("body", r.get("snippet", "")),
                }
                for r in results
                if r.get("href") or r.get("link")
            ]
        except Exception as e:
            logger.warning(f"DuckDuckGo search failed for '{query}': {e}")
            return []

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_search)


# ── Read Page ─────────────────────────────────────────────────────────────────

async def read_page(url: str, max_chars: int = MAX_PAGE_CHARS) -> Optional[str]:
    """Fetch URL and extract clean text. Returns None on failure."""
    # Skip blocked domains
    try:
        domain = urlparse(url).netloc.lower().replace("www.", "")
        if domain in BLOCKED_DOMAINS:
            return None
    except Exception:
        return None

    try:
        async with httpx.AsyncClient(
            timeout=PAGE_TIMEOUT_SEC,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; CerebroBot/1.0)"},
        ) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            content_type = resp.headers.get("content-type", "")
            if "text/html" not in content_type and "text/plain" not in content_type:
                return None
            html = resp.text

        soup = BeautifulSoup(html, "html.parser")

        # Remove noise
        for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                         "form", "iframe", "noscript", "svg", "img"]):
            tag.decompose()

        # Extract text
        text = soup.get_text(separator="\n", strip=True)

        # Clean: collapse whitespace, remove very short lines
        lines = [line.strip() for line in text.split("\n") if len(line.strip()) > 20]
        clean = "\n".join(lines)

        return clean[:max_chars] if clean else None

    except Exception as e:
        logger.debug(f"Failed to read {url}: {e}")
        return None


# ── Extract Facts (Haiku) ─────────────────────────────────────────────────────

EXTRACTION_SYSTEM = """You are a market research analyst extracting STRUCTURED FACTS from web content.
You work for a mattress company in Panama analyzing competitors, stores, prices, and market trends.

RULES:
- Only extract facts that are EXPLICITLY stated in the content. Never infer or guess.
- Each fact needs: category, fact_key, value (text or number), confidence (0.0-1.0).
- fact_key format: {category}.{entity-slug}.{metric} — all lowercase, hyphens for spaces.
- Confidence: 1.0 = explicitly stated with source, 0.8 = clearly implied, 0.5 = mentioned vaguely.
- If content is not relevant to the query, return empty array.

VALID CATEGORIES: pricing, positioning, audience, competitor, content, product, market, performance, objection, trigger, differentiator

Respond ONLY with a JSON array of facts. No markdown, no explanation."""

EXTRACTION_PROMPT = """RESEARCH QUERY: {query}
ENTITY: {entity_name} ({entity_type})
COUNTRY: Panama
SOURCE URL: {url}

PAGE CONTENT:
{content}

Extract all relevant facts as JSON array. Each fact:
{{"category": "...", "fact_key": "...", "value_text": "..." OR "value_number": 123, "confidence": 0.8, "source_url": "..."}}

If nothing relevant, return: []"""


async def extract_facts(
    content: str,
    query: str,
    entity_name: str,
    entity_type: str,
    url: str,
) -> tuple[list[dict], dict]:
    """Use Haiku to extract structured facts from page content.
    Returns (facts_list, usage_dict).
    """
    prompt = EXTRACTION_PROMPT.format(
        query=query,
        entity_name=entity_name,
        entity_type=entity_type,
        url=url,
        content=content[:MAX_PAGE_CHARS],
    )

    try:
        result = await complete(
            prompt=prompt,
            system=EXTRACTION_SYSTEM,
            model="haiku",
            max_tokens=2048,
            temperature=0.2,
            json_mode=False,
            pipeline_step="research_extraction",
        )

        usage = {
            "tokens_in": result.get("tokens_in", 0),
            "tokens_out": result.get("tokens_out", 0),
            "cost": result.get("cost", 0.0),
        }

        text = result.get("text", "")
        # Try bare JSON array first
        parsed = None
        for pattern in [
            lambda t: json.loads(t),
            lambda t: json.loads(re.search(r'\[[\s\S]*\]', t).group()),
            lambda t: json.loads(re.search(r'\{[\s\S]*\}', t).group()),
        ]:
            try:
                parsed = pattern(text)
                break
            except Exception:
                continue

        if parsed is None:
            parsed = []

        # Handle wrapped formats: {"facts": [...]} or bare list
        if isinstance(parsed, dict):
            parsed = parsed.get("facts") or parsed.get("results") or parsed.get("data") or []
        if not isinstance(parsed, list):
            parsed = []

        # Filter by confidence
        facts = [
            f for f in parsed
            if isinstance(f, dict)
            and f.get("confidence", 0) >= MIN_FACT_CONFIDENCE
            and f.get("category")
            and (f.get("value_text") or f.get("value_number") is not None)
        ]

        logger.info(f"extract_facts: parsed={len(parsed)} filtered={len(facts)} url={url[:60]}")
        return facts, usage

    except json.JSONDecodeError as e:
        logger.warning(f"Haiku returned invalid JSON: {e}")
        return [], {"tokens_in": 0, "tokens_out": 0, "cost": 0.0}
    except Exception as e:
        logger.warning(f"Fact extraction failed: {e}")
        return [], {"tokens_in": 0, "tokens_out": 0, "cost": 0.0}


# ── Store Facts ───────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return re.sub(r'-+', '-', text)[:50]


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
}


async def store_fact(
    site_id: str,
    entity_id: Optional[str],
    fact: dict,
    source_url: str,
    research_run_id: Optional[str] = None,
) -> bool:
    """Upsert a single extracted fact into intelligence_facts."""
    raw_category = fact.get("category", "other")
    category = raw_category if raw_category in VALID_CATEGORIES else CATEGORY_MAP.get(raw_category, "other")
    fact_key = fact.get("fact_key") or f"{category}.research.{_slugify(source_url)[:20]}"
    confidence = fact.get("confidence", 0.5)

    value_text = None
    value_number = None
    value_json = None

    if fact.get("value_number") is not None:
        value_number = float(fact["value_number"])
    elif fact.get("value_text"):
        value_text = str(fact["value_text"])[:2000]
    else:
        return False

    logger.debug(f"Storing fact: {fact_key} cat={category} text={value_text!r:.40} num={value_number}")
    try:
        await db.rpc("upsert_intelligence_fact", {
            "p_site_id": site_id,
            "p_entity_id": entity_id,
            "p_fact_key": fact_key,
            "p_category": category,
            "p_value_text": value_text,
            "p_value_number": value_number,
            "p_value_json": value_json,
            "p_confidence": confidence,
            "p_tags": ["research", category, f"run:{research_run_id}" if research_run_id else "manual"],
            "p_source": "ai_research",
            "p_quarantined": False,
            "p_source_ref": source_url[:200],
        })
        logger.info(f"Stored fact: {fact_key}")
        return True
    except Exception as e:
        logger.warning(f"Failed to store fact {fact_key}: {e}")
        return False


# ── High-Level Research Functions ─────────────────────────────────────────────

async def research_entity(
    site_id: str,
    entity_id: Optional[str],
    entity_name: str,
    entity_type: str,
    missing_categories: list[str],
    country: str = "Panama",
) -> dict:
    """Full research pipeline for one entity:
    1. Build search queries from missing categories
    2. Search DuckDuckGo
    3. Read top pages
    4. Extract facts via Haiku
    5. Store facts in DB

    Returns {queries, pages_read, facts_found, facts_stored, tokens_used, cost}.
    """
    stats = {
        "queries": 0, "pages_read": 0, "facts_found": 0,
        "facts_stored": 0, "tokens_used": 0, "cost": 0.0, "errors": [],
    }

    # Build queries based on what's missing
    queries = _build_queries(entity_name, entity_type, missing_categories, country)
    stats["queries"] = len(queries)

    all_facts = []

    for query in queries:
        # Search
        results = await search_web(query, max_results=MAX_SEARCH_RESULTS)
        if not results:
            stats["errors"].append(f"No results for: {query}")
            continue

        # Read top pages
        pages_read = 0
        for result in results[:MAX_PAGES_PER_QUERY]:
            url = result.get("url", "")
            if not url:
                continue

            content = await read_page(url)
            if not content:
                continue

            pages_read += 1
            stats["pages_read"] += 1

            # Extract facts
            facts, usage = await extract_facts(
                content=content,
                query=query,
                entity_name=entity_name,
                entity_type=entity_type,
                url=url,
            )

            stats["tokens_used"] += usage.get("tokens_in", 0) + usage.get("tokens_out", 0)
            stats["cost"] += usage.get("cost", 0.0)
            stats["facts_found"] += len(facts)

            for fact in facts:
                fact["_source_url"] = url
                all_facts.append(fact)

        # Rate limit between queries
        await asyncio.sleep(SEARCH_DELAY_SEC)

    # Deduplicate by fact_key (keep highest confidence)
    deduped: dict[str, dict] = {}
    for fact in all_facts:
        key = fact.get("fact_key", "")
        if key not in deduped or fact.get("confidence", 0) > deduped[key].get("confidence", 0):
            deduped[key] = fact

    # Store facts
    for fact in deduped.values():
        stored = await store_fact(
            site_id=site_id,
            entity_id=entity_id,
            fact=fact,
            source_url=fact.get("_source_url", ""),
        )
        if stored:
            stats["facts_stored"] += 1

    return stats


async def research_market(
    site_id: str,
    market: str = "colchones",
    country: str = "Panama",
) -> dict:
    """General market research — trends, new competitors, prices.
    Not tied to a specific entity.
    """
    queries = [
        f"mercado {market} {country} 2025 2026",
        f"mejores {market} {country} precios",
        f"tendencias {market} {country}",
        f"tiendas {market} {country} comparativa",
    ]

    stats = {
        "queries": len(queries), "pages_read": 0, "facts_found": 0,
        "facts_stored": 0, "tokens_used": 0, "cost": 0.0, "errors": [],
    }

    all_facts = []

    for query in queries:
        results = await search_web(query)
        if not results:
            continue

        for result in results[:2]:  # 2 pages per market query
            url = result.get("url", "")
            content = await read_page(url)
            if not content:
                continue

            stats["pages_read"] += 1

            facts, usage = await extract_facts(
                content=content,
                query=query,
                entity_name=f"mercado {market} {country}",
                entity_type="market",
                url=url,
            )

            stats["tokens_used"] += usage.get("tokens_in", 0) + usage.get("tokens_out", 0)
            stats["cost"] += usage.get("cost", 0.0)
            stats["facts_found"] += len(facts)

            for fact in facts:
                fact["_source_url"] = url
                all_facts.append(fact)

            await asyncio.sleep(SEARCH_DELAY_SEC)

    # Deduplicate and store
    deduped: dict[str, dict] = {}
    for fact in all_facts:
        key = fact.get("fact_key", "")
        if key not in deduped or fact.get("confidence", 0) > deduped[key].get("confidence", 0):
            deduped[key] = fact

    for fact in deduped.values():
        stored = await store_fact(site_id=site_id, entity_id=None, fact=fact,
                                  source_url=fact.get("_source_url", ""))
        if stored:
            stats["facts_stored"] += 1

    return stats


# ── Query Builder ─────────────────────────────────────────────────────────────

def _build_queries(
    entity_name: str,
    entity_type: str,
    missing_categories: list[str],
    country: str,
) -> list[str]:
    """Build targeted search queries based on what facts are missing."""
    queries = []

    # Map schema field names → fact category query templates
    # missing_categories come from ENTITY_SCHEMAS (e.g. "value_prop", "price_range")
    templates = {
        # Direct fact categories
        "pricing": f"{entity_name} {country} precios colchones 2025",
        "price_range": f"{entity_name} {country} precios colchones 2025",
        "positioning": f"{entity_name} {country} colchones opiniones reseñas marca",
        "audience": f"{entity_name} {country} para quien es ideal segmento",
        "competitor": f"{entity_name} vs competidores {country} colchones",
        "product": f"{entity_name} modelos lineas productos {country}",
        "market": f"mercado colchones {country} tendencias 2025",
        "differentiator": f"{entity_name} {country} que lo diferencia ventajas",
        "objection": f"{entity_name} {country} quejas problemas opiniones",
        # Schema field names
        "value_prop": f"{entity_name} {country} beneficios ventajas propuesta de valor",
        "target_segment": f"{entity_name} {country} para quien es ideal clientes",
        "weakness": f"{entity_name} {country} desventajas problemas criticas",
        "distribution": f"{entity_name} {country} donde comprar tiendas distribuidores",
        "pain_point": f"{entity_name} problemas dolor {country} colchones",
        "desire": f"{entity_name} deseos necesidades {country} colchones",
        "size_estimate": f"tamaño mercado {entity_name} {country} consumidores",
        "description": f"{entity_name} {country} que es como funciona",
        "frequency": f"{entity_name} frecuencia {country} colchones clientes",
        "severity": f"{entity_name} gravedad impacto {country} colchones",
        "response": f"como responder {entity_name} objecion colchones {country}",
        "location": f"{entity_name} {country} direccion ubicacion tienda",
        "brands_carried": f"{entity_name} {country} marcas colchones disponibles",
        "foot_traffic": f"{entity_name} {country} visitas clientes tienda",
    }

    # General entity query always included
    if entity_type == "brand":
        queries.append(f"{entity_name} colchones {country} tiendas precios")
    elif entity_type == "store":
        queries.append(f"{entity_name} {country} marcas colchones disponibles")
    elif entity_type == "competitor":
        queries.append(f"{entity_name} colchones {country} precios opiniones")
    else:
        queries.append(f"{entity_name} {country}")

    # Add category-specific queries (max 3 total to control cost)
    for cat in missing_categories[:2]:
        if cat in templates:
            queries.append(templates[cat])

    return queries[:3]  # Hard cap at 3 queries per entity

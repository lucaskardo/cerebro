"""
CEREBRO — Knowledge Engine
cold_start_knowledge(): 60 llm_seed facts from Haiku training data.
ingest_url(): authority_claim facts from crawled authority sources.

Entity rules: ONLY brands/products/stores/segments/conditions.
NOT for generic materials, concepts, or properties.
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

logger = get_logger("intelligence.knowledge_engine")

PAGE_TIMEOUT_SEC = 15
CHUNK_SIZE = 8000   # chars per chunk when page > 10k
MAX_FACTS_PER_CHUNK = 10
MAX_CHUNKS = 5      # max chunks per URL to avoid runaway

# ── Entity creation gate ───────────────────────────────────────────────────────

# Only create entities for these types — NOT for generic materials/concepts
ENTITY_TYPES_ALLOWED = {"brand", "product", "store", "segment", "competitor", "competitor_product"}

# ── Cold start topics (10 domains × 6 facts = 60 llm_seed facts) ─────────────

COLD_START_TOPICS = [
    {
        "domain": "material_science",
        "category": "product",
        "query": (
            "tipos de espuma para colchones: memory foam, espuma HR, látex, resortes pocket, híbrido. "
            "Densidades recomendadas (kg/m3), ILD ideal por tipo de dormidor, vida útil esperada."
        ),
    },
    {
        "domain": "health_sleep",
        "category": "product",
        "query": (
            "firmeza de colchón según peso corporal: guía práctica. "
            "Recomendaciones para personas <60kg, 60-90kg, >90kg, parejas con diferente peso."
        ),
    },
    {
        "domain": "health_sleep",
        "category": "audience",
        "query": (
            "posiciones para dormir y dolor de espalda: de lado, boca arriba, boca abajo. "
            "Qué tipo de colchón o almohada minimiza el dolor lumbar en cada posición."
        ),
    },
    {
        "domain": "health_sleep",
        "category": "audience",
        "query": (
            "señales de que un colchón ya no sirve: hundimiento, puntos de presión, "
            "despertar con dolor, alergias. Cuándo es momento de cambiar el colchón."
        ),
    },
    {
        "domain": "health_sleep",
        "category": "market",
        "query": (
            "temperatura corporal y sueño en climas tropicales: cómo el calor afecta la calidad del sueño. "
            "Materiales que retienen más calor vs materiales que respiran mejor."
        ),
    },
    {
        "domain": "product",
        "category": "product",
        "query": (
            "construcción interna de colchones: capa de confort, capa de soporte, cubierta. "
            "Número de resortes, calibre del alambre, capas de espuma, altura total ideal."
        ),
    },
    {
        "domain": "product",
        "category": "product",
        "query": (
            "durabilidad de colchones: factores que determinan cuánto dura. "
            "Densidad mínima aceptable, indicadores de calidad, diferencia entre económico y premium."
        ),
    },
    {
        "domain": "objections",
        "category": "objection",
        "query": (
            "objeciones más comunes al comprar colchón: precio alto, no poder probarlo, "
            "miedo a equivocarse, diferencias entre marcas. Respuestas basadas en datos."
        ),
    },
    {
        "domain": "positioning",
        "category": "differentiator",
        "query": (
            "qué diferencia a un colchón premium de uno económico: materiales, garantía, "
            "periodo de prueba, certificaciones, atención al cliente. Justificación del precio."
        ),
    },
    {
        "domain": "market",
        "category": "market",
        "query": (
            "tendencias globales en la industria de colchones: e-commerce, modelos boxed, "
            "periodos de prueba de 100 noches, certificaciones CertiPUR, mercado latinoamericano."
        ),
    },
]

COLD_START_SYSTEM = """Eres un experto en la industria de colchones, sueño y salud postural.
Generas hechos concretos y verificables basados en tu conocimiento de entrenamiento.
Responde SOLO en JSON válido. Sin explicaciones fuera del JSON."""

COLD_START_USER = """Genera exactamente 6 hechos específicos y verificables sobre este tema:
"{query}"

Contexto: Industria de colchones en Latinoamérica. País específico: Panamá.

Para cada hecho, devuelve:
- fact_key: formato "category.topic.metric" usando hyphens, ej: "product.memory-foam.density"
- category: una de [pricing, positioning, audience, competitor, content, product, market, performance, objection, trigger, differentiator, other]
- value_text: el hecho concreto en 1-3 oraciones. Específico con datos cuando sea posible.
- confidence: 0.0-1.0 (tu confianza en que este dato es correcto)
- evidence_quote: cita o referencia específica que respalda el hecho (puede ser principio científico, estudio, o fuente conocida)
- entity_name: nombre de marca/producto/tienda específica SI aplica, null si es conocimiento genérico

JSON:
{{"facts": [
  {{
    "fact_key": "product.memory-foam.heat-retention",
    "category": "product",
    "value_text": "La espuma memory foam retiene más calor que el látex o los resortes, con temperaturas 2-3°C más altas en la superficie de contacto, lo que puede afectar el sueño en climas cálidos.",
    "confidence": 0.85,
    "evidence_quote": "Journal of Sleep Research: foam density correlates with heat retention",
    "entity_name": null
  }}
]}}"""


INGEST_SYSTEM = """Eres un extractor de conocimiento experto. Tu tarea es identificar hechos concretos y verificables
de fuentes de autoridad sobre colchones, sueño y salud postural.
Responde SOLO en JSON válido."""

INGEST_USER = """Extrae hechos concretos y verificables de este contenido de autoridad:

URL: {url}
CONTENIDO:
{content}

Extrae hasta {max_facts} hechos. Para cada uno:
- fact_key: "category.topic.metric" con hyphens
- category: [pricing, positioning, audience, competitor, product, market, performance, objection, trigger, differentiator, other]
- value_text: el hecho en 1-3 oraciones, lo más específico posible
- confidence: 0.0-1.0
- evidence_quote: cita exacta del texto que respalda el hecho (máx 200 chars)
- entity_name: marca/producto/tienda específica mencionada, null si es genérico

Solo incluye hechos que sean:
1. Específicos y accionables (no vagos como "los colchones son importantes")
2. Verificables desde una fuente de autoridad
3. Útiles para crear contenido sobre colchones en Panamá

JSON:
{{"facts": [...]}}"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    text = str(text).lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return re.sub(r'-+', '-', text)[:50]


async def _fetch_page(url: str) -> Optional[str]:
    """Fetch and clean text from URL. Returns None on failure."""
    try:
        async with httpx.AsyncClient(timeout=PAGE_TIMEOUT_SEC, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; CerebroBot/1.0)"})
            if resp.status_code != 200:
                return None
            ct = resp.headers.get("content-type", "")
            if "text/html" not in ct and "text/plain" not in ct:
                return None
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                             "form", "iframe", "noscript", "svg", "img"]):
                tag.decompose()
            lines = [l.strip() for l in soup.get_text("\n", strip=True).split("\n") if len(l.strip()) > 20]
            return "\n".join(lines)
    except Exception as e:
        logger.debug(f"Failed to fetch {url}: {e}")
        return None


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE) -> list[str]:
    """Split text into overlapping chunks at paragraph boundaries."""
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text) and len(chunks) < MAX_CHUNKS:
        end = min(start + chunk_size, len(text))
        # Try to break at a paragraph boundary
        if end < len(text):
            nl = text.rfind("\n", start, end)
            if nl > start + chunk_size // 2:
                end = nl
        chunks.append(text[start:end])
        start = end
    return chunks


async def _parse_facts_json(text: str) -> list[dict]:
    """Try multiple JSON parse strategies."""
    for fn in [
        lambda t: json.loads(t),
        lambda t: json.loads(re.search(r'\{[\s\S]*\}', t).group()),
    ]:
        try:
            parsed = fn(text)
            if isinstance(parsed, dict):
                return parsed.get("facts") or []
            if isinstance(parsed, list):
                return parsed
        except Exception:
            continue
    return []


async def _store_knowledge_fact(
    site_id: str,
    fact: dict,
    knowledge_type: str,
    source: str,
    source_ref: str,
    entity_id: Optional[str] = None,
) -> Optional[str]:
    """Store a single knowledge fact. Returns fact ID or None."""
    vt = fact.get("value_text")
    if not vt or len(str(vt).strip()) < 10:
        return None

    fact_key = fact.get("fact_key", "")
    if not fact_key:
        cat = fact.get("category", "other")
        slug = _slugify(vt[:30])
        fact_key = f"{cat}.knowledge.{slug}"

    # Normalize category
    valid_cats = {
        "pricing", "positioning", "audience", "competitor", "content",
        "product", "market", "performance", "objection", "trigger",
        "differentiator", "other"
    }
    category = fact.get("category", "other")
    if category not in valid_cats:
        category = "other"

    confidence = min(1.0, max(0.0, float(fact.get("confidence", 0.7))))

    try:
        existing = await db.query("intelligence_facts", params={
            "select": "id",
            "site_id": f"eq.{site_id}",
            "fact_key": f"eq.{fact_key}",
            "limit": "1",
        })
        if existing:
            # Update if this is higher confidence
            await db.update("intelligence_facts", existing[0]["id"], {
                "value_text": str(vt)[:2000],
                "confidence": confidence,
                "knowledge_type": knowledge_type,
                "source": source,
                "evidence_quote": str(fact.get("evidence_quote", ""))[:500] or None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            return existing[0]["id"]

        row = await db.insert("intelligence_facts", {
            "site_id": site_id,
            "entity_id": entity_id,
            "fact_key": fact_key,
            "category": category,
            "value_text": str(vt)[:2000],
            "confidence": confidence,
            "utility_score": float(fact.get("utility_score", 6.0)),
            "quarantined": False,
            "knowledge_type": knowledge_type,
            "source": source,
            "evidence_type": "manual" if source == "llm_knowledge" else "web_research",
            "evidence_quote": str(fact.get("evidence_quote", ""))[:500] or None,
            "tags": [knowledge_type, category, source],
        })
        return row["id"] if row else None
    except Exception as e:
        logger.warning(f"Failed to store knowledge fact {fact_key}: {e}")
        return None


async def _resolve_entity(site_id: str, entity_name: Optional[str]) -> Optional[str]:
    """Look up entity by name. Only returns ID for brands/products/stores/segments/conditions.
    Never creates entities — caller must create them explicitly."""
    if not entity_name:
        return None
    try:
        rows = await db.query("intelligence_entities", params={
            "select": "id,entity_type",
            "site_id": f"eq.{site_id}",
            "name": f"ilike.{entity_name}",
            "status": "eq.active",
            "limit": "1",
        })
        if rows and rows[0].get("entity_type") in ENTITY_TYPES_ALLOWED:
            return rows[0]["id"]
    except Exception:
        pass
    return None


# ══════════════════════════════════════════════════════════════════════════════
# Cold Start
# ══════════════════════════════════════════════════════════════════════════════

async def cold_start_knowledge(site_id: str) -> dict:
    """Generate ~60 llm_seed facts from Haiku training data.
    Covers 10 knowledge domains × 6 facts each.
    Returns {"stored": N, "errors": M, "topics": [...]}."""
    stored = 0
    errors = 0
    topic_results = []

    for topic in COLD_START_TOPICS:
        try:
            result = await complete(
                prompt=COLD_START_USER.format(query=topic["query"]),
                system=COLD_START_SYSTEM,
                model="haiku",
                max_tokens=2048,
                temperature=0.3,
                json_mode=False,
                pipeline_step="knowledge_cold_start",
            )
            raw_facts = await _parse_facts_json(result.get("text", ""))
            topic_stored = 0
            for fact in raw_facts[:6]:
                fact.setdefault("category", topic["category"])
                entity_id = await _resolve_entity(site_id, fact.get("entity_name"))
                fid = await _store_knowledge_fact(
                    site_id=site_id,
                    fact=fact,
                    knowledge_type="llm_seed",
                    source="llm_knowledge",
                    source_ref=f"cold_start:{topic['domain']}",
                    entity_id=entity_id,
                )
                if fid:
                    stored += 1
                    topic_stored += 1
                else:
                    errors += 1
            topic_results.append({"domain": topic["domain"], "stored": topic_stored})
            logger.info(f"cold_start: {topic['domain']} → {topic_stored} facts")
        except Exception as e:
            logger.warning(f"cold_start topic {topic['domain']} failed: {e}")
            errors += 1
            topic_results.append({"domain": topic["domain"], "stored": 0, "error": str(e)})

    return {"stored": stored, "errors": errors, "topics": topic_results}


# ══════════════════════════════════════════════════════════════════════════════
# URL Ingestion
# ══════════════════════════════════════════════════════════════════════════════

async def ingest_url(site_id: str, url: str, label: Optional[str] = None) -> dict:
    """Extract authority_claim facts from an authority URL.
    Chunks pages >10k chars. DuckDuckGo fallback if URL fetch fails.
    Returns {"stored": N, "errors": M, "chunks": C, "url": url}."""
    text = await _fetch_page(url)
    fallback_used = False

    if not text:
        # DuckDuckGo fallback: search for the URL domain + topic
        logger.info(f"ingest_url: direct fetch failed for {url}, trying DuckDuckGo fallback")
        domain = urlparse(url).netloc
        try:
            from packages.intelligence.researcher import search_web, read_page
            topic = label or domain
            results = await search_web(f"site:{domain} colchones sueño", max_results=3)
            if not results:
                results = await search_web(topic, max_results=3)
            texts = []
            for r in results[:2]:
                page = await read_page(r.get("url", ""), max_chars=5000)
                if page:
                    texts.append(page)
            if texts:
                text = "\n\n".join(texts)
                fallback_used = True
        except Exception as e:
            logger.warning(f"DuckDuckGo fallback failed: {e}")

    if not text:
        return {"stored": 0, "errors": 1, "chunks": 0, "url": url, "error": "fetch_failed"}

    chunks = _chunk_text(text)
    stored = 0
    errors = 0
    domain = urlparse(url).netloc

    for i, chunk in enumerate(chunks):
        try:
            result = await complete(
                prompt=INGEST_USER.format(
                    url=url, content=chunk, max_facts=MAX_FACTS_PER_CHUNK
                ),
                system=INGEST_SYSTEM,
                model="haiku",
                max_tokens=2048,
                temperature=0.2,
                json_mode=False,
                pipeline_step="knowledge_ingestion",
            )
            raw_facts = await _parse_facts_json(result.get("text", ""))
            for fact in raw_facts[:MAX_FACTS_PER_CHUNK]:
                entity_id = await _resolve_entity(site_id, fact.get("entity_name"))
                fid = await _store_knowledge_fact(
                    site_id=site_id,
                    fact=fact,
                    knowledge_type="authority_claim",
                    source="authority_content",
                    source_ref=url[:200],
                    entity_id=entity_id,
                )
                if fid:
                    stored += 1
                else:
                    errors += 1
            logger.info(f"ingest_url chunk {i+1}/{len(chunks)}: {len(raw_facts)} facts → {stored} stored")
        except Exception as e:
            logger.warning(f"ingest_url chunk {i} failed: {e}")
            errors += 1

    return {
        "stored": stored,
        "errors": errors,
        "chunks": len(chunks),
        "url": url,
        "fallback_used": fallback_used,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Knowledge Stats
# ══════════════════════════════════════════════════════════════════════════════

async def get_knowledge_stats(site_id: str) -> dict:
    """Return counts of knowledge facts by type and category."""
    try:
        all_facts = await db.query("intelligence_facts", params={
            "select": "id,knowledge_type,category,source,quarantined",
            "site_id": f"eq.{site_id}",
            "order": "created_at.desc",
        })
    except Exception as e:
        return {"error": str(e)}

    by_type: dict = {}
    by_category: dict = {}
    by_source: dict = {}
    total = len(all_facts)
    knowledge_total = 0

    for f in all_facts:
        kt = f.get("knowledge_type") or "atomic_market"
        cat = f.get("category") or "other"
        src = f.get("source") or "unknown"

        by_type[kt] = by_type.get(kt, 0) + 1
        by_category[cat] = by_category.get(cat, 0) + 1
        by_source[src] = by_source.get(src, 0) + 1

        if kt in ("authority_claim", "llm_seed", "derived_summary"):
            knowledge_total += 1

    return {
        "total_facts": total,
        "knowledge_facts": knowledge_total,
        "atomic_market_facts": by_type.get("atomic_market", 0),
        "by_type": by_type,
        "by_category": by_category,
        "by_source": by_source,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Pipeline Knowledge Injection
# ══════════════════════════════════════════════════════════════════════════════

# Categories where local data wins over authority
LOCAL_PRIORITY_CATEGORIES = {"pricing", "durability", "market", "competitor"}
# Categories where authority data wins
AUTHORITY_PRIORITY_CATEGORIES = {"product", "audience", "objection", "differentiator", "positioning"}


async def build_knowledge_context(site_id: str, keyword: str) -> tuple[str, list[str]]:
    """Build knowledge injection string and list of fact IDs used.
    Returns (context_str, fact_ids_used).

    Injection order (4 tiers):
    1. authority_claim — inject value_text directly
    2. llm_seed — inject with lower priority label
    3. atomic_market — compose "{entity} — {category}: {value}"
    4. derived_summary — supporting context only
    """
    try:
        facts = await db.query("intelligence_facts", params={
            "select": "id,knowledge_type,category,value_text,value_number,entity_id,source,confidence",
            "site_id": f"eq.{site_id}",
            "quarantined": "eq.false",
            "order": "confidence.desc,utility_score.desc",
            "limit": "200",
        })
    except Exception as e:
        logger.warning(f"build_knowledge_context failed to load facts: {e}")
        return "", []

    if not facts:
        return "", []

    # Keyword relevance filter — keep facts whose category is relevant
    keyword_lower = keyword.lower()

    authority: list[dict] = []
    llm_seeds: list[dict] = []
    atomic_local: list[dict] = []
    derived: list[dict] = []

    for f in facts:
        kt = f.get("knowledge_type") or "atomic_market"
        if kt == "authority_claim":
            authority.append(f)
        elif kt == "llm_seed":
            llm_seeds.append(f)
        elif kt == "derived_summary":
            derived.append(f)
        else:
            atomic_local.append(f)

    # Deduplicate by category — best fact per category per tier
    def _best_per_cat(lst: list, max_items: int = 6) -> list[dict]:
        seen: set = set()
        out = []
        for f in lst:
            cat = f.get("category", "other")
            if cat not in seen:
                seen.add(cat)
                out.append(f)
            if len(out) >= max_items:
                break
        return out

    authority = _best_per_cat(authority, 6)
    llm_seeds = _best_per_cat(llm_seeds, 4)
    atomic_local = _best_per_cat(atomic_local, 4)
    derived = _best_per_cat(derived, 2)

    lines = []
    fact_ids: list[str] = []

    if authority:
        lines.append("CONOCIMIENTO DE AUTORIDAD (fuentes expertas):")
        for f in authority:
            vt = f.get("value_text") or ""
            if vt:
                lines.append(f"- {vt}")
                fact_ids.append(f["id"])

    if atomic_local:
        lines.append("\nDATOS LOCALES (mercado Panamá):")
        for f in atomic_local:
            vt = f.get("value_text") or ""
            vn = f.get("value_number")
            val = vt if vt else (str(vn) if vn is not None else "")
            if val:
                lines.append(f"- [{f.get('category','market')}] {val}")
                fact_ids.append(f["id"])

    if llm_seeds:
        lines.append("\nCONOCIMIENTO DE BASE (referencia, verificar con fuentes locales):")
        for f in llm_seeds:
            vt = f.get("value_text") or ""
            if vt:
                lines.append(f"- {vt}")
                fact_ids.append(f["id"])

    if derived:
        lines.append("\nCONCLUSIONES DE SÍNTESIS (contexto de soporte):")
        for f in derived:
            vt = f.get("value_text") or ""
            if vt:
                lines.append(f"- {vt}")
                fact_ids.append(f["id"])

    if lines:
        lines.append(
            "\nNOTA: Cuando datos locales y globales contradigan — "
            "SIEMPRE resuelve con recomendación concreta para Panamá. No dejes la tensión abierta."
        )

    return "\n".join(lines), fact_ids

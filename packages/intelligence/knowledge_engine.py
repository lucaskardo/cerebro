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

# ── Cold start topics (6 domains × 10 facts = 60 llm_seed facts) ─────────────

COLD_START_TOPICS = [
    {
        "domain": "material_science",
        "category": "product",
        "query": (
            "CIENCIA DE MATERIALES para colchones (10 hechos con datos específicos):\n"
            "- Qué es ILD y cómo se mide (Indentation Load Deflection, fuerza para comprimir espuma 25%)\n"
            "- Rangos de densidad de espuma y qué significan para durabilidad (PCF o kg/m³)\n"
            "- Memory foam vs látex vs polyfoam vs resortes pocket — propiedades de cada material\n"
            "- Cómo la estructura celular de la espuma afecta transpirabilidad y retención de calor\n"
            "- Cómo la humedad afecta la degradación de espuma con el tiempo\n"
            "- Rangos de ILD: muy suave (ILD 8-12), suave (13-17), medio (18-24), firme (25-31), muy firme (32+)\n"
            "- Diferencia entre espuma de alta densidad (HD) vs baja densidad en términos de durabilidad\n"
            "- Propiedades del látex natural vs látex sintético vs blended\n"
            "- Coils de resortes: Bonnell vs pocket vs offset — diferencias de aislamiento de movimiento\n"
            "- Certificaciones de espuma: CertiPUR-US, OEKO-TEX, Greenguard — qué garantizan"
        ),
    },
    {
        "domain": "construction",
        "category": "product",
        "query": (
            "CONSTRUCCIÓN E INGENIERÍA de colchones (10 hechos con datos específicos):\n"
            "- Capa de confort vs capa de transición vs núcleo de soporte — qué hace cada una\n"
            "- Soporte zonificado — qué es y por qué importa para alineación espinal\n"
            "- Tipos de coils: Bonnell, pocket, offset — trade-offs de durabilidad y confort\n"
            "- Métodos de construcción de soporte de borde y por qué importa\n"
            "- Cómo la altura total del colchón (cm) se relaciona con calidad de soporte\n"
            "- Conteo de resortes: cuándo más resortes sí importa (y cuándo no)\n"
            "- Diferencia entre colchón híbrido (espuma + resortes) vs todo espuma vs todo resortes\n"
            "- Materiales de cubierta: algodón orgánico, tela viscosa, materiales de cambio de fase\n"
            "- Construcción de colchones para climas húmedos: canales de ventilación, ventanas de aire\n"
            "- Cómo la base/somier afecta el rendimiento y durabilidad del colchón"
        ),
    },
    {
        "domain": "health_sleep",
        "category": "audience",
        "query": (
            "SALUD DEL SUEÑO Y ERGONOMÍA (10 hechos con datos específicos):\n"
            "- Alineación espinal por posición de sueño: de lado, boca arriba, boca abajo\n"
            "- Puntos de presión: hombros y caderas para dormidores de lado\n"
            "- Cómo el peso corporal afecta necesidades de firmeza (<60kg, 60-90kg, >90kg)\n"
            "- Regulación de temperatura y calidad del sueño (temperatura ideal de habitación)\n"
            "- Colchón y dolor de espalda: causas y soluciones con datos\n"
            "- Señales de que un colchón ya no sirve: hundimiento en mm, pérdida de confort\n"
            "- Recomendación de firmeza por posición: de lado (suave-medio), espalda (medio-firme), estómago (firme)\n"
            "- Cómo el colchón afecta calidad del sueño: latencia, duración, interrupciones\n"
            "- Alergias y colchones: ácaros del polvo, materiales hipoalergénicos\n"
            "- Sueño en pareja: diferencias de peso >15kg requieren qué soluciones"
        ),
    },
    {
        "domain": "durability",
        "category": "product",
        "query": (
            "DURABILIDAD Y MANTENIMIENTO de colchones (10 hechos con datos específicos):\n"
            "- Vida útil promedio por tipo: todo-espuma, híbrido, resortes, látex (en años)\n"
            "- Factores que aceleran degradación: humedad, peso, frecuencia de uso\n"
            "- Umbrales de hundimiento que indican necesidad de reemplazo (en cm o mm)\n"
            "- Cómo la base/somier afecta la longevidad del colchón\n"
            "- Cobertura típica de garantía: qué incluye vs qué excluye\n"
            "- Rotación e inversión del colchón: frecuencia recomendada\n"
            "- Protectores de colchón: qué protegen y su efecto en durabilidad\n"
            "- Densidad mínima de espuma para >7 años de vida útil (en kg/m³ o PCF)\n"
            "- Efectos de la humedad >70% en foam: aceleración de degradación porcentual\n"
            "- Diferencia de durabilidad entre colchón económico (<$300) vs premium (>$800)"
        ),
    },
    {
        "domain": "buying_guidance",
        "category": "market",
        "query": (
            "GUÍA DE COMPRA de colchones (10 hechos con datos específicos):\n"
            "- Escala de firmeza 1-10 de la industria: cómo mapea a rangos de ILD\n"
            "- Matriz de posición de sueño → firmeza recomendada\n"
            "- Matriz de peso corporal → firmeza recomendada\n"
            "- Períodos de prueba y políticas de devolución: estándares de la industria (noches)\n"
            "- Costo por noche como marco de valor (precio del colchón / vida útil en noches)\n"
            "- Qué preguntar antes de comprar: 5 preguntas clave al vendedor\n"
            "- Diferencia entre colchón de tienda física vs online-only: ventajas/desventajas\n"
            "- Períodos de adaptación: cuánto tiempo tarda en adaptarse a un colchón nuevo (semanas)\n"
            "- Certificaciones que importan al comprar vs las que son solo marketing\n"
            "- Cuándo vale la pena gastar más en un colchón (factores que justifican precio premium)"
        ),
    },
    {
        "domain": "tropical_climate",
        "category": "market",
        "query": (
            "CONSIDERACIONES PARA CLIMA TROPICAL/HÚMEDO como Panamá (10 hechos con datos específicos):\n"
            "- Cómo la humedad >70% acelera la descomposición de espuma (porcentaje de reducción de vida útil)\n"
            "- Mejores materiales para climas tropicales: látex abierto, resortes con cubierta transpirable\n"
            "- Materiales a evitar en climas húmedos y por qué\n"
            "- Ventilación y flujo de aire en construcción de colchones para trópico\n"
            "- Riesgos de moho y alergenos en ambientes húmedos: condiciones que los generan\n"
            "- Cuidado del colchón en países tropicales: frecuencia de limpieza, ventilación\n"
            "- Temperatura de superficie del colchón: diferencia entre materiales en climas >28°C\n"
            "- Cómo el aire acondicionado vs ventilación natural afecta la elección del colchón\n"
            "- Densidad mínima recomendada para clima húmedo vs clima seco (en kg/m³)\n"
            "- Colchones de látex en trópico: ventajas de resistencia a humedad y ácaros"
        ),
    },
]

COLD_START_SYSTEM = """Eres un experto en la industria de colchones, sueño y salud postural.
Extraes CONOCIMIENTO DE DOMINIO universal: ciencia, principios, datos medibles.
NO extraes reseñas de productos ni recomendaciones de marcas específicas.
Responde SOLO en JSON válido. Sin explicaciones fuera del JSON."""

COLD_START_USER = """Extrae exactamente 10 hechos de CONOCIMIENTO DE DOMINIO sobre este tema:

{query}

REGLAS CRÍTICAS:
- Cada hecho DEBE incluir datos específicos: números, medidas, rangos, o condiciones
- NO menciones marcas estadounidenses/europeas (WinkBed, Casper, Saatva, Helix, Purple, etc.)
- NO extraigas reseñas de productos ni listas de "mejores colchones"
- SÍ extrae principios universales aplicables a CUALQUIER marca
- Contexto: negocio de colchones en Panamá (clima tropical, humedad alta)

Para cada hecho:
- fact_key: "category.topic.metric" con hyphens, ej: "product.memory-foam.density-range"
- category: una de [pricing, positioning, audience, product, market, performance, objection, differentiator, other]
- value_text: el hecho completo con datos en 1-3 oraciones
- confidence: 0.6-0.8 (son datos de entrenamiento LLM, no fuentes verificadas)
- utility_score: 0.4-0.7 (llm_seed tiene menor prioridad que authority_claim)
- evidence_quote: la frase clave o dato que hace este hecho verificable (principio científico, estudio, o referencia conocida)
- entity_name: null (NO usar entity_name para conocimiento genérico)

EJEMPLOS BUENOS:
- "ILD (Indentation Load Deflection) mide firmeza: ILD 10 = muy suave, ILD 50 = muy firme. Mide la fuerza en Newtons necesaria para comprimir espuma un 25%."
- "La espuma con densidad menor a 40 kg/m³ (1.5 PCF) se degrada significativamente más rápido, especialmente con humedad >60%. Para climas tropicales se recomienda mínimo 45 kg/m³ (1.8 PCF)."
- "Los dormidores de lado necesitan ILD 14-22 en la capa de confort para permitir 5-7cm de hundimiento en hombros mientras mantienen alineación espinal."

EJEMPLOS MALOS (NO extraer):
- "El WinkBed está disponible en cuatro opciones de firmeza" (reseña de producto)
- "El Casper Original cuesta $995" (precio de marca específica)
- "Los colchones son importantes para el sueño" (sin datos, vago)

JSON:
{{"facts": [
  {{
    "fact_key": "product.memory-foam.heat-retention",
    "category": "product",
    "value_text": "La espuma memory foam retiene 2-3°C más calor que látex o resortes en la superficie de contacto, debido a su estructura celular cerrada que limita el flujo de aire.",
    "confidence": 0.75,
    "utility_score": 0.55,
    "evidence_quote": "Estructura celular cerrada de viscoelástica retiene calor — principio documentado en estudios de termoregulación del sueño",
    "entity_name": null
  }}
]}}"""


INGEST_SYSTEM = """Eres un extractor de CONOCIMIENTO DE DOMINIO experto.
Tu tarea: extraer principios universales, ciencia y conocimiento práctico de fuentes de autoridad sobre colchones y sueño.
NO extraes reseñas de productos ni listas de "mejores colchones" ni precios de marcas específicas.
SÍ extraes el conocimiento subyacente que hace válidas esas recomendaciones.
Responde SOLO en JSON válido."""

INGEST_USER = """Extrae CONOCIMIENTO DE DOMINIO de esta fuente de autoridad:

URL: {url}
CONTENIDO:
{content}

REGLA CLAVE: Si la fuente dice "Recomendamos el colchón XYZ para dormidores de lado porque su ILD de 22 permite hundimiento adecuado de hombros":
- NO extraer: "El colchón XYZ es bueno para dormidores de lado"
- SÍ extraer: "Los dormidores de lado necesitan ILD 18-25 en la capa de confort para hundimiento adecuado de hombros sin llegar al fondo"

Extrae hasta {max_facts} hechos. Para cada uno:
- fact_key: "category.topic.metric" con hyphens
- category: una de [pricing, positioning, audience, product, market, performance, objection, differentiator, other]
- value_text: el principio/hecho completo con datos específicos (números, rangos, condiciones)
- confidence: 0.7-0.95 (según autoridad de la fuente y especificidad del dato)
- utility_score: 0.5-0.9 (mayor para datos con números específicos, menor para afirmaciones generales)
- evidence_quote: FRASE EXACTA del texto fuente que respalda este hecho (copia textual, máx 200 chars)
- entity_name: nombres de marcas/productos mencionados para VINCULACIÓN DE ENTIDAD (no para el hecho en sí), null si no aplica

Solo incluir hechos que sean:
1. Principios universales con datos (no reseñas de productos específicos)
2. Verificables: con números, rangos, condiciones medibles
3. Útiles para crear contenido sobre colchones en Panamá (clima tropical, español)

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

    # Source priority: authority_content > ai_research > llm_knowledge
    SOURCE_PRIORITY = {"authority_content": 3, "ai_research": 2, "llm_knowledge": 1}

    try:
        existing = await db.query("intelligence_facts", params={
            "select": "id,source,confidence",
            "site_id": f"eq.{site_id}",
            "fact_key": f"eq.{fact_key}",
            "limit": "1",
        })
        if existing:
            existing_source = existing[0].get("source", "llm_knowledge")
            existing_priority = SOURCE_PRIORITY.get(existing_source, 0)
            new_priority = SOURCE_PRIORITY.get(source, 0)
            # Only update if new source is >= priority (don't overwrite authority with llm_seed)
            if new_priority < existing_priority:
                logger.debug(f"Skipping update for {fact_key}: existing {existing_source} > new {source}")
                return existing[0]["id"]
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
            "utility_score": min(1.0, max(0.0, float(fact.get("utility_score", 0.6)))),
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
            for fact in raw_facts[:10]:
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
    # atomic_local (pricing, market, competitor) — don't dedup by category:
    # multiple pricing facts per product are all needed (Dr Dream Semi vs Orto vs Pillowtop)
    atomic_local = atomic_local[:15]
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
            vj = f.get("value_json")
            if vt:
                val = vt
            elif vj and isinstance(vj, dict):
                # Compose readable text from value_json pricing facts at runtime
                fk = f.get("fact_key", "")
                fk_parts = fk.split(".")
                label = " ".join(fk_parts[1:]).replace("-", " ").title() if len(fk_parts) >= 2 else fk
                parts = [label]
                queen = vj.get("queen")
                retailer = vj.get("retailer", "")
                financing = vj.get("financing") or {}
                specs = vj.get("specs", "")
                if queen is not None:
                    parts.append(f"Queen ${queen:.2f}")
                if retailer:
                    parts.append(f"en {retailer}")
                monthly = financing.get("monthly_queen")
                months = financing.get("months")
                if monthly and months:
                    parts.append(f"({months} cuotas de ${monthly:.2f}/mes)")
                if specs:
                    parts.append(f"— {specs}")
                val = " ".join(parts)
            elif vn is not None:
                val = str(vn)
            else:
                val = ""
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

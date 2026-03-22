"""
CEREBRO v7 — MD Builder
Pulls all relevant facts from Supabase and formats them into a structured
Markdown brief that any LLM can use to write a great article.
"""
import json
from datetime import datetime
from packages.core import db, get_logger

logger = get_logger("intelligence.md_builder")


async def build_article_md(keyword: str, site_id: str) -> str:
    """
    Build an intelligence MD for a content agent.
    Returns: Markdown string ready to be passed as the prompt to a writer LLM.
    """
    # ── Fetch all data in parallel ─────────────────────────────────────────────
    import asyncio

    results = await asyncio.gather(
        _get_site(site_id),
        _get_facts(site_id, categories=["pricing"]),
        _get_facts(site_id, categories=["market"]),
        _get_facts(site_id, knowledge_type="authority_claim"),
        _get_facts(site_id, categories=["product", "positioning"]),
        _get_entities(site_id),
        _get_approved_articles(site_id),
        _get_negative_rules(site_id),
        return_exceptions=True,
    )

    site          = results[0] if not isinstance(results[0], Exception) else {}
    pricing_facts = results[1] if not isinstance(results[1], Exception) else []
    market_facts  = results[2] if not isinstance(results[2], Exception) else []
    authority_facts = results[3] if not isinstance(results[3], Exception) else []
    product_facts = results[4] if not isinstance(results[4], Exception) else []
    entities      = results[5] if not isinstance(results[5], Exception) else []
    articles      = results[6] if not isinstance(results[6], Exception) else []
    neg_rules     = results[7] if not isinstance(results[7], Exception) else []

    # Build entity lookup
    entity_map = {e["id"]: e for e in entities if e.get("id")}

    now = datetime.utcnow()
    month_year = now.strftime("%B %Y")

    sections = []

    # ── Header ─────────────────────────────────────────────────────────────────
    sections.append(f'# Content Agent — "{keyword}"')
    sections.append("")

    # ── Mission ────────────────────────────────────────────────────────────────
    sections.append("## Tu misión")
    sections.append(
        f'Escribe un artículo que ayude a alguien en Panamá a elegir/entender sobre "{keyword}". '
        "No vendas nada. Sé útil."
    )
    sections.append("")

    # ── Reader ─────────────────────────────────────────────────────────────────
    sections.append("## Quién va a leer esto")
    sections.append(f'- Persona en Panamá que busca "{keyword}"')
    sections.append("- Le importa el precio y la cuota mensual más que las specs técnicas")
    sections.append("- Duerme con calor — Panamá tiene 80% humedad y 25-32°C todo el año")
    sections.append("- Probablemente ha visitado una tienda y salió confundida")
    sections.append("")

    # ── Pricing table ──────────────────────────────────────────────────────────
    pricing_rows = _build_pricing_rows(pricing_facts, entity_map)
    if pricing_rows:
        sections.append(f"## Precios verificados (Queen, {month_year})")
        sections.append("")
        sections.append("| Marca | Modelo | Queen | Dónde | Cuota mensual |")
        sections.append("|-------|--------|-------|-------|---------------|")
        for row in pricing_rows:
            sections.append(row)
        sections.append("")

    # ── Market facts ───────────────────────────────────────────────────────────
    price_ladder = _find_fact(market_facts, "price-ladder", "price_ladder", "escalera")
    if price_ladder:
        sections.append("## Escalera de precios del mercado")
        sections.append(_fact_value(price_ladder))
        sections.append("")

    financiamiento = _find_fact(market_facts, "financiamiento", "financing", "cuota")
    if financiamiento:
        sections.append("## Financiamiento")
        sections.append(_fact_value(financiamiento))
        sections.append("")

    # ── Brands / competitors ───────────────────────────────────────────────────
    brands_section = _build_brands_section(entities, product_facts, entity_map)
    if brands_section:
        sections.append("## Marcas y fabricantes")
        sections.append(brands_section)
        sections.append("")

    # ── Stores ─────────────────────────────────────────────────────────────────
    stores_section = _build_stores_section(entities)
    if stores_section:
        sections.append("## Tiendas principales")
        sections.append(stores_section)
        sections.append("")

    # ── Authority facts ────────────────────────────────────────────────────────
    if authority_facts:
        sections.append("## Datos de autoridad")
        sections.append(
            "**NOTA:** usa estos datos en el artículo pero NO menciones las fuentes por nombre "
            "en el cuerpo del texto. Las fuentes van en una sección de Fuentes al final."
        )
        sections.append("")
        for f in authority_facts[:10]:
            val = f.get("value_text") or ""
            if val:
                sections.append(f"- {val}")
        sections.append("")

    # ── Climate fact ───────────────────────────────────────────────────────────
    clima = _find_fact(market_facts, "clima", "climate", "temperatura")
    if clima:
        sections.append("## Clima de Panamá y colchones")
        sections.append(_fact_value(clima))
        sections.append("")

    # ── Buying journey ─────────────────────────────────────────────────────────
    journey = _find_fact(market_facts, "buying-journey", "buyer_journey", "buying_journey", "proceso")
    if journey:
        sections.append("## Buying journey")
        sections.append(_fact_value(journey))
        sections.append("")

    # ── Other market facts ─────────────────────────────────────────────────────
    used_fact_keys = {
        (price_ladder or {}).get("id"),
        (financiamiento or {}).get("id"),
        (clima or {}).get("id"),
        (journey or {}).get("id"),
    }
    other_market = [f for f in market_facts if f.get("id") not in used_fact_keys]
    if other_market:
        sections.append("## Contexto de mercado adicional")
        for f in other_market[:8]:
            val = _fact_value(f)
            if val:
                sections.append(f"- {val}")
        sections.append("")

    # ── Competitor gap ─────────────────────────────────────────────────────────
    sections.append("## Qué publican los competidores (y qué les falta)")
    sections.append("- Las tiendas publican specs técnicas que nadie entiende")
    sections.append("- Nadie cruza firmeza + peso + posición + clima de forma simple")
    sections.append("- Nadie menciona cuotas reales al lado de los precios")
    sections.append("")

    # ── Tone example ───────────────────────────────────────────────────────────
    sections.append("## Ejemplo del tono correcto")
    sections.append(
        '"Elegir un colchón no debería sentirse como una apuesta. Sin embargo, eso es '
        "exactamente lo que le pasa a mucha gente: van a una tienda, prueban dos o tres "
        "modelos durante unos minutos, escuchan términos técnicos, ven promociones "
        'distintas y salen con más dudas que respuestas."'
    )
    sections.append("")
    sections.append(
        '"No existe un material perfecto para todo el mundo, pero sí hay perfiles que '
        'suelen encajar mejor con cada uno."'
    )
    sections.append("")

    # ── Avoid (negative rules) ─────────────────────────────────────────────────
    sections.append("## Evitar")
    # Always include baseline prohibitions
    sections.append("- No dedicar secciones completas a un solo producto o marca")
    sections.append("- No inventar estadísticas sin fuente")
    sections.append(
        "- No mencionar fuentes de autoridad por nombre en el cuerpo del texto "
        "(van en sección Fuentes al final)"
    )
    for rule in neg_rules[:5]:
        text = rule.get("rule_text", "").strip()
        if text:
            sections.append(f"- {text}")
    sections.append("")

    # ── Published articles ─────────────────────────────────────────────────────
    if articles:
        sections.append("## Temas ya publicados (no repetir)")
        for a in articles:
            kw = a.get("keyword", "")
            if kw:
                sections.append(f"- {kw}")
        sections.append("")

    # ── Constraints ────────────────────────────────────────────────────────────
    sections.append("## Constraints mínimos")
    sections.append("- 1,500-2,500 palabras")
    sections.append("- Incluye 5 preguntas FAQ al final")
    sections.append("- Cita fuentes al final del artículo")
    sections.append("- Español natural de Panamá (no España, no México)")
    sections.append("- Responde en Markdown (## para H2, ### para H3)")
    sections.append("")

    return "\n".join(sections)


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_site(site_id: str) -> dict:
    try:
        return await db.get_by_id("domain_sites", site_id) or {}
    except Exception:
        return {}


async def _get_facts(site_id: str, categories: list = None, knowledge_type: str = None) -> list:
    params = {
        "select": "id,entity_id,fact_key,category,value_text,value_number,value_json,knowledge_type",
        "site_id": f"eq.{site_id}",
        "quarantined": "eq.false",
        "limit": "100",
    }
    if categories:
        cats = ",".join(categories)
        params["category"] = f"in.({cats})"
    if knowledge_type:
        params["knowledge_type"] = f"eq.{knowledge_type}"
    try:
        return await db.query("intelligence_facts", params=params) or []
    except Exception as e:
        logger.warning(f"_get_facts error: {e}")
        return []


async def _get_entities(site_id: str) -> list:
    try:
        return await db.query("intelligence_entities", params={
            "select": "id,name,entity_type,slug,description",
            "site_id": f"eq.{site_id}",
            "status": "eq.active",
            "limit": "100",
        }) or []
    except Exception as e:
        logger.warning(f"_get_entities error: {e}")
        return []


async def _get_approved_articles(site_id: str) -> list:
    try:
        return await db.query("content_assets", params={
            "select": "keyword",
            "site_id": f"eq.{site_id}",
            "status": "eq.approved",
            "limit": "30",
        }) or []
    except Exception as e:
        return []


async def _get_negative_rules(site_id: str) -> list:
    try:
        rules = await db.query("content_rules", params={
            "select": "rule_text,category",
            "site_id": f"eq.{site_id}",
            "status": "not.in.(inactive,suspended)",
            "limit": "20",
        }) or []
        # Return only negative/prohibition rules (accuracy, product_error, competitor_error, missing_info)
        negative_cats = {"accuracy", "product_error", "competitor_error", "missing_info"}
        return [r for r in rules if r.get("category") in negative_cats]
    except Exception:
        return []


def _fact_value(fact: dict) -> str:
    """Return the string value of a fact."""
    if fact.get("value_text"):
        return fact["value_text"]
    if fact.get("value_number") is not None:
        return str(fact["value_number"])
    if fact.get("value_json"):
        v = fact["value_json"]
        if isinstance(v, str):
            return v
        return json.dumps(v, ensure_ascii=False)
    return ""


def _find_fact(facts: list, *substrings) -> dict | None:
    """Find first fact whose fact_key contains any of the given substrings."""
    for f in facts:
        key = (f.get("fact_key") or "").lower()
        for s in substrings:
            if s.lower() in key:
                return f
    return None


def _build_pricing_rows(pricing_facts: list, entity_map: dict) -> list:
    rows = []
    for f in pricing_facts:
        brand = "—"
        if f.get("entity_id") and f["entity_id"] in entity_map:
            brand = entity_map[f["entity_id"]].get("name", "—")

        vj = f.get("value_json")
        if isinstance(vj, dict):
            model   = vj.get("model") or vj.get("modelo") or "—"
            queen   = vj.get("queen") or vj.get("price_queen") or vj.get("precio_queen") or "—"
            store   = vj.get("store") or vj.get("tienda") or vj.get("retailer") or "—"
            cuota   = vj.get("cuota") or vj.get("financing") or vj.get("cuota_mensual") or "—"
            if brand == "—":
                brand = vj.get("brand") or vj.get("marca") or "—"
            rows.append(f"| {brand} | {model} | {queen} | {store} | {cuota} |")
        elif f.get("value_text"):
            # Plain text pricing fact — include as a note row
            rows.append(f"| {brand} | — | {f['value_text'][:60]} | — | — |")

    return rows


def _build_brands_section(entities: list, product_facts: list, entity_map: dict) -> str:
    lines = []
    brand_types = {"competitor", "brand", "competitor_product"}
    brand_entities = [e for e in entities if e.get("entity_type") in brand_types]

    # Group product/positioning facts by entity
    facts_by_entity: dict[str, list] = {}
    for f in product_facts:
        eid = f.get("entity_id")
        if eid:
            facts_by_entity.setdefault(eid, []).append(f)

    for e in brand_entities:
        name = e.get("name", "")
        desc = e.get("description", "")
        entry = f"**{name}**"
        if desc:
            entry += f" — {desc}"
        lines.append(entry)

        # Add associated facts
        for f in facts_by_entity.get(e["id"], [])[:3]:
            val = _fact_value(f)
            if val:
                lines.append(f"  - {val}")

    # Also add product facts with no entity (generic)
    generic = [f for f in product_facts if not f.get("entity_id")]
    for f in generic[:5]:
        val = _fact_value(f)
        if val:
            lines.append(f"- {val}")

    return "\n".join(lines)


def _build_stores_section(entities: list) -> str:
    store_entities = [e for e in entities if e.get("entity_type") == "store"]
    if not store_entities:
        return ""
    lines = []
    for e in store_entities:
        name = e.get("name", "")
        desc = e.get("description", "")
        entry = f"- **{name}**"
        if desc:
            entry += f" — {desc}"
        lines.append(entry)
    return "\n".join(lines)

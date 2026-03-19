"""
Migrate existing NauralSleep data from client_profiles + products
into the structured intelligence layer (entities, facts, relations).
"""
from packages.core import db, get_logger

logger = get_logger("intelligence.migrate")


async def _upsert_entity(site_id: str, entity_type: str, name: str,
                          slug: str, description: str = None, metadata: dict = None) -> str:
    """Insert or update an entity, return its id."""
    existing = await db.query("intelligence_entities", params={
        "select": "id",
        "site_id": f"eq.{site_id}",
        "entity_type": f"eq.{entity_type}",
        "slug": f"eq.{slug}",
    })
    if existing:
        return existing[0]["id"]
    row = await db.insert("intelligence_entities", {
        "site_id": site_id,
        "entity_type": entity_type,
        "name": name,
        "slug": slug,
        "description": description,
        "metadata": metadata or {},
        "status": "active",
    })
    return row["id"]


async def _upsert_fact(site_id: str, entity_id: str, fact_key: str,
                        category: str, value_text: str = None,
                        value_number: float = None, value_json=None,
                        confidence: float = 0.8, tags: list = None,
                        source: str = "migration") -> str:
    """Call upsert_intelligence_fact RPC, return fact_id."""
    params = {
        "p_site_id": site_id,
        "p_entity_id": entity_id,
        "p_fact_key": fact_key,
        "p_category": category,
        "p_confidence": confidence,
        "p_tags": tags or [],
        "p_source": source,
        "p_quarantined": False,
    }
    if value_text is not None:
        params["p_value_text"] = value_text
    elif value_number is not None:
        params["p_value_number"] = value_number
    elif value_json is not None:
        # Pass Python object directly — db.rpc() uses json= which handles serialization
        params["p_value_json"] = value_json
    else:
        raise ValueError(f"No value for fact {fact_key}")

    result = await db.rpc("upsert_intelligence_fact", params)
    if isinstance(result, list) and result:
        return result[0]
    return str(result) if result else None


async def _upsert_relation(site_id: str, from_entity_id: str,
                            to_entity_id: str, relation_type: str,
                            strength: float = 7.0) -> None:
    """Insert relation if not exists."""
    existing = await db.query("intelligence_relations", params={
        "select": "id",
        "site_id": f"eq.{site_id}",
        "from_entity_id": f"eq.{from_entity_id}",
        "to_entity_id": f"eq.{to_entity_id}",
        "relation_type": f"eq.{relation_type}",
    })
    if existing:
        return
    await db.insert("intelligence_relations", {
        "site_id": site_id,
        "from_entity_id": from_entity_id,
        "to_entity_id": to_entity_id,
        "relation_type": relation_type,
        "strength": strength,
    })


async def _upsert_policy(site_id: str, entity_type: str) -> None:
    """Insert default discovery policy for entity_type if not exists."""
    existing = await db.query("discovery_policies", params={
        "select": "id",
        "site_id": f"eq.{site_id}",
        "entity_type": f"eq.{entity_type}",
    })
    if existing:
        return
    defaults = {
        "product":     {"min_observations": 3, "observation_ttl_days": 90},
        "competitor":  {"min_observations": 5, "observation_ttl_days": 60},
        "segment":     {"min_observations": 10, "observation_ttl_days": 90},
        "pain_point":  {"min_observations": 5, "observation_ttl_days": 120},
        "objection":   {"min_observations": 3, "observation_ttl_days": 120},
        "brand":       {"min_observations": 5, "observation_ttl_days": 60},
        "store":       {"min_observations": 3, "observation_ttl_days": 90},
    }.get(entity_type, {})
    await db.insert("discovery_policies", {
        "site_id": site_id,
        "entity_type": entity_type,
        **defaults,
    })


async def run_migration(site_id: str) -> dict:
    """
    Full migration: reads client_profiles + products, seeds structured intelligence layer.
    Returns summary dict with counts.
    """
    logger.info(f"Starting intelligence migration for site_id={site_id}")
    counts = {"entities": 0, "facts": 0, "relations": 0, "policies": 0}

    # ── Fetch source data ────────────────────────────────────────────────────
    profiles = await db.query("client_profiles", params={
        "select": "*", "site_id": f"eq.{site_id}", "limit": "1",
    })
    if not profiles:
        raise ValueError(f"No client_profile found for site_id={site_id}")
    profile = profiles[0]

    products = await db.query("products", params={
        "select": "*", "site_id": f"eq.{site_id}",
    })

    # ── Seed entities: Products ──────────────────────────────────────────────
    product_entities = {}
    for p in products:
        slug = (p.get("model") or p["name"]).lower().replace(" ", "-")
        eid = await _upsert_entity(
            site_id, "product", p["name"], slug,
            description=p.get("category"),
            metadata={"category": p.get("category"), "type": p.get("type")},
        )
        product_entities[p["id"]] = {"entity_id": eid, "product": p}
        counts["entities"] += 1

        if p.get("price"):
            await _upsert_fact(site_id, eid, f"pricing.price.{slug}",
                               "pricing", value_number=float(p["price"]),
                               tags=["price", "product"])
            counts["facts"] += 1
        if p.get("firmness"):
            await _upsert_fact(site_id, eid, f"product.firmness.{slug}",
                               "product", value_text=p["firmness"],
                               tags=["firmness", "product"])
            counts["facts"] += 1
        if p.get("target_segment"):
            await _upsert_fact(site_id, eid, f"audience.target_segment.{slug}",
                               "audience", value_text=p["target_segment"],
                               tags=["segment", "product"])
            counts["facts"] += 1

    # ── Seed entities: Competitors ───────────────────────────────────────────
    competitors = profile.get("competitors") or []
    competitor_entities = {}
    for comp in competitors:
        name = comp if isinstance(comp, str) else comp.get("name", "")
        if not name:
            continue
        slug = name.lower().replace(" ", "-")
        positioning = comp.get("positioning", "") if isinstance(comp, dict) else ""
        weakness = comp.get("weakness", "") if isinstance(comp, dict) else ""
        eid = await _upsert_entity(
            site_id, "competitor", name, slug,
            description=positioning,
            metadata={"url": comp.get("url", "") if isinstance(comp, dict) else ""},
        )
        competitor_entities[slug] = eid
        counts["entities"] += 1

        if positioning:
            await _upsert_fact(site_id, eid, f"positioning.positioning.{slug}",
                               "positioning", value_text=positioning,
                               tags=["competitor", "positioning"])
            counts["facts"] += 1
        if weakness:
            await _upsert_fact(site_id, eid, f"competitor.weakness.{slug}",
                               "competitor", value_text=weakness,
                               tags=["competitor", "weakness"])
            counts["facts"] += 1

    # ── Seed entities: Segments ──────────────────────────────────────────────
    segments = profile.get("target_segments") or []
    segment_entities = {}
    for seg in segments:
        name = seg if isinstance(seg, str) else seg.get("name", "")
        if not name:
            continue
        slug = name.lower().replace(" ", "-")
        desc = seg.get("description", "") if isinstance(seg, dict) else ""
        eid = await _upsert_entity(
            site_id, "segment", name, slug, description=desc,
            metadata={"priority": seg.get("priority", "medium") if isinstance(seg, dict) else "medium"},
        )
        segment_entities[slug] = eid
        counts["entities"] += 1

    # ── Seed entities: Pain Points ───────────────────────────────────────────
    pain_points = profile.get("pain_points") or []
    pain_entities = {}
    for i, pp in enumerate(pain_points):
        text = pp if isinstance(pp, str) else str(pp)
        slug = f"pain-{i+1}"
        eid = await _upsert_entity(site_id, "pain_point", text[:80], slug, description=text)
        pain_entities[slug] = eid
        counts["entities"] += 1
        await _upsert_fact(site_id, eid, f"audience.pain_point.{slug}",
                           "audience", value_text=text,
                           tags=["pain_point", "audience"])
        counts["facts"] += 1

    # ── Seed entities: Objections ────────────────────────────────────────────
    objections = profile.get("customer_objections") or []
    for i, obj in enumerate(objections):
        text = obj if isinstance(obj, str) else str(obj)
        slug = f"objection-{i+1}"
        eid = await _upsert_entity(site_id, "objection", text[:80], slug, description=text)
        counts["entities"] += 1
        await _upsert_fact(site_id, eid, f"objection.text.{slug}",
                           "objection", value_text=text,
                           tags=["objection", "audience"])
        counts["facts"] += 1

    # ── Seed site-level facts from profile ───────────────────────────────────
    vp = profile.get("value_proposition")
    if vp:
        await _upsert_fact(site_id, None, "positioning.value_proposition",
                           "positioning", value_text=vp, tags=["brand", "positioning"])
        counts["facts"] += 1

    brand_voice = profile.get("brand_voice_notes")
    if brand_voice:
        await _upsert_fact(site_id, None, "positioning.brand_voice",
                           "positioning", value_text=brand_voice, tags=["brand", "voice"])
        counts["facts"] += 1

    for i, diff in enumerate(profile.get("key_differentiators") or []):
        await _upsert_fact(site_id, None, f"differentiator.key.{i+1}",
                           "differentiator", value_text=str(diff),
                           tags=["differentiator", "positioning"])
        counts["facts"] += 1

    for i, ca in enumerate(profile.get("content_angles") or []):
        await _upsert_fact(site_id, None, f"content.angle.{i+1}",
                           "content", value_text=str(ca),
                           tags=["content", "angle"])
        counts["facts"] += 1

    for i, bt in enumerate(profile.get("buying_triggers") or []):
        await _upsert_fact(site_id, None, f"trigger.buying.{i+1}",
                           "trigger", value_text=str(bt),
                           tags=["trigger", "buying"])
        counts["facts"] += 1

    # ── Seed relations ───────────────────────────────────────────────────────
    pain_slugs = list(pain_entities.keys())
    for pid, pdata in product_entities.items():
        for ps in pain_slugs[:3]:
            if ps in pain_entities:
                await _upsert_relation(
                    site_id, pdata["entity_id"], pain_entities[ps], "solves", strength=7.0
                )
                counts["relations"] += 1

    segment_slugs = list(segment_entities.keys())
    for pid, pdata in product_entities.items():
        for ss in segment_slugs[:2]:
            if ss in segment_entities:
                await _upsert_relation(
                    site_id, pdata["entity_id"], segment_entities[ss], "recommended_for", strength=8.0
                )
                counts["relations"] += 1

    company_name = profile.get("company_name", "brand")
    brand_slug = company_name.lower().replace(" ", "-")
    brand_eid = await _upsert_entity(
        site_id, "brand", company_name,
        brand_slug, description=vp,
    )
    counts["entities"] += 1
    for slug, eid in competitor_entities.items():
        await _upsert_relation(site_id, brand_eid, eid, "competes_with", strength=8.0)
        counts["relations"] += 1

    # ── Seed discovery policies ──────────────────────────────────────────────
    for etype in ["product", "competitor", "segment", "pain_point", "objection"]:
        await _upsert_policy(site_id, etype)
        counts["policies"] += 1

    logger.info(f"Migration complete: {counts}")
    return counts

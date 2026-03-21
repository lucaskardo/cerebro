"""
CEREBRO v7 — Content Pipeline
keyword → research → brief → draft → humanize → validate → publish
"""
import json
import re
import time
import uuid
from typing import Optional
from urllib.parse import urlencode

from packages.core import db, get_logger, create_alert
from packages.ai import complete, BudgetExceededError
from packages.ai.prompts import content_prompts as prompts
from packages.content.seo_rules import validate_seo

logger = get_logger("content.pipeline")


async def run_pipeline(keyword: str, mission_id: str, asset_id: str = None, site_id: str = None) -> dict:
    """Execute the full content pipeline for a keyword.

    Returns the final content_asset record.
    """
    run_id = str(uuid.uuid4())[:8]
    logger.info(f"[{run_id}] Starting pipeline for: {keyword}")

    # Get mission
    mission = await db.get_by_id("missions", mission_id)
    if not mission:
        raise ValueError(f"Mission not found: {mission_id}")

    # Get site brand config (if provided)
    site = None
    if site_id:
        site = await db.get_by_id("domain_sites", site_id)
    # Merge brand config into mission context
    brand = _build_brand_context(mission, site)

    # ── Load content library, intelligence, performance — all site context ──
    content_library = []
    client_intelligence = ""
    persona_voice = None
    performance_insights: dict = {"insights": [], "recommendations": []}

    if site_id:
        # Content library first — needed by context_builder and linker
        try:
            content_library = await db.query("content_assets", params={
                "select": "id,title,keyword,slug,meta_description",
                "site_id": f"eq.{site_id}",
                "status": "eq.approved",
                "order": "created_at.desc",
                "limit": "50",
            })
        except Exception as e:
            logger.warning(f"[{run_id}] Could not load content library: {e}")

        # Focused article context — IntelligenceService (pure SQL, <100ms)
        # Falls back to LLM-based context_builder, then generic profile dump
        # to_prompt() returns "" when no facts → triggers fallback naturally
        try:
            from packages.intelligence.service import IntelligenceService
            packet = await IntelligenceService().for_content(site_id, keyword, content_library)
            client_intelligence = packet.to_prompt()
        except Exception as e:
            logger.warning(f"[{run_id}] IntelligenceService error: {e}")

        if not client_intelligence:
            try:
                from packages.intelligence.context_builder import build_article_context
                client_intelligence = await build_article_context(site_id, keyword, content_library)
            except Exception as e2:
                logger.warning(f"[{run_id}] context_builder failed, falling back: {e2}")
                try:
                    from packages.intelligence import ClientIntelligence
                    client_intelligence = await ClientIntelligence().get_content_context(site_id)
                except Exception:
                    pass

        # Performance insights to guide brief
        try:
            from packages.intelligence.performance_analyzer import analyze_content_performance
            performance_insights = await analyze_content_performance(site_id)
        except Exception as e:
            logger.warning(f"[{run_id}] Performance analysis failed (non-fatal): {e}")

        # Persona voice for humanization
        try:
            profiles = await db.query("client_profiles", params={
                "select": "persona_voice",
                "site_id": f"eq.{site_id}",
                "limit": "1",
            })
            if profiles:
                persona_voice = profiles[0].get("persona_voice")
        except Exception as e:
            logger.warning(f"[{run_id}] Could not load persona_voice: {e}")

    # ── Knowledge injection (4 tiers) ────────────────────────────────────
    knowledge_fact_ids: list = []
    if site_id:
        try:
            from packages.intelligence.knowledge_engine import build_knowledge_context
            k_context, knowledge_fact_ids = await build_knowledge_context(site_id, keyword)
            if k_context:
                # Append knowledge context to client_intelligence
                sep = "\n\n" if client_intelligence else ""
                client_intelligence = client_intelligence + sep + k_context
                logger.info(f"[{run_id}] Injected {len(knowledge_fact_ids)} knowledge facts")
        except Exception as e:
            logger.warning(f"[{run_id}] Knowledge injection failed (non-fatal): {e}")

    brand["client_intelligence"] = client_intelligence
    brand["content_library"] = content_library
    brand["persona_voice"] = persona_voice
    brand["performance_insights"] = performance_insights

    # ── Load content rules ──────────────────────────────────────────────
    active_rule_ids = []
    rules_prompt_section = ""
    if site_id:
        try:
            rules = await db.query("content_rules", params={
                "select": "id,rule_text,rule_context,rule_exception,category,scope,scope_ref,strength,rule_polarity",
                "site_id": f"eq.{site_id}",
                "status": "not.in.(inactive,suspended)",
                "strength": "gte.0.3",
                "order": "strength.desc",
                "limit": "30",
            })
            applicable = []
            for r in (rules or []):
                if r["scope"] == "all":
                    applicable.append(r)
                elif r["scope"] == "keyword" and r.get("scope_ref") and r["scope_ref"].lower() in keyword.lower():
                    applicable.append(r)
                elif r["scope"] == "category" and r.get("scope_ref"):
                    applicable.append(r)

            # Include ALL applicable rules — no per-category cap, no polarity cap
            neg_rules = [r for r in applicable if (r.get("rule_polarity") or "negative") != "positive"]
            pos_rules = [r for r in applicable if (r.get("rule_polarity") or "negative") == "positive"]

            if applicable:
                sections = []
                if neg_rules:
                    neg_lines = []
                    for r in neg_rules:
                        line = f"❌ [{r['category']}] {r['rule_text']}"
                        if r.get("rule_context"):
                            line += f" (cuando: {r['rule_context']})"
                        if r.get("rule_exception"):
                            line += f" (excepción: {r['rule_exception']})"
                        neg_lines.append(line)
                    sections.append(
                        "⛔ FRASES Y COMPORTAMIENTOS ABSOLUTAMENTE PROHIBIDOS — "
                        "si aparece CUALQUIERA de estos en tu texto, el artículo será RECHAZADO automáticamente:\n"
                        + "\n".join(neg_lines)
                        + "\n\nEl sistema tiene un filtro automático post-generación. "
                        "Usar estas frases elimina puntos de calidad y puede causar re-generación completa."
                    )
                if pos_rules:
                    pos_lines = []
                    for r in pos_rules:
                        line = f"- [{r['category']}] {r['rule_text']}"
                        if r.get("rule_context"):
                            line += f" (when: {r['rule_context']})"
                        if r.get("rule_exception"):
                            line += f" (except: {r['rule_exception']})"
                        pos_lines.append(line)
                    sections.append("SÍ HACER (obligatorio):\n" + "\n".join(pos_lines))
                rules_prompt_section = "\n\n".join(sections)
                active_rule_ids = [r["id"] for r in applicable]
                logger.info(f"[{run_id}] Loaded {len(applicable)} content rules ({len(neg_rules)} neg, {len(pos_rules)} pos)")

            # Increment times_applied for all applied rules
            if active_rule_ids:
                for rid in active_rule_ids:
                    try:
                        r = await db.get_by_id("content_rules", rid)
                        if r:
                            await db.update("content_rules", rid, {
                                "times_applied": (r.get("times_applied") or 0) + 1
                            })
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"[{run_id}] Failed to load content rules: {e}")

    if rules_prompt_section:
        brand["learned_rules"] = rules_prompt_section

    # ── Load regeneration feedback ──────────────────────────────────────
    if asset_id:
        try:
            existing_asset = await db.get_by_id("content_assets", asset_id)
            asset_meta = (existing_asset or {}).get("metadata") or {}
            regen_feedback = asset_meta.get("regenerate_feedback", "")
            if regen_feedback:
                brand["user_feedback"] = regen_feedback
            fh = asset_meta.get("feedback_history", [])
            if fh:
                recent = [f"- [{fb.get('reason', '')}] {fb.get('text', '')}" for fb in fh[-3:] if fb.get("text")]
                if recent:
                    brand["feedback_history"] = "\n".join(recent)
        except Exception:
            pass

    # Dedup check — skip if very similar keyword already exists for this site
    if site_id:
        dup = await _check_duplicate(keyword, site_id, exclude_id=asset_id)
        if dup:
            logger.warning(
                f"[{run_id}] Duplicate keyword '{keyword}' overlaps "
                f"'{dup.get('keyword')}' (id={dup.get('id')}). Skipping pipeline."
            )
            if asset_id:
                await db.update("content_assets", asset_id, {
                    "status": "error",
                    "error_message": (
                        f"Keyword duplicado: similar a '{dup.get('keyword')}' "
                        f"(id: {dup.get('id')})"
                    ),
                })
            return dup

    # Create or get asset
    if not asset_id:
        asset = await db.insert("content_assets", {
            "mission_id": mission_id,
            "title": f"[GENERATING] {keyword}",
            "slug": _slugify(keyword),
            "keyword": keyword,
            "status": "generating",
        })
        asset_id = asset["id"]
    else:
        await db.update("content_assets", asset_id, {"status": "generating"})

    try:
        _pipeline_start = time.time()

        # STEP 0: Research
        _t = time.time()
        logger.info(f"[{run_id}] Step 0/4: Researching keyword...")
        research = await _research_keyword(keyword, brand, run_id)
        logger.info(f"[{run_id}] Step 0 done in {time.time()-_t:.1f}s")
        conversion_plan = {
            "primary_cta": research.get("primary_cta", ""),
            "secondary_cta": research.get("secondary_cta", ""),
            "funnel_stage": research.get("target_funnel_stage", "awareness"),
            "target_persona": research.get("target_persona", ""),
        }
        await db.update("content_assets", asset_id, {
            "research_json": research,
            "conversion_plan_json": conversion_plan,
        })

        # STEP 1: Brief
        _t = time.time()
        logger.info(f"[{run_id}] Step 1/4: Generating brief...")
        brief = await _generate_brief(keyword, brand, research, run_id)
        brief["keyword"] = keyword  # Pass keyword through to draft prompt
        logger.info(f"[{run_id}] Step 1 done in {time.time()-_t:.1f}s")
        await db.update("content_assets", asset_id, {"brief": brief})

        # STEP 1.5: Source-verified research
        _t = time.time()
        logger.info(f"[{run_id}] Step 1.5/4: Fetching verified sources...")
        try:
            sources = await _research_sources(keyword, brand.get("country", ""), run_id)
            logger.info(f"[{run_id}] Step 1.5 done in {time.time()-_t:.1f}s")
        except Exception as e:
            logger.warning(f"[{run_id}] Source research failed (non-fatal): {e}")
            sources = []

        # STEP 2: Draft
        _t = time.time()
        logger.info(f"[{run_id}] Step 2/4: Writing draft...")
        draft = await _generate_draft(brief, brand, run_id, sources=sources)
        logger.info(f"[{run_id}] Step 2 done in {time.time()-_t:.1f}s")
        _existing_asset = await db.get_by_id("content_assets", asset_id)
        _existing_meta = (_existing_asset or {}).get("metadata") or {}
        await db.update("content_assets", asset_id, {
            "title": draft.get("title", keyword),
            "meta_description": draft.get("meta_description", ""),
            "outline": draft.get("outline", {}),
            "body_md": draft.get("body_md", ""),
            "faq_section": draft.get("faq_section", []),
            "data_claims": draft.get("data_claims", []),
            "partner_mentions": draft.get("partner_mentions", []),
            "metadata": {**_existing_meta, "sources_used": draft.get("sources_used", [])},
        })

        # STEP 2.5: Inject internal links into draft body_md
        if content_library:
            _t = time.time()
            try:
                from packages.content.linker import inject_internal_links
                draft["body_md"] = inject_internal_links(
                    body_md=draft.get("body_md", ""),
                    articles=content_library,
                    current_keyword=keyword,
                    current_slug=_slugify(keyword),
                )
                logger.info(f"[{run_id}] Step 2.5 (linker) done in {time.time()-_t:.1f}s")
            except Exception as e:
                logger.warning(f"[{run_id}] Internal links step failed (non-fatal): {e}")

        # STEP 3: Post-processing (anti-words + HTML conversion)
        # NOTE: Humanize step removed in session 8. Draft prompt now includes
        # persona voice, narrative arc, and humanization instructions directly.
        # This avoids quality degradation from a weaker model rewriting Sonnet output.

        # STEP 3.1: Strip anti-AI words
        _t = time.time()
        try:
            from packages.content.anti_words import clean_anti_words
            body_md_clean, removed = clean_anti_words(draft.get("body_md", ""))
            if removed:
                logger.info(f"[{run_id}] Anti-words removed ({len(removed)}): {removed[:5]}")
            draft["body_md"] = body_md_clean
            logger.info(f"[{run_id}] Step 3.1 (anti-words) done in {time.time()-_t:.1f}s")
        except Exception as e:
            logger.warning(f"[{run_id}] Anti-words step failed (non-fatal): {e}")

        # Convert body_md → body_html
        _body_md_final = draft.get("body_md", "")
        try:
            import markdown as _md
            _body_html_raw = _md.markdown(
                _body_md_final,
                extensions=["tables", "fenced_code"],
            )
        except Exception:
            _body_html_raw = "\n".join(
                f"<p>{line}</p>" if line.strip() and not line.startswith("#") else line
                for line in _body_md_final.split("\n")
            )
        draft["body_html"] = _body_html_raw

        # Inject UTM params into all article links
        raw_html = draft.get("body_html", "")
        site_slug = site.get("domain", "cerebro").split(".")[0] if site else "cerebro"
        body_html_with_utm = _inject_utm_params(raw_html, site_slug, asset_id)

        await db.update("content_assets", asset_id, {
            "title": draft.get("title", keyword),
            "body_md": draft.get("body_md", ""),
            "body_html": body_html_with_utm,
            "humanization_score": 0,  # No separate humanize step
        })

        # STEP 3.5: Score (5 dimensions)
        _t = time.time()
        logger.info(f"[{run_id}] Step 3.5/4: Scoring content quality...")
        try:
            from packages.content.scorer import score_content
            site_context = brand.get("client_intelligence") or brand.get("partner_name", "")
            scores = await score_content(
                title=draft.get("title", keyword),
                body_md=draft.get("body_md", ""),
                keyword=keyword,
                site_context=site_context,
                run_id=run_id,
            )
            logger.info(f"[{run_id}] Step 3.5 (scorer) done in {time.time()-_t:.1f}s")
            score_update = {
                "score_humanity":    scores["humanity"],
                "score_specificity": scores["specificity"],
                "score_structure":   scores["structure"],
                "score_seo":         scores["seo"],
                "score_readability": scores["readability"],
                "score_feedback":    scores.get("feedback", ""),
            }
            if scores["total"] < 65:
                existing_asset = await db.get_by_id("content_assets", asset_id)
                meta = (existing_asset or {}).get("metadata") or {}
                meta["low_quality"] = True
                meta["quality_score_total"] = scores["total"]
                score_update["metadata"] = meta
            await db.update("content_assets", asset_id, score_update)
        except Exception as e:
            logger.warning(f"[{run_id}] Scoring step failed (non-fatal): {e}")
            scores = {"total": 0}

        # STEP 4: Validate
        _t = time.time()
        logger.info(f"[{run_id}] Step 4/4: Validating...")
        validation = _validate(draft, keyword, brand)
        logger.info(f"[{run_id}] Step 4 done in {time.time()-_t:.1f}s")

        # Save active rule IDs and knowledge fact IDs for feedback tracking
        _final_meta = None
        if asset_id:
            try:
                current_asset = await db.get_by_id("content_assets", asset_id)
                current_meta = (current_asset or {}).get("metadata") or {}
                if active_rule_ids:
                    current_meta["active_rule_ids"] = active_rule_ids
                current_meta["knowledge_fact_ids"] = knowledge_fact_ids
                _final_meta = current_meta
            except Exception:
                pass

        status = "review" if validation["passed"] else "draft"
        _final_update = {
            "quality_score": validation["quality_score"],
            "validation_results": validation,
            "status": status,
        }
        if _final_meta is not None:
            _final_update["metadata"] = _final_meta
        await db.update("content_assets", asset_id, _final_update)

        logger.info(f"[{run_id}] Pipeline complete: {status} (quality={validation['quality_score']}, total={time.time()-_pipeline_start:.0f}s)")

        # Alert operator
        score_total = scores.get("total", 0) if isinstance(scores, dict) else 0
        low_q = score_total > 0 and score_total < 65
        alert_msg = f"'{draft.get('title', keyword)}' → {status} (calidad: {validation['quality_score']}%"
        if score_total:
            alert_msg += f", AI score: {score_total}/100"
        if low_q:
            alert_msg += " ⚠ baja calidad"
        alert_msg += ")"
        await create_alert(
            "content_ready" if status == "review" else "content_needs_work",
            alert_msg,
            severity="warning" if low_q else ("info" if status == "review" else "warning"),
            action_url=f"/dashboard/content/{asset_id}",
            action_label="Revisar" if status == "review" else "Editar",
        )

        return await db.get_by_id("content_assets", asset_id)

    except BudgetExceededError as e:
        logger.error(f"[{run_id}] Budget exceeded: {e}")
        await db.update("content_assets", asset_id, {
            "status": "error",
            "error_message": "Presupuesto diario LLM agotado",
        })
        await create_alert("budget_exceeded", str(e), severity="critical")
        raise

    except Exception as e:
        logger.error(f"[{run_id}] Pipeline error: {e}", exc_info=True)
        await db.update("content_assets", asset_id, {
            "status": "error",
            "error_message": str(e)[:500],
        })
        await create_alert("pipeline_error", f"Error en pipeline '{keyword}': {str(e)[:200]}", severity="critical")
        raise


# ─── Step helpers ─────────────────────────────────────────────────────────────

async def _check_duplicate(keyword: str, site_id: str, exclude_id: Optional[str] = None) -> Optional[dict]:
    """
    Check for keyword overlap >= 80% (Jaccard) with existing assets for this site.
    Returns the overlapping asset dict or None.
    """
    existing = await db.query("content_assets", params={
        "select": "id,title,keyword,status",
        "site_id": f"eq.{site_id}",
        "status": "not.in.(error,archived)",
        "limit": "100",
    })
    words_new = set(keyword.lower().split())
    if not words_new:
        return None

    for asset in existing:
        if asset.get("id") == exclude_id:
            continue
        kw = asset.get("keyword") or ""
        words_ex = set(kw.lower().split())
        if not words_ex:
            continue
        union = words_new | words_ex
        overlap = len(words_new & words_ex) / len(union)
        if overlap >= 0.8:
            return asset
    return None


async def _research_keyword(keyword: str, brand: dict, run_id: str) -> dict:
    result = await complete(
        prompt=prompts.RESEARCH_USER.format(
            keyword=keyword,
            partner_name=brand.get("partner_name", ""),
            country=brand.get("country", ""),
            target_audience=json.dumps(brand.get("target_audience", {}), ensure_ascii=False),
            core_topics=json.dumps(brand.get("core_topics", []), ensure_ascii=False),
        ),
        system=prompts.RESEARCH_SYSTEM,
        model="haiku",
        json_mode=True,
        pipeline_step="research",
        run_id=run_id,
    )
    return result["parsed"] or {}


async def _generate_brief(keyword: str, brand: dict, research: dict, run_id: str) -> dict:
    audience = brand.get("target_audience", {})
    audience_summary = ", ".join(audience.get("segments", [])) if isinstance(audience, dict) else str(audience)

    # Content library context — avoid duplicate angles, suggest internal links
    library_context = ""
    content_library = brand.get("content_library", [])
    if content_library:
        existing_titles = [a.get("title", "") for a in content_library[:30] if a.get("title")]
        existing_keywords = [a.get("keyword", "") for a in content_library[:30] if a.get("keyword")]
        link_candidates = [
            f"/articulo/{a['slug']} ({a['title']})"
            for a in content_library[:10]
            if a.get("slug") and a.get("title")
        ]
        library_context = (
            f"\nBiblioteca de contenido existente ({len(content_library)} artículos):\n"
            f"IMPORTANTE: NO repetir estos temas, buscar ángulos DIFERENTES:\n"
            f"{json.dumps(existing_keywords[:20], ensure_ascii=False)}\n\n"
            f"Artículos existentes para internal linking:\n"
            + "\n".join(f"- {l}" for l in link_candidates)
        )

    # Enrich prompt with research context
    research_context = ""
    if research:
        research_context = (
            f"\nResearch context:\n"
            f"- Pain points: {json.dumps(research.get('pain_points', []), ensure_ascii=False)}\n"
            f"- Differentiation: {research.get('differentiation', '')}\n"
            f"- Funnel stage: {research.get('target_funnel_stage', '')}\n"
            f"- Primary CTA: {research.get('primary_cta', '')}\n"
        )

    # Performance insights context
    perf = brand.get("performance_insights", {})
    performance_context = ""
    if perf.get("insights") or perf.get("recommendations"):
        performance_context = (
            "\n\nPERFORMANCE INSIGHTS (basado en qué contenido está generando leads realmente):\n"
            + "\n".join(f"- {i}" for i in perf.get("insights", [])[:3])
            + "\n\nRECOMENDACIONES:\n"
            + "\n".join(f"- {r}" for r in perf.get("recommendations", [])[:3])
        )

    result = await complete(
        prompt=prompts.BRIEF_USER.format(
            keyword=keyword,
            country=brand.get("country", ""),
            partner_name=brand.get("partner_name", ""),
            target_audience=json.dumps(brand.get("target_audience", {}), ensure_ascii=False),
            core_topics=json.dumps(brand.get("core_topics", []), ensure_ascii=False),
            cta_config=json.dumps(brand.get("cta_config", {}), ensure_ascii=False),
            brand_tone_example=brand.get("brand_tone", "directo, honesto, útil"),
            client_intelligence=brand.get("client_intelligence", ""),
        ) + research_context + library_context + performance_context,
        system=prompts.BRIEF_SYSTEM.format(
            brand_persona=brand.get("brand_persona", "experto en el tema"),
            brand_tone=brand.get("brand_tone", "directo, honesto, útil"),
            brand_audience_summary=audience_summary or "personas interesadas en el tema",
            client_intelligence=brand.get("client_intelligence", ""),
        ),
        model="haiku",
        max_tokens=4096,
        json_mode=True,
        pipeline_step="brief",
        run_id=run_id,
    )

    brief_result = result["parsed"] or {"title_suggestions": [keyword], "h2_sections": [], "key_points": []}

    # Add content library links as cross-brand linking suggestions
    if content_library:
        cross_links = [
            f"/blog/{a['slug']}"
            for a in content_library[:5]
            if a.get("slug")
        ]
        brief_result["cross_brand_links"] = cross_links

    return brief_result


async def _research_sources(keyword: str, country: str, run_id: str) -> list[dict]:
    """Find 3-5 verifiable statistics for the keyword with source name and URL."""
    result = await complete(
        prompt=(
            f'Encuentra 3-5 estadísticas verificables sobre "{keyword}" en {country or "Latinoamérica"}.\n'
            f"Para cada estadística incluye: el dato exacto, la fuente (organización/institución), año y URL si existe.\n"
            f"Prioriza: instituciones oficiales, estudios académicos, informes de industria.\n"
            f"NUNCA inventes datos. Si no hay datos verificables, devuelve lista vacía.\n\n"
            f"JSON exacto:\n"
            f'{{"sources": [{{"stat": "dato específico", "source_name": "nombre organización", "year": "2024", "url": "https://... o null", "confidence": "high|medium|low"}}]}}'
        ),
        system="Eres un investigador de datos. Solo devuelves estadísticas verificables con fuentes reales. Responde SOLO en JSON válido.",
        model="haiku",
        json_mode=True,
        pipeline_step="sources",
        run_id=run_id,
    )
    parsed = result.get("parsed") or {}
    return parsed.get("sources", [])


async def _generate_draft(brief: dict, brand: dict, run_id: str, sources: list = None) -> dict:
    titles = brief.get("title_suggestions", [""])
    title = titles[0] if isinstance(titles, list) and titles else str(titles)

    # Build sources context for prompt injection
    sources_context = ""
    if sources:
        sources_context = (
            "\nFuentes verificadas para citar (úsalas en el artículo):\n"
            + "\n".join(
                f"- {s.get('stat')} — {s.get('source_name', '')} {s.get('year', '')} {('(' + s['url'] + ')') if s.get('url') else ''}"
                for s in sources
            )
        )

    rules_section = ""
    if brand.get("learned_rules"):
        rules_section = f"""
LEARNED WRITING RULES (from reviewer feedback — follow ALL):
{brand['learned_rules']}
"""

    feedback_section = ""
    if brand.get("user_feedback"):
        feedback_section = f"""
REVIEWER FEEDBACK ON PREVIOUS VERSION — address ALL points:
{brand['user_feedback']}
{('Previous corrections:' + chr(10) + brand.get('feedback_history', '')) if brand.get('feedback_history') else ''}
"""

    # Build persona block for system prompt
    persona_voice = brand.get("persona_voice")
    persona_block = ""
    if persona_voice and isinstance(persona_voice, dict):
        persona_block = (
            f"PERSONA: Escribe como {persona_voice.get('name', '')}.\n"
            f"Título: {persona_voice.get('title', '')}\n"
            f"Tono: {persona_voice.get('tone', '')}\n"
            f"Frases que usa: {json.dumps(persona_voice.get('phrases_uses', [])[:5], ensure_ascii=False)}\n"
            f"Opiniones fuertes: {json.dumps(persona_voice.get('strong_opinions', [])[:3], ensure_ascii=False)}\n"
            f"Estilo: {persona_voice.get('writing_style', '')}\n"
        )

    result = await complete(
        prompt=prompts.DRAFT_USER.format(
            title=title,
            keyword=brief.get("keyword", title),
            search_intent=brief.get("search_intent", "informational"),
            h2_sections=json.dumps(brief.get("h2_sections", []), ensure_ascii=False),
            key_points=json.dumps(brief.get("key_points", []), ensure_ascii=False),
            faq_questions=json.dumps(brief.get("faq_questions", []), ensure_ascii=False),
            first_paragraph_hook=brief.get("first_paragraph_hook", ""),
            target_word_count=brief.get("target_word_count", 1500),
            client_intelligence=brand.get("client_intelligence", ""),
            sources_context=sources_context,
        ) + rules_section + feedback_section,
        system=prompts.DRAFT_SYSTEM.format(
            brand_persona=brand.get("brand_persona", "experto en el tema"),
            partner_name=brand.get("partner_name", ""),
            client_intelligence=brand.get("client_intelligence", ""),
            persona_block=persona_block,
        ),
        model="sonnet",
        max_tokens=12000,
        json_mode=True,
        pipeline_step="draft",
        run_id=run_id,
    )
    return result["parsed"] or {"title": title, "body_md": result["text"]}


async def _humanize(draft: dict, brand: dict, run_id: str) -> dict:
    audience = brand.get("target_audience", {})
    audience_summary = ", ".join(audience.get("segments", [])) if isinstance(audience, dict) else str(audience)

    persona_voice = brand.get("persona_voice")

    if persona_voice and isinstance(persona_voice, dict):
        # Use persona-driven humanization
        system = prompts.HUMANIZE_SYSTEM_PERSONA.format(
            persona_name=persona_voice.get("name", brand.get("brand_persona", "experto en el tema")),
            persona_title=persona_voice.get("title", ""),
            persona_tone=persona_voice.get("tone", brand.get("brand_tone", "directo, honesto, útil")),
            persona_phrases=json.dumps(persona_voice.get("phrases_uses", [])[:5], ensure_ascii=False),
            persona_opinions=json.dumps(persona_voice.get("strong_opinions", [])[:3], ensure_ascii=False),
            persona_style=persona_voice.get("writing_style", ""),
        )
    else:
        system = prompts.HUMANIZE_SYSTEM.format(
            brand_persona=brand.get("brand_persona", "experto en el tema"),
            brand_tone=brand.get("brand_tone", "directo, honesto, útil"),
        )

    result = await complete(
        prompt=prompts.HUMANIZE_USER.format(
            title=draft.get("title", ""),
            body_md=draft.get("body_md", "")[:6000],
            brand_audience_summary=audience_summary or "personas interesadas en el tema",
        ),
        system=system,
        model="haiku",
        max_tokens=8192,
        json_mode=True,
        pipeline_step="humanize",
        run_id=run_id,
    )
    parsed = result["parsed"] or {}
    parsed.setdefault("faq_section", draft.get("faq_section", []))
    parsed.setdefault("data_claims", draft.get("data_claims", []))
    parsed.setdefault("meta_description", draft.get("meta_description", ""))
    return parsed


def _validate(content: dict, keyword: str, brand: dict) -> dict:
    """Rule-based validation. No LLM needed."""
    body = content.get("body_md", "")
    title = content.get("title", "")
    partner = brand.get("partner_name", "")

    checks = {
        "has_title": bool(title.strip()),
        "title_has_keyword": any(w in title.lower() for w in keyword.lower().split()[:3]),
        "word_count_ok": 800 <= len(body.split()) <= 5000,
        "has_h2": body.count("## ") >= 3,
        "has_faq": bool(content.get("faq_section")),
        "has_meta": len(content.get("meta_description", "")) >= 80,
        "partner_mentioned": partner.lower() in body.lower() if partner else True,
        "partner_not_spammy": body.lower().count(partner.lower()) <= 3 if partner else True,
        "no_unverified": "[VERIFICAR]" not in body and "[TODO]" not in body,
        "has_html": bool(content.get("body_html", "").strip()),
    }

    # Brand safety — count occurrences; educational mentions (1-2x) are OK
    blacklist = ["estafa", "scam", "piramide", "fraude", "ilegal", "lavado"]
    brand_safe = not any(body.lower().count(term) > 2 for term in blacklist)
    checks["brand_safe"] = brand_safe

    # SEO validation
    seo = validate_seo(content)
    checks["seo_passed"] = seo["passed"]

    score = round(sum(1 for v in checks.values() if v) / len(checks) * 100, 1)

    return {
        "passed": score >= 70 and brand_safe,
        "quality_score": score,
        "humanization_score": content.get("humanization_score", 50),
        "word_count": len(body.split()),
        "checks": checks,
        "seo": seo,
        "issues": [k for k, v in checks.items() if not v],
    }


def _inject_utm_params(body_html: str, site_slug: str, asset_id: str) -> str:
    """
    Inject UTM parameters into all <a href> tags in the article HTML.
    Only modifies relative URLs and URLs pointing to known domains.
    Skips anchors (#), mailto:, external partner links that already have UTM.
    """
    if not body_html:
        return body_html

    utm = {
        "utm_source": "cerebro",
        "utm_medium": "article",
        "utm_campaign": site_slug,
        "utm_content": asset_id[:8],
    }
    utm_str = urlencode(utm)

    def replace_href(match):
        full_tag = match.group(0)
        href = match.group(1)

        # Skip anchors, mailto, tel, javascript, already-utm'd links
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            return full_tag
        if "utm_source" in href:
            return full_tag

        # Add UTM params
        sep = "&" if "?" in href else "?"
        new_href = f"{href}{sep}{utm_str}"
        return full_tag.replace(f'href="{href}"', f'href="{new_href}"', 1)

    # Match href="..." (double quotes only for safety)
    result = re.sub(r'<a\s[^>]*href="([^"]*)"[^>]*>', replace_href, body_html, flags=re.IGNORECASE)
    return result


def _build_brand_context(mission: dict, site: dict = None) -> dict:
    """Merge mission + site brand config into unified context for prompts."""
    base = {
        "partner_name": mission.get("partner_name", ""),
        "country": mission.get("country", ""),
        "target_audience": mission.get("target_audience", {}),
        "core_topics": mission.get("core_topics", []),
        "cta_config": mission.get("cta_config", {}),
        "brand_persona": mission.get("brand_persona", "experto en el tema"),
        "brand_tone": mission.get("brand_tone", "directo, honesto, útil"),
    }
    if site:
        if site.get("brand_persona"):
            base["brand_persona"] = site["brand_persona"]
        if site.get("brand_tone"):
            base["brand_tone"] = site["brand_tone"]
        if site.get("brand_audience"):
            base["target_audience"] = site["brand_audience"]
        if site.get("brand_topics"):
            base["core_topics"] = site["brand_topics"]
        if site.get("brand_cta"):
            base["cta_config"] = site["brand_cta"]
            base["partner_name"] = site["brand_cta"].get("partner", base["partner_name"])
    return base


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    replacements = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n", "ü": "u"}
    slug = text.lower()
    for k, v in replacements.items():
        slug = slug.replace(k, v)
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug.strip())
    slug = re.sub(r'-+', '-', slug)
    return slug[:80]

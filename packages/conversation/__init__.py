"""
CEREBRO Conversation Engine
Two-phase: tools executed synchronously, then final text streamed word-by-word via SSE.
"""
import asyncio
import json
import re
import httpx
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Optional

from packages.core import db, get_logger, config

logger = get_logger("conversation")

CLAUDE_MODEL = "claude-sonnet-4-20250514"


class ChatEngine:

    # ─── System prompt ────────────────────────────────────────────────────────

    async def build_system_prompt(self, site_id: str) -> str:
        """Build a system prompt that makes Claude 'someone who already knows this business'."""
        # Build context from intelligence layer (replaces legacy client_profiles)
        try:
            site_data = await db.get_by_id("domain_sites", site_id)
            brand_name = (site_data or {}).get("brand_name", "Unknown")
            brand_persona = (site_data or {}).get("brand_persona", "Business analyst")
            brand_tone = (site_data or {}).get("brand_tone", "professional, helpful")
        except Exception:
            brand_name, brand_persona, brand_tone = "Unknown", "Business analyst", "professional, helpful"

        try:
            facts = await db.query("intelligence_facts", params={
                "select": "category,fact_key,value_text,value_number",
                "site_id": f"eq.{site_id}",
                "quarantined": "eq.false",
                "order": "utility_score.desc",
                "limit": "20",
            })
            entities = await db.query("intelligence_entities", params={
                "select": "name,entity_type",
                "site_id": f"eq.{site_id}",
                "status": "eq.active",
                "limit": "30",
            })
            competitors = [e["name"] for e in (entities or []) if e.get("entity_type") in ("competitor", "brand")]
            products = [e["name"] for e in (entities or []) if e.get("entity_type") == "product"]
            segments = [e["name"] for e in (entities or []) if e.get("entity_type") == "segment"]
            pain_points = [e["name"] for e in (entities or []) if e.get("entity_type") == "pain_point"]
            by_cat = {}
            for f in (facts or []):
                cat = f.get("category", "other")
                val = f.get("value_text") or str(f.get("value_number", ""))
                if val and cat not in by_cat:
                    by_cat[cat] = val
        except Exception:
            competitors, products, segments, pain_points, by_cat = [], [], [], [], {}

        # Recent metrics
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        try:
            leads_week    = await db.query("leads",          params={"select": "id", "site_id": f"eq.{site_id}", "created_at": f"gte.{week_ago}"})
            articles      = await db.query("content_assets", params={"select": "id,title", "site_id": f"eq.{site_id}", "status": "eq.approved"})
            experiments   = await db.query("experiments",    params={"select": "id,hypothesis", "site_id": f"eq.{site_id}", "status": "eq.running"})
        except Exception:
            leads_week = articles = experiments = []

        # Find top article by lead count
        top_article = ""
        for a in (articles or [])[:8]:
            try:
                al = await db.query("leads", params={"select": "id", "asset_id": f"eq.{a['id']}", "limit": "1"})
                if al:
                    top_article = a.get("title", "")
                    break
            except Exception:
                pass

        def fmt_list(items, n=4):
            if not items:
                return "No definidos"
            return "\n".join(f"  • {i}" for i in items[:n])

        competitors_str = fmt_list(competitors)
        segments_str    = ", ".join(segments[:3]) or "No definidos"
        diff_val        = by_cat.get("differentiator", by_cat.get("positioning", ""))
        diff_str        = f"  • {diff_val}" if diff_val else "No definidos"

        return f"""Eres CEREBRO, el Sistema Operativo de Crecimiento para {brand_name}.
Ya conoces este negocio profundamente. Aquí está todo lo que sabes:

SITE_ID: {site_id}
(Usa este ID exactamente en TODOS los tool calls que requieran site_id.)

EMPRESA: {brand_name} — Panamá
PROPUESTA DE VALOR: {brand_persona}

DIFERENCIADORES CLAVE:
{diff_str}

COMPETIDORES PRINCIPALES:
{competitors_str}

AUDIENCIA OBJETIVO: {segments_str}

ESTADO ACTUAL:
  • Leads esta semana: {len(leads_week)}
  • Artículos publicados: {len(articles)}
  • Experimentos activos: {len(experiments)}
  • Artículo principal: {top_article or "Sin datos aún"}

INSTRUCCIONES DE COMPORTAMIENTO:
- Hablas como socio de negocio — directo, con datos, accionable.
- Nunca das consejos genéricos. Todo es específico para {brand_name}.
- Cuando el usuario pide que hagas algo, usas las herramientas disponibles para ejecutarlo.
- Cuando hace una pregunta, consultas los datos y respondes con especificidad.
- Respondes en el mismo idioma que el usuario.
- Eres conciso pero completo. Sin relleno ni preamble."""

    # ─── Tool definitions ─────────────────────────────────────────────────────

    def define_tools(self) -> list:
        return [
            {
                "name": "get_leads",
                "description": "Get recent leads with full details: email, intent score, source CTA, quiz responses, article origin.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "site_id": {"type": "string"},
                        "days":    {"type": "integer", "description": "Days to look back", "default": 7},
                    },
                    "required": ["site_id"],
                },
            },
            {
                "name": "get_content_performance",
                "description": "Get articles ranked by lead generation, with quality scores and publish status.",
                "input_schema": {
                    "type": "object",
                    "properties": {"site_id": {"type": "string"}},
                    "required": ["site_id"],
                },
            },
            {
                "name": "generate_content",
                "description": "Trigger the full content generation pipeline for a keyword.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "keyword": {"type": "string"},
                        "site_id": {"type": "string"},
                    },
                    "required": ["keyword", "site_id"],
                },
            },
            {
                "name": "approve_content",
                "description": "Approve a content article by its ID so it goes live.",
                "input_schema": {
                    "type": "object",
                    "properties": {"article_id": {"type": "string"}},
                    "required": ["article_id"],
                },
            },
            {
                "name": "query_data",
                "description": "Query any CEREBRO table. Tables: leads, content_assets, experiments, goals, strategies, knowledge_entries, opportunities, personas, approvals.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "table":   {"type": "string"},
                        "filters": {"type": "object", "description": "Key-value pairs, e.g. {status: 'approved'}"},
                        "limit":   {"type": "integer", "default": 10},
                    },
                    "required": ["table"],
                },
            },
            {
                "name": "create_experiment",
                "description": "Create a new A/B experiment for a hypothesis.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "hypothesis":     {"type": "string"},
                        "site_id":        {"type": "string"},
                        "target_metric":  {"type": "string", "default": "leads"},
                    },
                    "required": ["hypothesis", "site_id"],
                },
            },
            {
                "name": "explain_metric",
                "description": "Explain what a metric means for this business with real current numbers.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "metric_name": {"type": "string"},
                        "site_id":     {"type": "string"},
                    },
                    "required": ["metric_name", "site_id"],
                },
            },
            {
                "name": "update_intelligence",
                "description": (
                    "Update a field in the client intelligence profile. "
                    "For JSONB array fields (competitors, target_segments, key_differentiators, pain_points, etc.) "
                    "use action='array_add' or action='array_remove' to add/remove individual items without "
                    "overwriting the rest. Use action='replace' (default) for scalar fields or full replacements."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "site_id":   {"type": "string"},
                        "field":     {"type": "string", "description": "Profile field name, e.g. 'competitors', 'value_proposition'"},
                        "action":    {"type": "string", "enum": ["replace", "array_add", "array_remove"],
                                      "description": "replace=overwrite entire field, array_add=append item to array, array_remove=remove item from array by name"},
                        "value":     {"description": "For replace: the new value. For array_add: the item object to add (e.g. {\"name\": \"Indufoam\"}). Not needed for array_remove."},
                        "item_name": {"type": "string", "description": "For array_add/array_remove: the 'name' key value to match/remove (e.g. 'Spring Air')"},
                    },
                    "required": ["site_id", "field"],
                },
            },
            {
                "name": "run_cycle",
                "description": "Trigger the CEREBRO autonomous strategy loop for the site.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "site_id": {"type": "string"},
                        "goal_id": {"type": "string", "description": "Optional: focus on a specific goal"},
                    },
                    "required": ["site_id"],
                },
            },
        ]

    # ─── Tool execution ───────────────────────────────────────────────────────

    async def _execute_tool(self, tool_name: str, tool_input: dict, site_id: str = "") -> str:
        # Always inject the stream's site_id if Claude omitted it or passed a wrong one
        if site_id and not tool_input.get("site_id"):
            tool_input = {**tool_input, "site_id": site_id}
        try:
            if tool_name == "get_leads":
                days = tool_input.get("days", 7)
                since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
                leads = await db.query("leads", params={
                    "select": "*",
                    "site_id": f"eq.{tool_input['site_id']}",
                    "created_at": f"gte.{since}",
                    "order": "created_at.desc",
                    "limit": "20",
                })
                return json.dumps({"count": len(leads), "leads": leads[:15]}, default=str)

            elif tool_name == "get_content_performance":
                try:
                    from packages.intelligence.performance_analyzer import analyze_content_performance
                    perf = await analyze_content_performance(tool_input["site_id"])
                    return json.dumps(perf, default=str, ensure_ascii=False)
                except Exception:
                    pass
                articles = await db.query("content_assets", params={
                    "select": "id,title,slug,status,quality_score,created_at",
                    "site_id": f"eq.{tool_input['site_id']}",
                    "order": "created_at.desc",
                    "limit": "20",
                })
                result = []
                for a in articles[:10]:
                    try:
                        article_leads = await db.query("leads", params={"select": "id", "asset_id": f"eq.{a['id']}"})
                        result.append({**a, "leads_generated": len(article_leads)})
                    except Exception:
                        result.append({**a, "leads_generated": 0})
                return json.dumps(sorted(result, key=lambda x: x["leads_generated"], reverse=True), default=str)

            elif tool_name == "generate_content":
                # Call the content router via internal HTTP
                api_url = "http://localhost:8000"
                headers = {}
                if config.API_SECRET_KEY:
                    headers["X-API-Key"] = config.API_SECRET_KEY
                async with httpx.AsyncClient(timeout=300.0) as client:
                    resp = await client.post(
                        f"{api_url}/api/content/generate",
                        json={"keyword": tool_input["keyword"], "site_id": tool_input["site_id"]},
                        headers=headers,
                    )
                if resp.status_code == 200:
                    data = resp.json()
                    return json.dumps({"status": "generated", "id": data.get("id"), "title": data.get("title")})
                return json.dumps({"status": "error", "code": resp.status_code, "detail": resp.text[:300]})

            elif tool_name == "approve_content":
                await db.update("content_assets", tool_input["article_id"], {"status": "approved"})
                return json.dumps({"status": "approved", "id": tool_input["article_id"]})

            elif tool_name == "query_data":
                params: dict = {"select": "*", "limit": str(tool_input.get("limit", 10))}
                for k, v in (tool_input.get("filters") or {}).items():
                    if k not in ("select", "limit", "order"):
                        params[k] = f"eq.{v}"
                rows = await db.query(tool_input["table"], params=params)
                return json.dumps(rows[:10], default=str)

            elif tool_name == "create_experiment":
                exp = await db.insert("experiments", {
                    "site_id":        tool_input["site_id"],
                    "hypothesis":     tool_input["hypothesis"],
                    "target_metric":  tool_input.get("target_metric", "leads"),
                    "status":         "planned",
                    "variant_a_json": {},
                    "variant_b_json": {},
                    "run_window_days": 14,
                    "outcome_json":   {},
                })
                return json.dumps({"status": "created", "id": exp.get("id"), "hypothesis": tool_input["hypothesis"]})

            elif tool_name == "explain_metric":
                site_id = tool_input["site_id"]
                week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                leads = await db.query("leads", params={"select": "id,intent_score", "site_id": f"eq.{site_id}", "created_at": f"gte.{week_ago}"})
                articles = await db.query("content_assets", params={"select": "id", "site_id": f"eq.{site_id}", "status": "eq.approved"})
                avg_intent = round(sum(l.get("intent_score", 0) for l in leads) / len(leads), 1) if leads else 0
                return json.dumps({
                    "metric": tool_input["metric_name"],
                    "context": {
                        "leads_this_week":    len(leads),
                        "avg_intent_score":   avg_intent,
                        "published_articles": len(articles),
                    },
                })

            elif tool_name == "update_intelligence":
                sid = tool_input.get("site_id", "")
                field = tool_input.get("field", "")
                action = tool_input.get("action", "add")
                item_name = tool_input.get("item_name", "")

                field_to_entity = {"competitors": "competitor", "pain_points": "pain_point", "objections": "objection", "segments": "segment"}
                field_to_fact = {"content_angles": "content", "buying_triggers": "trigger", "market_trends": "market", "key_differentiators": "differentiator", "value_proposition": "positioning"}

                if field in field_to_entity and action in ("add", "array_add") and item_name:
                    et = field_to_entity[field]
                    slug = re.sub(r'[^a-z0-9-]', '', item_name.lower().strip().replace(" ", "-"))[:50]
                    try:
                        existing = await db.query("intelligence_entities", params={"select": "id", "site_id": f"eq.{sid}", "entity_type": f"eq.{et}", "slug": f"eq.{slug}", "limit": "1"})
                        if not existing:
                            await db.insert("intelligence_entities", {"site_id": sid, "entity_type": et, "name": item_name.strip(), "slug": slug, "status": "active"})
                        return json.dumps({"status": "updated", "field": field, "action": action})
                    except Exception as e:
                        return json.dumps({"status": "error", "detail": str(e)})
                elif field in field_to_fact and item_name:
                    cat = field_to_fact[field]
                    fk = f"{cat}.manual.{re.sub(r'[^a-z0-9-]', '', item_name.lower().replace(' ', '-'))[:30]}"
                    try:
                        await db.rpc("upsert_intelligence_fact", {"p_site_id": sid, "p_entity_id": None, "p_fact_key": fk, "p_category": cat, "p_value_text": item_name.strip(), "p_value_number": None, "p_value_json": None, "p_confidence": 0.8, "p_tags": ["manual", cat], "p_source": "manual", "p_quarantined": False, "p_source_ref": "chat-tool"})
                        return json.dumps({"status": "updated", "field": field, "action": action})
                    except Exception as e:
                        return json.dumps({"status": "error", "detail": str(e)})
                else:
                    return json.dumps({"status": "error", "detail": f"Unknown field: {field}"})

            elif tool_name == "run_cycle":
                api_url = "http://localhost:8000"
                headers = {}
                if config.API_SECRET_KEY:
                    headers["X-API-Key"] = config.API_SECRET_KEY
                body = {"site_id": tool_input["site_id"]}
                if tool_input.get("goal_id"):
                    body["goal_id"] = tool_input["goal_id"]
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(f"{api_url}/api/loop/run", json=body, headers=headers)
                return json.dumps({"status": "triggered", "response": resp.json() if resp.status_code == 200 else resp.text[:200]})

            return json.dumps({"error": f"Unknown tool: {tool_name}"})

        except Exception as e:
            logger.error(f"Tool {tool_name} failed: {e}")
            return json.dumps({"error": str(e)})

    # ─── Streaming entry point ────────────────────────────────────────────────

    async def process_message_stream(
        self,
        site_id: str,
        conversation_id: Optional[str],
        message: str,
    ) -> AsyncGenerator[str, None]:
        """
        Yields SSE lines:
          data: {"type":"action","tool":"...","input":{...}}
          data: {"type":"text","delta":"..."}
          data: {"type":"done","conversation_id":"..."}
          data: {"type":"error","message":"..."}
        """
        def sse(obj: dict) -> str:
            return f"data: {json.dumps(obj, default=str)}\n\n"

        # ── Load / create conversation ────────────────────────────────────────
        conv = None
        if conversation_id:
            try:
                rows = await db.query("conversations", params={"select": "*", "id": f"eq.{conversation_id}", "limit": "1"})
                conv = rows[0] if rows else None
            except Exception:
                pass

        if not conv:
            try:
                conv = await db.insert("conversations", {
                    "site_id":  site_id,
                    "title":    message[:60] + ("…" if len(message) > 60 else ""),
                    "messages": [],
                })
            except Exception as e:
                yield sse({"type": "error", "message": f"Could not create conversation: {e}"})
                return

        conversation_id = conv["id"]
        history: list = conv.get("messages") or []

        # ── Build system prompt ───────────────────────────────────────────────
        try:
            system = await self.build_system_prompt(site_id)
        except Exception as e:
            logger.error(f"build_system_prompt error: {e}")
            system = "Eres CEREBRO, el asistente de crecimiento de este negocio."

        # ── Build message history for Claude ──────────────────────────────────
        api_messages = [
            {"role": m["role"], "content": m["content"]}
            for m in history[-20:]
        ]
        api_messages.append({"role": "user", "content": message})

        # ── Phase 1: Call Claude with tools ───────────────────────────────────
        actions_taken = []
        final_text = ""

        _anthropic_headers = {
            "x-api-key":         config.ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "content-type":      "application/json",
        }

        async def _anthropic_post(payload: dict) -> httpx.Response:
            async with httpx.AsyncClient(timeout=120.0) as client:
                return await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers=_anthropic_headers,
                    json=payload,
                )

        try:
            # Phase 1 — with keepalive pings so Railway doesn't timeout
            _task = asyncio.ensure_future(_anthropic_post({
                "model":      CLAUDE_MODEL,
                "max_tokens": 4096,
                "system":     system,
                "tools":      self.define_tools(),
                "messages":   api_messages,
            }))
            while True:
                done, _ = await asyncio.wait({_task}, timeout=10.0)
                if done:
                    resp = _task.result()
                    break
                yield sse({"type": "ping"})

            if resp.status_code >= 400:
                yield sse({"type": "error", "message": f"Anthropic API error {resp.status_code}: {resp.text[:200]}"})
                return

            data = resp.json()
            content_blocks = data.get("content", [])
            stop_reason    = data.get("stop_reason")

            # ── Execute tool calls if any ─────────────────────────────────────
            if stop_reason == "tool_use":
                tool_results = []

                for block in content_blocks:
                    if block.get("type") != "tool_use":
                        continue
                    tool_name    = block["name"]
                    tool_input   = block.get("input", {})
                    tool_use_id  = block["id"]

                    yield sse({"type": "action", "tool": tool_name, "input": tool_input})

                    result = await self._execute_tool(tool_name, tool_input, site_id=site_id)
                    actions_taken.append({"tool": tool_name, "input": tool_input, "result": result})
                    tool_results.append({
                        "type":        "tool_result",
                        "tool_use_id": tool_use_id,
                        "content":     result,
                    })

                # Call Claude again with tool results — also with keepalive pings
                api_messages.append({"role": "assistant", "content": content_blocks})
                api_messages.append({"role": "user",      "content": tool_results})

                _task2 = asyncio.ensure_future(_anthropic_post({
                    "model":      CLAUDE_MODEL,
                    "max_tokens": 4096,
                    "system":     system,
                    "messages":   api_messages,
                }))
                while True:
                    done, _ = await asyncio.wait({_task2}, timeout=10.0)
                    if done:
                        resp2 = _task2.result()
                        break
                    yield sse({"type": "ping"})

                if resp2.status_code >= 400:
                    yield sse({"type": "error", "message": f"API error on follow-up: {resp2.status_code}"})
                    return

                data2      = resp2.json()
                final_text = "".join(b["text"] for b in data2.get("content", []) if b.get("type") == "text")

            else:
                final_text = "".join(b["text"] for b in content_blocks if b.get("type") == "text")

        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            yield sse({"type": "error", "message": str(e)})
            return

        # ── Phase 2: Stream final text word by word ───────────────────────────
        words = final_text.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == 0 else " " + word
            yield sse({"type": "text", "delta": chunk})
            await asyncio.sleep(0.018)  # ~55 words/second

        # ── Persist conversation ──────────────────────────────────────────────
        now = datetime.now(timezone.utc).isoformat()
        history.append({"role": "user",      "content": message,    "timestamp": now})
        history.append({"role": "assistant", "content": final_text, "timestamp": now, "actions_taken": actions_taken})

        try:
            await db.update("conversations", conversation_id, {"messages": history, "updated_at": now})
        except Exception as e:
            logger.error(f"Failed to save conversation {conversation_id}: {e}")

        yield sse({"type": "done", "conversation_id": conversation_id})

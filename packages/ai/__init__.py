"""
CEREBRO v7 — AI Client
Multi-provider LLM client: Anthropic, OpenAI, DeepSeek.
All calls go through complete(). Cost tracking + circuit breaker built in.

Provider routing by pipeline_step (default overridable via provider= param):
  brief, humanize  → deepseek  (cheapest)
  draft            → openai    (quality)
  strategy_*       → anthropic (best reasoning)
  everything else  → anthropic (fallback)
"""
import asyncio
import json
import re
import httpx
from typing import Optional
from packages.core import config, cost_tracker, get_logger

logger = get_logger("ai")

# ── Model aliases ────────────────────────────────────────────────────────────
MODELS = {
    # Anthropic
    "haiku":  "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-20250514",
    # OpenAI
    "gpt4o":       "gpt-4o",
    "gpt4o-mini":  "gpt-4o-mini",
    # DeepSeek
    "deepseek":      "deepseek-chat",
    "deepseek-r1":   "deepseek-reasoner",
}

# ── Cost per 1K tokens (USD) ─────────────────────────────────────────────────
COST_PER_1K = {
    "claude-haiku-4-5-20251001":  {"input": 0.0008,  "output": 0.004},
    "claude-sonnet-4-20250514":   {"input": 0.003,   "output": 0.015},
    "gpt-4o":                     {"input": 0.0025,  "output": 0.010},
    "gpt-4o-mini":                {"input": 0.00015, "output": 0.0006},
    "deepseek-chat":              {"input": 0.00014, "output": 0.00028},
    "deepseek-reasoner":          {"input": 0.00055, "output": 0.00219},
}

# ── Default provider per pipeline step ───────────────────────────────────────
_STEP_PROVIDER = {
    "brief":               "deepseek",
    "humanize":            "deepseek",
    "draft":               "openai",
    "strategy_generation": "anthropic",
    "strategy_simulation": "anthropic",
}

_STEP_MODEL = {
    "brief":               "deepseek-chat",
    "humanize":            "deepseek-chat",
    "draft":               "gpt-4o",
    "strategy_generation": "claude-sonnet-4-20250514",
    "strategy_simulation": "claude-sonnet-4-20250514",
}


def _resolve(model: str, pipeline_step: str | None, provider: str | None):
    """Return (provider, model_id) for the call."""
    # If caller set explicit provider, honour it
    if provider:
        model_id = MODELS.get(model, model)
        return provider, model_id

    # Route by pipeline step
    if pipeline_step and pipeline_step in _STEP_PROVIDER:
        prov = _STEP_PROVIDER[pipeline_step]
        # Use step-preferred model unless caller passed a specific alias
        if model in ("haiku", "sonnet"):          # generic aliases → use step default
            model_id = _STEP_MODEL[pipeline_step]
        else:
            model_id = MODELS.get(model, model)
        return prov, model_id

    # Default: anthropic with resolved model
    return "anthropic", MODELS.get(model, model)


# ── Public API ────────────────────────────────────────────────────────────────

async def complete(
    prompt: str,
    system: str = "",
    model: str = "haiku",
    max_tokens: int = 2048,
    temperature: float = 0.7,
    json_mode: bool = False,
    pipeline_step: str = None,
    run_id: str = None,
    provider: str = None,      # "anthropic" | "openai" | "deepseek" | None (auto)
    _retry: int = 1,
) -> dict:
    """Call an LLM with automatic cost tracking.

    Returns: {"text": str, "parsed": dict|None, "tokens_in": int, "tokens_out": int, "cost": float}
    """
    if not await cost_tracker.can_spend():
        raise BudgetExceededError("Daily LLM budget exceeded")

    prov, model_id = _resolve(model, pipeline_step, provider)

    if json_mode:
        system += "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks, no text before or after."

    logger.debug(f"[{run_id or '-'}] {prov}/{model_id} step={pipeline_step}")

    if prov == "anthropic":
        return await _call_anthropic(prompt, system, model_id, max_tokens, temperature,
                                     json_mode, pipeline_step, run_id, _retry)
    elif prov == "openai":
        return await _call_openai(prompt, system, model_id, max_tokens, temperature,
                                  json_mode, pipeline_step, run_id, _retry)
    elif prov == "deepseek":
        return await _call_deepseek(prompt, system, model_id, max_tokens, temperature,
                                    json_mode, pipeline_step, run_id, _retry)
    else:
        raise AIError(f"Unknown provider: {prov}")


# ── Anthropic ─────────────────────────────────────────────────────────────────

async def _call_anthropic(prompt, system, model_id, max_tokens, temperature,
                           json_mode, pipeline_step, run_id, _retry):
    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": config.ANTHROPIC_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model_id,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        except httpx.TimeoutException:
            raise AIError("Anthropic request timed out")

    if resp.status_code == 429:
        return await _retry_call(
            _call_anthropic, _retry, prompt, system, model_id, max_tokens,
            temperature, json_mode, pipeline_step, run_id
        )
    if resp.status_code >= 400:
        raise AIError(f"Anthropic {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    text = "".join(b["text"] for b in data.get("content", []) if b.get("type") == "text")
    usage = data.get("usage", {})
    return await _build_result(text, model_id, usage.get("input_tokens", 0),
                               usage.get("output_tokens", 0), json_mode, pipeline_step, run_id)


# ── OpenAI ────────────────────────────────────────────────────────────────────

async def _call_openai(prompt, system, model_id, max_tokens, temperature,
                        json_mode, pipeline_step, run_id, _retry):
    if not config.OPENAI_KEY:
        logger.warning("OPENAI_API_KEY not set, falling back to Anthropic sonnet")
        return await _call_anthropic(prompt, system, "claude-sonnet-4-20250514",
                                     max_tokens, temperature, json_mode, pipeline_step, run_id, _retry)

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    body: dict = {"model": model_id, "max_tokens": max_tokens, "temperature": temperature, "messages": messages}
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {config.OPENAI_KEY}", "Content-Type": "application/json"},
                json=body,
            )
        except httpx.TimeoutException:
            raise AIError("OpenAI request timed out")

    if resp.status_code == 429:
        return await _retry_call(
            _call_openai, _retry, prompt, system, model_id, max_tokens,
            temperature, json_mode, pipeline_step, run_id
        )
    if resp.status_code >= 400:
        raise AIError(f"OpenAI {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return await _build_result(text, model_id, usage.get("prompt_tokens", 0),
                               usage.get("completion_tokens", 0), json_mode, pipeline_step, run_id)


# ── DeepSeek ──────────────────────────────────────────────────────────────────

async def _call_deepseek(prompt, system, model_id, max_tokens, temperature,
                          json_mode, pipeline_step, run_id, _retry):
    if not config.DEEPSEEK_KEY:
        logger.warning("DEEPSEEK_API_KEY not set, falling back to Anthropic haiku")
        return await _call_anthropic(prompt, system, "claude-haiku-4-5-20251001",
                                     max_tokens, temperature, json_mode, pipeline_step, run_id, _retry)

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    body: dict = {"model": model_id, "max_tokens": max_tokens, "temperature": temperature, "messages": messages}
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {config.DEEPSEEK_KEY}", "Content-Type": "application/json"},
                json=body,
            )
        except httpx.TimeoutException:
            raise AIError("DeepSeek request timed out")

    if resp.status_code == 429:
        return await _retry_call(
            _call_deepseek, _retry, prompt, system, model_id, max_tokens,
            temperature, json_mode, pipeline_step, run_id
        )
    if resp.status_code >= 400:
        raise AIError(f"DeepSeek {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return await _build_result(text, model_id, usage.get("prompt_tokens", 0),
                               usage.get("completion_tokens", 0), json_mode, pipeline_step, run_id)


# ── Shared helpers ────────────────────────────────────────────────────────────

async def _retry_call(fn, _retry, prompt, system, model_id, max_tokens,
                      temperature, json_mode, pipeline_step, run_id):
    if _retry > 0:
        wait = 30  # fixed 30s wait — avoids cascading 60+120+180s pile-ups with 24 concurrent articles
        logger.warning(f"Rate limited. Retrying in {wait}s ({_retry} retries left)...")
        await asyncio.sleep(wait)
        return await fn(prompt, system, model_id, max_tokens, temperature,
                        json_mode, pipeline_step, run_id, _retry - 1)
    raise RateLimitError(f"Rate limit exceeded after retries")


async def _build_result(text: str, model_id: str, tokens_in: int, tokens_out: int,
                         json_mode: bool, pipeline_step: str, run_id: str) -> dict:
    rates = COST_PER_1K.get(model_id, {"input": 0.003, "output": 0.015})
    cost = (tokens_in / 1000 * rates["input"]) + (tokens_out / 1000 * rates["output"])
    await cost_tracker.log(model_id, tokens_in, tokens_out, cost, pipeline_step, run_id)
    logger.info(f"LLM cost: ${cost:.4f} ({model_id}, {tokens_in}+{tokens_out} tokens, step={pipeline_step})")
    result = {"text": text, "tokens_in": tokens_in, "tokens_out": tokens_out, "cost": cost, "parsed": None}
    if json_mode:
        result["parsed"] = _parse_json(text)
    return result


def _parse_json(text: str) -> Optional[dict]:
    for attempt in [
        lambda: json.loads(text),
        lambda: json.loads(re.search(r'```(?:json)?\s*([\s\S]*?)```', text).group(1)),
        lambda: json.loads(re.search(r'\{[\s\S]*\}', text).group()),
        lambda: json.loads(re.search(r'\[[\s\S]*\]', text).group()),
    ]:
        try:
            return attempt()
        except (json.JSONDecodeError, AttributeError):
            continue
    logger.warning(f"Could not parse JSON from LLM response: {text[:200]}...")
    return None


# ── Exceptions ────────────────────────────────────────────────────────────────

class AIError(Exception):
    pass

class BudgetExceededError(AIError):
    pass

class RateLimitError(AIError):
    pass

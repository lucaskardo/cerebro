"""
CEREBRO v7 — AI Client
All LLM calls go through here.
"""
import json
import re
import httpx
from typing import Optional
from packages.core import config, cost_tracker, get_logger

logger = get_logger("ai")

MODELS = {
    "haiku": "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-20250514",
}

COST_PER_1K = {
    "claude-haiku-4-5-20251001": {"input": 0.0008, "output": 0.004},
    "claude-sonnet-4-20250514": {"input": 0.003, "output": 0.015},
}


async def complete(
    prompt: str,
    system: str = "",
    model: str = "haiku",
    max_tokens: int = 2048,
    temperature: float = 0.7,
    json_mode: bool = False,
    pipeline_step: str = None,
    run_id: str = None,
) -> dict:
    if not await cost_tracker.can_spend():
        raise BudgetExceededError("Daily LLM budget exceeded")

    model_id = MODELS.get(model, model)

    if json_mode:
        system += "\n\nResponde SOLO con JSON válido. Sin markdown, sin backticks, sin texto extra."

    async with httpx.AsyncClient(timeout=120.0) as client:
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

    if resp.status_code == 429:
        raise RateLimitError("Rate limit hit")
    if resp.status_code >= 400:
        raise AIError(f"API {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    text = "".join(b["text"] for b in data.get("content", []) if b.get("type") == "text")

    usage = data.get("usage", {})
    tin = usage.get("input_tokens", 0)
    tout = usage.get("output_tokens", 0)
    rates = COST_PER_1K.get(model_id, {"input": 0.003, "output": 0.015})
    cost = (tin / 1000 * rates["input"]) + (tout / 1000 * rates["output"])

    await cost_tracker.log(model_id, tin, tout, cost, pipeline_step, run_id)

    result = {"text": text, "tokens_in": tin, "tokens_out": tout, "cost": cost, "parsed": None}
    if json_mode:
        result["parsed"] = _parse_json(text)
    return result


def _parse_json(text: str) -> Optional[dict]:
    for fn in [
        lambda: json.loads(text),
        lambda: json.loads(re.search(r'```(?:json)?\s*([\s\S]*?)```', text).group(1)),
        lambda: json.loads(re.search(r'\{[\s\S]*\}', text).group()),
    ]:
        try:
            return fn()
        except (json.JSONDecodeError, AttributeError):
            continue
    logger.warning(f"JSON parse failed: {text[:150]}...")
    return None


class AIError(Exception):
    pass

class BudgetExceededError(AIError):
    pass

class RateLimitError(AIError):
    pass

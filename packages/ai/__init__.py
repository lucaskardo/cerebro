"""
CEREBRO v7 — AI Client
All LLM calls go through here. Cost tracking + circuit breaker built in.
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
    """Call Claude API with automatic cost tracking.
    
    Returns: {"text": str, "parsed": dict|None, "tokens_in": int, "tokens_out": int, "cost": float}
    """
    # Budget check
    if not await cost_tracker.can_spend():
        raise BudgetExceededError("Daily LLM budget exceeded")
    
    model_id = MODELS.get(model, model)
    
    if json_mode:
        system += "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks, no text before or after."
    
    async with httpx.AsyncClient(timeout=120.0) as client:
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
            raise AIError("LLM request timed out (120s)")
    
    if resp.status_code == 429:
        raise RateLimitError("Anthropic rate limit")
    if resp.status_code >= 400:
        raise AIError(f"API {resp.status_code}: {resp.text[:300]}")
    
    data = resp.json()
    text = "".join(b["text"] for b in data.get("content", []) if b.get("type") == "text")
    
    usage = data.get("usage", {})
    tokens_in = usage.get("input_tokens", 0)
    tokens_out = usage.get("output_tokens", 0)
    rates = COST_PER_1K.get(model_id, {"input": 0.003, "output": 0.015})
    cost = (tokens_in / 1000 * rates["input"]) + (tokens_out / 1000 * rates["output"])
    
    # Track cost
    await cost_tracker.log(model_id, tokens_in, tokens_out, cost, pipeline_step, run_id)
    
    result = {"text": text, "tokens_in": tokens_in, "tokens_out": tokens_out, "cost": cost, "parsed": None}
    
    if json_mode:
        result["parsed"] = _parse_json(text)
    
    return result


def _parse_json(text: str) -> Optional[dict]:
    """Robustly extract JSON from LLM output."""
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


class AIError(Exception):
    pass

class BudgetExceededError(AIError):
    pass

class RateLimitError(AIError):
    pass

"""
CEREBRO v7 — Core Package
Database client, configuration, logging, shared utilities.
"""
import os
import logging
from datetime import date
from typing import Optional
import httpx


# ============================================
# CONFIG — reads env at access time (not import time)
# so dotenv loading in main.py works correctly
# ============================================
class Config:
    @property
    def SUPABASE_URL(self): return os.getenv("SUPABASE_URL", "")
    @property
    def SUPABASE_KEY(self): return os.getenv("SUPABASE_SERVICE_KEY", "")
    @property
    def ANTHROPIC_KEY(self): return os.getenv("ANTHROPIC_API_KEY", "")
    @property
    def SERPAPI_KEY(self): return os.getenv("SERPAPI_KEY", "")
    @property
    def DAILY_BUDGET(self): return float(os.getenv("DAILY_BUDGET_USD", "30.0"))
    @property
    def PRIMARY_DOMAIN(self): return os.getenv("PRIMARY_DOMAIN", "dolarafuera.co")
    @property
    def AUTO_PUBLISH(self): return os.getenv("ENABLE_AUTO_PUBLISH", "false").lower() == "true"
    @property
    def DEMAND_ENGINE(self): return os.getenv("ENABLE_DEMAND_ENGINE", "false").lower() == "true"
    @property
    def AUTOLOOP(self): return os.getenv("ENABLE_AUTOLOOP", "false").lower() == "true"
    @property
    def SOCIAL_ENGINE(self): return os.getenv("ENABLE_SOCIAL_ENGINE", "false").lower() == "true"

config = Config()


# ============================================
# LOGGER
# ============================================
def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(f"cerebro.{name}")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(name)s] %(levelname)s: %(message)s",
            datefmt="%H:%M:%S"
        ))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


# ============================================
# SUPABASE CLIENT
# ============================================
class SupabaseClient:
    def __init__(self):
        self.logger = get_logger("db")

    @property
    def _url(self):
        return config.SUPABASE_URL.rstrip("/")

    @property
    def _headers(self):
        return {
            "apikey": config.SUPABASE_KEY,
            "Authorization": f"Bearer {config.SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def query(self, table: str, method: str = "GET",
                    params: dict = None, body: dict = None) -> list:
        url = f"{self._url}/rest/v1/{table}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if method == "GET":
                    resp = await client.get(url, headers=self._headers, params=params or {})
                elif method == "POST":
                    resp = await client.post(url, headers=self._headers, json=body)
                elif method == "PATCH":
                    resp = await client.patch(url, headers=self._headers, params=params, json=body)
                elif method == "DELETE":
                    resp = await client.delete(url, headers=self._headers, params=params)
                else:
                    raise ValueError(f"Unsupported: {method}")

                if resp.status_code >= 400:
                    self.logger.error(f"DB {method} {table}: {resp.status_code} {resp.text[:300]}")
                    return []
                return resp.json() if resp.text.strip() else []
            except httpx.TimeoutException:
                self.logger.error(f"DB timeout: {method} {table}")
                return []
            except Exception as e:
                self.logger.error(f"DB error: {e}")
                return []

    async def get(self, table: str, **filters) -> list:
        params = {"select": "*"}
        params.update(filters)
        return await self.query(table, "GET", params=params)

    async def get_by_id(self, table: str, id: str) -> Optional[dict]:
        results = await self.get(table, id=f"eq.{id}")
        return results[0] if results else None

    async def insert(self, table: str, data: dict) -> Optional[dict]:
        results = await self.query(table, "POST", body=data)
        return results[0] if results else None

    async def update(self, table: str, id: str, data: dict) -> Optional[dict]:
        results = await self.query(table, "PATCH", params={"id": f"eq.{id}"}, body=data)
        return results[0] if results else None

db = SupabaseClient()


# ============================================
# COST TRACKER
# ============================================
class CostTracker:
    def __init__(self):
        self.logger = get_logger("costs")

    async def get_today_total(self) -> float:
        today = date.today().isoformat()
        results = await db.query("cost_events", params={
            "select": "cost_usd",
            "created_at": f"gte.{today}T00:00:00Z",
        })
        return sum(float(r.get("cost_usd", 0)) for r in results)

    async def check_budget(self) -> dict:
        total = await self.get_today_total()
        limit = config.DAILY_BUDGET
        remaining = limit - total
        return {
            "spent": round(total, 4),
            "limit": limit,
            "remaining": round(max(0, remaining), 4),
            "percent": round((total / limit) * 100, 1) if limit > 0 else 0,
            "blocked": remaining <= 0,
            "warning": remaining < limit * 0.2,
        }

    async def can_spend(self) -> bool:
        b = await self.check_budget()
        if b["blocked"]:
            self.logger.warning(f"BUDGET BLOCKED: ${b['spent']:.2f} / ${b['limit']:.2f}")
        return not b["blocked"]

    async def log(self, model: str, tokens_in: int, tokens_out: int, cost: float,
                  pipeline_step: str = None, run_id: str = None):
        await db.insert("cost_events", {
            "service": "anthropic", "model": model,
            "tokens_in": tokens_in, "tokens_out": tokens_out,
            "cost_usd": cost, "pipeline_step": pipeline_step, "run_id": run_id,
        })
        self.logger.info(f"${cost:.4f} | {model} | {tokens_in}→{tokens_out} tok | {pipeline_step}")

cost_tracker = CostTracker()


# ============================================
# ALERTS
# ============================================
async def create_alert(alert_type: str, message: str, severity: str = "info",
                       action_url: str = None, action_label: str = None):
    await db.insert("operator_alerts", {
        "alert_type": alert_type, "severity": severity,
        "message": message, "action_url": action_url, "action_label": action_label,
    })

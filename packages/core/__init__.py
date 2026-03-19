"""
CEREBRO v7 — Core Package
Database client, configuration, logging, shared utilities.
"""
import os
import logging
from datetime import date, datetime
from typing import Optional
import httpx

# ============================================
# CONFIG
# ============================================
class SupabaseError(Exception):
    """Raised when Supabase returns a 4xx/5xx response."""
    pass

class SupabaseTimeout(Exception):
    """Raised when a Supabase request times out."""
    pass


class Config:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    ANTHROPIC_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OPENAI_KEY: str = os.getenv("OPENAI_API_KEY", "")
    DEEPSEEK_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    SERPAPI_KEY: str = os.getenv("SERPAPI_KEY", "")
    RESEND_KEY: str = os.getenv("RESEND_API_KEY", "")
    GEMINI_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")   # Fernet key for credential encryption
    MASTER_KEY: str = os.getenv("MASTER_KEY", "")            # Master key to reveal passwords
    API_SECRET_KEY: str = os.getenv("API_SECRET_KEY", "")   # X-API-Key for dashboard mutations
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "")  # Comma-separated extra origins
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "carlos@dolarafuera.co")
    DAILY_BUDGET: float = float(os.getenv("DAILY_BUDGET_USD", "30.0"))
    PRIMARY_DOMAIN: str = os.getenv("PRIMARY_DOMAIN", "dolarafuera.co")
    
    # Feature flags
    AUTO_PUBLISH: bool = os.getenv("ENABLE_AUTO_PUBLISH", "false").lower() == "true"
    DEMAND_ENGINE: bool = os.getenv("ENABLE_DEMAND_ENGINE", "false").lower() == "true"
    AUTOLOOP: bool = os.getenv("ENABLE_AUTOLOOP", "false").lower() == "true"
    SOCIAL_ENGINE: bool = os.getenv("ENABLE_SOCIAL_ENGINE", "false").lower() == "true"
    LOOP_SCHEDULER_ENABLED: bool = os.getenv("LOOP_SCHEDULER_ENABLED", "false").lower() == "true"

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
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger

# ============================================
# SUPABASE CLIENT
# ============================================
class SupabaseClient:
    """Async Supabase REST client."""
    
    def __init__(self, url: str = None, key: str = None):
        self.url = (url or config.SUPABASE_URL).rstrip("/")
        self.key = key or config.SUPABASE_KEY
        self.logger = get_logger("db")
    
    @property
    def _headers(self):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    async def query(self, table: str, method: str = "GET", 
                    params: dict = None, body: dict = None) -> list:
        """Execute a Supabase REST query."""
        url = f"{self.url}/rest/v1/{table}"
        
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
                    raise ValueError(f"Unsupported method: {method}")
                
                if resp.status_code >= 400:
                    msg = f"Supabase {method} {table}: HTTP {resp.status_code} — {resp.text[:200]}"
                    self.logger.error(msg)
                    raise SupabaseError(msg)

                return resp.json() if resp.text else []

            except httpx.TimeoutException:
                msg = f"Supabase timeout: {method} {table}"
                self.logger.error(msg)
                raise SupabaseTimeout(msg)
            except (SupabaseError, SupabaseTimeout):
                raise
            except Exception as e:
                msg = f"Supabase unexpected error on {method} {table}: {e}"
                self.logger.error(msg)
                raise SupabaseError(msg) from e
    
    async def get(self, table: str, **filters) -> list:
        """Simple GET with filters. Usage: db.get("missions", status="eq.active")"""
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
    
    async def delete(self, table: str, id: str) -> bool:
        await self.query(table, "DELETE", params={"id": f"eq.{id}"})
        return True

    async def delete_where(self, table: str, filters: dict) -> int:
        """DELETE rows matching filters. Returns count of deleted rows."""
        headers = {**self._headers, "Prefer": "return=representation,count=exact"}
        url = f"{self.url}/rest/v1/{table}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.delete(url, headers=headers, params=filters)
                if resp.status_code >= 400:
                    raise SupabaseError(f"DELETE {table}: HTTP {resp.status_code} — {resp.text[:200]}")
                rows = resp.json() if resp.text else []
                return len(rows)
            except (SupabaseError, SupabaseTimeout):
                raise
            except Exception as e:
                raise SupabaseError(f"delete_where {table}: {e}") from e

    async def count(self, table: str, params: dict = None) -> int:
        """Return row count matching params using PostgREST HEAD + count=exact."""
        headers = {**self._headers, "Prefer": "count=exact"}
        url = f"{self.url}/rest/v1/{table}"
        query_params = {"select": "id", **(params or {})}
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.get(url, headers=headers, params=query_params)
                if resp.status_code >= 400:
                    raise SupabaseError(f"COUNT {table}: HTTP {resp.status_code}")
                # Content-Range: 0-N/TOTAL
                cr = resp.headers.get("content-range", "")
                if "/" in cr:
                    total = cr.split("/")[-1]
                    return int(total) if total != "*" else len(resp.json() if resp.text else [])
                return len(resp.json() if resp.text else [])
            except (SupabaseError, SupabaseTimeout):
                raise
            except Exception as e:
                raise SupabaseError(f"count {table}: {e}") from e

    async def rpc(self, fn: str, params: dict = None) -> list:
        """Call a Supabase SQL function via RPC. POST /rest/v1/rpc/<fn>"""
        url = f"{self.url}/rest/v1/rpc/{fn}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(url, headers=self._headers, json=params or {})
                if resp.status_code >= 400:
                    msg = f"RPC {fn}: HTTP {resp.status_code} — {resp.text[:200]}"
                    self.logger.error(msg)
                    raise SupabaseError(msg)
                return resp.json() if resp.text else []
            except httpx.TimeoutException:
                raise SupabaseTimeout(f"RPC timeout: {fn}")
            except (SupabaseError, SupabaseTimeout):
                raise
            except Exception as e:
                raise SupabaseError(f"RPC {fn}: {e}") from e

# Singleton
db = SupabaseClient()

# ============================================
# COST TRACKER (Circuit Breaker)
# ============================================
class CostTracker:
    """Tracks LLM costs and enforces daily budget."""
    
    def __init__(self):
        self.logger = get_logger("costs")
    
    async def get_today_total(self) -> float:
        today = date.today().isoformat()
        results = await db.query("cost_events", params={
            "select": "cost_usd",
            "created_at": f"gte.{today}T00:00:00Z"
        })
        return sum(r.get("cost_usd", 0) for r in results)
    
    async def check_budget(self) -> dict:
        total = await self.get_today_total()
        remaining = config.DAILY_BUDGET - total
        return {
            "spent": round(total, 4),
            "limit": config.DAILY_BUDGET,
            "remaining": round(max(0, remaining), 4),
            "percent": round((total / config.DAILY_BUDGET) * 100, 1) if config.DAILY_BUDGET > 0 else 0,
            "blocked": remaining <= 0,
            "warning": remaining < config.DAILY_BUDGET * 0.2
        }
    
    async def can_spend(self) -> bool:
        budget = await self.check_budget()
        if budget["blocked"]:
            self.logger.warning(f"BUDGET EXCEEDED: ${budget['spent']:.2f} / ${budget['limit']:.2f}")
        return not budget["blocked"]
    
    async def log(self, model: str, tokens_in: int, tokens_out: int, cost: float, 
                  pipeline_step: str = None, run_id: str = None):
        await db.insert("cost_events", {
            "service": "anthropic",
            "model": model,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_usd": cost,
            "pipeline_step": pipeline_step,
            "run_id": run_id
        })
        self.logger.info(f"LLM cost: ${cost:.4f} ({model}, {tokens_in}+{tokens_out} tokens, step={pipeline_step})")

cost_tracker = CostTracker()

# ============================================
# ALERTS
# ============================================
async def create_alert(alert_type: str, message: str, severity: str = "info", 
                       action_url: str = None, action_label: str = None):
    await db.insert("operator_alerts", {
        "alert_type": alert_type,
        "severity": severity,
        "message": message,
        "action_url": action_url,
        "action_label": action_label
    })

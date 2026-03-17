"""
CEREBRO — Feature Flags
is_enabled(site_id, flag_name) -> bool
Simple DB lookup with in-process cache (TTL 60s).
"""
import time
from packages.core import db, get_logger

logger = get_logger("flags")

# Simple in-process cache: (site_id, flag_name) → (enabled, expires_at)
_cache: dict[tuple, tuple] = {}
_CACHE_TTL = 60  # seconds


async def is_enabled(site_id: str, flag_name: str) -> bool:
    """Return True if the feature flag is enabled for this site."""
    key = (site_id, flag_name)
    now = time.monotonic()

    cached = _cache.get(key)
    if cached and cached[1] > now:
        return cached[0]

    try:
        rows = await db.query("feature_flags", params={
            "select": "enabled",
            "site_id": f"eq.{site_id}",
            "flag_name": f"eq.{flag_name}",
            "limit": "1",
        })
        enabled = rows[0]["enabled"] if rows else False
    except Exception as e:
        logger.warning(f"Flag lookup failed ({flag_name}): {e}")
        enabled = False

    _cache[key] = (enabled, now + _CACHE_TTL)
    return enabled


def invalidate(site_id: str = None, flag_name: str = None):
    """Evict cached entries. Call after updating flags."""
    keys_to_delete = [
        k for k in _cache
        if (site_id is None or k[0] == site_id) and
           (flag_name is None or k[1] == flag_name)
    ]
    for k in keys_to_delete:
        del _cache[k]

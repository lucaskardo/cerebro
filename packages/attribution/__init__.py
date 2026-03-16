"""
CEREBRO — Attribution Tracker
Tracks the full journey: asset → visitor → lead → conversion.
This is how we prove ROI to clients.
"""
from datetime import date, timedelta
from packages.core import db, get_logger

logger = get_logger("attribution")


async def track_event(event_type: str, visitor_id: str = None, session_id: str = None,
                      asset_id: str = None, asset_type: str = None, channel: str = None,
                      utm_source: str = None, utm_medium: str = None, utm_campaign: str = None,
                      metadata: dict = None) -> dict:
    """Track any event in the attribution chain."""
    event = await db.insert("attribution_events", {
        "event_type": event_type,
        "visitor_id": visitor_id,
        "session_id": session_id,
        "asset_id": str(asset_id) if asset_id else None,
        "asset_type": asset_type,
        "channel": channel,
        "utm_source": utm_source,
        "utm_medium": utm_medium,
        "utm_campaign": utm_campaign,
        "metadata": metadata or {},
    })
    return event


async def get_funnel(days: int = 30) -> dict:
    """Get the full funnel for the last N days."""
    since = (date.today() - timedelta(days=days)).isoformat()

    events = await db.query("attribution_events", params={
        "select": "event_type",
        "created_at": f"gte.{since}T00:00:00Z",
    })

    counts = {}
    for e in events:
        t = e["event_type"]
        counts[t] = counts.get(t, 0) + 1

    return {
        "period_days": days,
        "pageviews": counts.get("pageview", 0),
        "clicks": counts.get("click", 0),
        "form_starts": counts.get("form_start", 0),
        "leads_captured": counts.get("lead_capture", 0),
        "conversions": counts.get("conversion", 0),
        "conversion_rate": round(counts.get("conversion", 0) / max(counts.get("lead_capture", 1), 1) * 100, 1),
    }


async def get_channel_report(days: int = 30) -> list[dict]:
    """Which channels produce the most leads."""
    since = (date.today() - timedelta(days=days)).isoformat()

    events = await db.query("attribution_events", params={
        "select": "channel,event_type",
        "created_at": f"gte.{since}T00:00:00Z",
        "event_type": "eq.lead_capture",
    })

    channels = {}
    for e in events:
        ch = e.get("channel") or "direct"
        channels[ch] = channels.get(ch, 0) + 1

    return sorted(
        [{"channel": ch, "leads": count} for ch, count in channels.items()],
        key=lambda x: x["leads"],
        reverse=True,
    )


async def get_attribution_report(days: int = 30) -> dict:
    """Full attribution report for client presentation."""
    funnel = await get_funnel(days)
    channels = await get_channel_report(days)

    # Get total leads and revenue
    since = (date.today() - timedelta(days=days)).isoformat()
    leads = await db.query("leads", params={
        "select": "id,intent_score",
        "created_at": f"gte.{since}T00:00:00Z",
    })

    qualified = [l for l in leads if l.get("intent_score", 0) >= 70]

    deliveries = await db.query("partner_deliveries", params={
        "select": "revenue_usd,accepted",
        "delivered_at": f"gte.{since}T00:00:00Z",
    })

    total_revenue = sum(float(d.get("revenue_usd", 0)) for d in deliveries)
    accepted = sum(1 for d in deliveries if d.get("accepted"))

    return {
        "period_days": days,
        "funnel": funnel,
        "channels": channels,
        "leads_total": len(leads),
        "leads_qualified": len(qualified),
        "leads_delivered": len(deliveries),
        "leads_accepted": accepted,
        "revenue_usd": round(total_revenue, 2),
    }

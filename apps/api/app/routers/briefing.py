"""Briefing router — daily CEO briefing generation and delivery."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from apps.api.app.middleware.auth import require_auth
from packages.core import db, get_logger, config

logger = get_logger("router.briefing")
router = APIRouter(tags=["Briefing"], prefix="/api/briefing")


class BriefingRequest(BaseModel):
    site_id: str
    to_email: Optional[str] = None


@router.post("/generate", dependencies=[Depends(require_auth)])
async def generate_and_send(req: BriefingRequest):
    """Generate and send the daily briefing to the operator email."""
    try:
        from packages.email.daily_briefing import send_daily_briefing
        # Determine recipient: explicit or fall back to EMAIL_FROM config
        to_email = req.to_email or config.EMAIL_FROM
        if not to_email:
            raise HTTPException(400, "No recipient email configured. Pass to_email or set EMAIL_FROM env var.")
        sent = await send_daily_briefing(req.site_id, to_email)
        return {"status": "sent" if sent else "failed", "to": to_email}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Briefing generate+send failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))


@router.post("/preview", dependencies=[Depends(require_auth)])
async def preview_briefing(req: BriefingRequest):
    """Generate but don't send — returns subject, body_html, body_text."""
    try:
        from packages.email.daily_briefing import generate_daily_briefing
        briefing = await generate_daily_briefing(req.site_id)
        return briefing
    except Exception as e:
        logger.error(f"Briefing preview failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))

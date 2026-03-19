"""
CEREBRO — Conversation Router
POST /api/chat/message  → SSE stream
GET  /api/chat/conversations?site_id=X → list
GET  /api/chat/{id}     → full conversation
"""
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from packages.core import db, get_logger
from packages.conversation import ChatEngine

logger = get_logger("conversation_router")
router = APIRouter(prefix="/api/chat", tags=["Chat"])

engine = ChatEngine()


class ChatRequest(BaseModel):
    site_id: str
    message: str
    conversation_id: Optional[str] = None


@router.post("/message")
async def chat_message(req: ChatRequest):
    """Stream a chat response as SSE events."""
    return StreamingResponse(
        engine.process_message_stream(req.site_id, req.conversation_id, req.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/conversations")
async def list_conversations(site_id: str = Query(...), limit: int = Query(30)):
    """List recent conversations for a site, newest first."""
    try:
        rows = await db.query("conversations", params={
            "select": "id,title,created_at,updated_at",
            "site_id": f"eq.{site_id}",
            "order": "updated_at.desc",
            "limit": str(limit),
        })
        return rows or []
    except Exception as e:
        logger.error(f"list_conversations error: {e}")
        return []


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Return a full conversation including all messages."""
    try:
        rows = await db.query("conversations", params={
            "select": "*",
            "id": f"eq.{conversation_id}",
            "limit": "1",
        })
        if not rows:
            return {"error": "Not found"}
        return rows[0]
    except Exception as e:
        logger.error(f"get_conversation error: {e}")
        return {"error": str(e)}

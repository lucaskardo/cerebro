"""Personas, identities, social content queue."""
import secrets
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional

from packages.core import db, config, get_logger
from apps.api.app.middleware.auth import require_auth, audit

logger = get_logger("router.personas")
router = APIRouter()


class PersonaCreate(BaseModel):
    site_id: str
    name: str
    age: Optional[int] = None
    city: Optional[str] = None
    backstory: Optional[str] = None
    personality_traits: dict = {}
    visual_prompt: Optional[str] = None
    platforms: dict = {}
    posting_schedule: dict = {}
    content_ratio: dict = {}
    anti_detection_rules: dict = {}
    status: str = "inactive"


class PersonaUpdate(BaseModel):
    status: Optional[str] = None
    personality_traits: Optional[dict] = None
    platforms: Optional[dict] = None
    posting_schedule: Optional[dict] = None
    content_ratio: Optional[dict] = None
    backstory: Optional[str] = None


class IdentityCreate(BaseModel):
    platform: str
    handle_or_email: Optional[str] = None
    password: Optional[str] = None
    recovery_email: Optional[str] = None
    recovery_phone: Optional[str] = None
    api_keys: dict = {}
    two_factor_secret: Optional[str] = None
    notes: Optional[str] = None
    status: str = "pending_setup"


class IdentityUpdate(BaseModel):
    handle_or_email: Optional[str] = None
    password: Optional[str] = None
    recovery_email: Optional[str] = None
    recovery_phone: Optional[str] = None
    api_keys: Optional[dict] = None
    two_factor_secret: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class PersonaEmailSend(BaseModel):
    to: str
    subject: str
    html: str


class QueueItemUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None


DEFAULT_PLATFORMS = ["instagram", "tiktok", "x", "reddit", "linkedin", "whatsapp", "email"]


def _check_master_key(request: Request):
    provided = request.headers.get("x-master-key", "")
    if not config.MASTER_KEY:
        raise HTTPException(503, "MASTER_KEY not configured")
    if not secrets.compare_digest(provided, config.MASTER_KEY):
        raise HTTPException(403, "Invalid master key")


# ─── Personas ────────────────────────────────────────────────────────────────

@router.get("/api/personas")
async def list_personas(site_id: Optional[str] = None, status: Optional[str] = None):
    params = {"select": "*", "order": "created_at.asc"}
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    if status:
        params["status"] = f"eq.{status}"
    return await db.query("personas", params=params)


@router.post("/api/personas")
async def create_persona(req: PersonaCreate, request: Request, _auth=Depends(require_auth)):
    persona = await db.insert("personas", {
        "site_id": req.site_id,
        "name": req.name,
        "age": req.age,
        "city": req.city,
        "backstory": req.backstory,
        "personality_traits": req.personality_traits,
        "visual_prompt": req.visual_prompt,
        "platforms": req.platforms,
        "posting_schedule": req.posting_schedule,
        "content_ratio": req.content_ratio,
        "anti_detection_rules": req.anti_detection_rules,
        "status": req.status,
    })
    if not persona:
        raise HTTPException(500, "Failed to create persona")

    for plat in DEFAULT_PLATFORMS:
        await db.insert("persona_identities", {
            "persona_id": persona["id"],
            "platform": plat,
            "status": "pending_setup",
        })

    await audit(request, "create_persona", "personas", persona["id"], {"name": req.name})
    return persona


@router.get("/api/personas/{pid}")
async def get_persona(pid: str):
    p = await db.get_by_id("personas", pid)
    if not p:
        raise HTTPException(404, "Persona not found")
    return p


@router.patch("/api/personas/{pid}")
async def update_persona(pid: str, req: PersonaUpdate, request: Request,
                          _auth=Depends(require_auth)):
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields to update")
    p = await db.update("personas", pid, data)
    if not p:
        raise HTTPException(404, "Persona not found")
    await audit(request, "update_persona", "personas", pid, data)
    return p


# ─── Identities ──────────────────────────────────────────────────────────────

@router.get("/api/personas/{pid}/identities")
async def list_identities(pid: str, reveal: bool = False, request: Request = None):
    if reveal:
        _check_master_key(request)
        await audit(request, "reveal_identities", "personas", pid)

    rows = await db.query("persona_identities", params={
        "select": "*", "persona_id": f"eq.{pid}", "order": "platform.asc",
    })

    if not reveal:
        for row in rows:
            if row.get("password_encrypted"):
                row["password_encrypted"] = "••••••••"
    else:
        from packages.core.crypto import decrypt
        for row in rows:
            enc = row.get("password_encrypted")
            if enc and enc != "••••••••":
                try:
                    row["password_plaintext"] = decrypt(enc)
                except Exception:
                    row["password_plaintext"] = "[decrypt error]"

    return rows


@router.post("/api/personas/{pid}/identities")
async def create_identity(pid: str, req: IdentityCreate, request: Request,
                           _auth=Depends(require_auth)):
    if not await db.get_by_id("personas", pid):
        raise HTTPException(404, "Persona not found")

    from packages.core.crypto import encrypt
    data = {
        "persona_id": pid,
        "platform": req.platform,
        "handle_or_email": req.handle_or_email,
        "recovery_email": req.recovery_email,
        "recovery_phone": req.recovery_phone,
        "api_keys": req.api_keys,
        "two_factor_secret": req.two_factor_secret,
        "notes": req.notes,
        "status": req.status,
    }
    if req.password:
        data["password_encrypted"] = encrypt(req.password)

    item = await db.insert("persona_identities", data)
    if not item:
        raise HTTPException(500, "Failed to create identity")
    if item.get("password_encrypted"):
        item["password_encrypted"] = "••••••••"
    await audit(request, "create_identity", "persona_identities", item["id"],
                {"platform": req.platform, "persona_id": pid})
    return item


@router.put("/api/personas/identities/{iid}")
async def update_identity(iid: str, req: IdentityUpdate, request: Request,
                           _auth=Depends(require_auth)):
    from packages.core.crypto import encrypt
    data = {k: v for k, v in req.model_dump().items() if v is not None and k != "password"}
    if req.password:
        data["password_encrypted"] = encrypt(req.password)
    if not data:
        raise HTTPException(400, "No fields to update")
    item = await db.update("persona_identities", iid, data)
    if not item:
        raise HTTPException(404, "Identity not found")
    if item.get("password_encrypted"):
        item["password_encrypted"] = "••••••••"
    await audit(request, "update_identity", "persona_identities", iid,
                {k: v for k, v in data.items() if k != "password_encrypted"})
    return item


@router.delete("/api/personas/identities/{iid}")
async def delete_identity(iid: str, request: Request, _auth=Depends(require_auth)):
    await db.delete("persona_identities", iid)
    await audit(request, "delete_identity", "persona_identities", iid)
    return {"status": "deleted"}


@router.post("/api/personas/{pid}/email/send")
async def send_persona_email(pid: str, req: PersonaEmailSend, request: Request,
                              _auth=Depends(require_auth)):
    from packages.email import send_email

    persona = await db.get_by_id("personas", pid)
    if not persona:
        raise HTTPException(404, "Persona not found")

    rows = await db.query("persona_identities", params={
        "select": "*", "persona_id": f"eq.{pid}",
        "platform": "eq.email", "status": "eq.active", "limit": "1",
    })

    from_email = config.EMAIL_FROM
    from_name = persona.get("name")
    if rows and rows[0].get("handle_or_email"):
        from_email = rows[0]["handle_or_email"]

    ok = await send_email(to=req.to, subject=req.subject, html=req.html,
                          from_email=from_email, from_name=from_name)
    if not ok:
        raise HTTPException(502, "Email send failed")
    await audit(request, "persona_email_send", "personas", pid,
                {"to": req.to, "subject": req.subject})
    return {"status": "sent", "from": f"{from_name} <{from_email}>"}


# ─── Social content queue ────────────────────────────────────────────────────

@router.get("/api/social/queue")
async def list_social_queue(persona_id: Optional[str] = None, platform: Optional[str] = None,
                             status: Optional[str] = None, limit: int = 50,
                             site_id: Optional[str] = None):
    params = {
        "select": "*, personas(name), content_assets(title,slug)",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if persona_id:
        params["persona_id"] = f"eq.{persona_id}"
    if platform:
        params["platform"] = f"eq.{platform}"
    if status:
        params["status"] = f"eq.{status}"
    if site_id:
        params["site_id"] = f"eq.{site_id}"
    return await db.query("social_content_queue", params=params)


@router.patch("/api/social/queue/{qid}")
async def update_queue_item(qid: str, req: QueueItemUpdate, request: Request,
                             _auth=Depends(require_auth)):
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields to update")
    item = await db.update("social_content_queue", qid, data)
    if not item:
        raise HTTPException(404, "Queue item not found")
    await audit(request, "update_queue_item", "social_content_queue", qid, data)
    return item

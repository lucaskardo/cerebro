from pydantic import BaseModel
from typing import Optional


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


class ScheduleConfigUpsert(BaseModel):
    platform: str
    max_posts_per_day: int = 3
    min_minutes_between_posts: int = 30
    variation_hours: int = 2
    skip_days_per_week: int = 1
    value_to_promo_ratio: str = "9:1"
    active: bool = True

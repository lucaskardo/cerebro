from pydantic import BaseModel
from typing import Optional


class LeadCapture(BaseModel):
    email: str
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    origen_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_content: Optional[str] = None
    utm_campaign: Optional[str] = None
    tema_interes: Optional[str] = None
    intent_score: int = 0
    quiz_responses: dict = {}
    mission_id: Optional[str] = None
    site_id: Optional[str] = None
    visitor_id: Optional[str] = None
    session_id: Optional[str] = None
    asset_id: Optional[str] = None
    cta_variant: Optional[str] = None
    calculator_data: Optional[dict] = None


class LeadTransition(BaseModel):
    to_status: str
    reason: Optional[str] = None
    triggered_by: str = "operator"


class LeadOutcomeCreate(BaseModel):
    status: str   # accepted | rejected
    revenue_value: Optional[float] = None
    partner: Optional[str] = None
    reason: Optional[str] = None
    source: str = "manual"

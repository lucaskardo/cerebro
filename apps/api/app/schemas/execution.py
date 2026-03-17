from pydantic import BaseModel
from typing import Optional


class OpportunityCreate(BaseModel):
    goal_id: str
    site_id: Optional[str] = None
    query: str
    pain_point: Optional[str] = None
    audience: Optional[str] = None
    channel: str = "seo"
    intent: str = "awareness"
    expected_value: float = 0
    confidence: str = "low"


class ExperimentCreate(BaseModel):
    site_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    hypothesis: str
    target_metric: str
    variant_a_json: dict = {}
    variant_b_json: dict = {}
    run_window_days: int = 14


class TaskCreate(BaseModel):
    experiment_id: Optional[str] = None
    site_id: Optional[str] = None
    skill_name: str
    input_json: dict = {}
    depends_on: Optional[str] = None
    idempotency_key: Optional[str] = None
    estimated_cost: float = 0


class ApprovalResolve(BaseModel):
    action: str   # "approve" | "reject"
    notes: Optional[str] = None

"""Pydantic schemas for /api/v2/intelligence endpoints."""
from pydantic import BaseModel
from typing import Optional, List, Any, Literal
from datetime import datetime


class EntityOut(BaseModel):
    id: str
    site_id: str
    entity_type: str
    name: str
    slug: str
    description: Optional[str] = None
    status: str
    metadata: dict = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class FactOut(BaseModel):
    id: str
    site_id: str
    entity_id: Optional[str] = None
    fact_key: str
    category: str
    value_text: Optional[str] = None
    value_number: Optional[float] = None
    value_json: Optional[Any] = None
    confidence: float
    utility_score: float
    evidence_count: int
    quarantined: bool
    tags: List[str] = []
    source: Optional[str] = None
    knowledge_type: Optional[str] = None
    evidence_quote: Optional[str] = None
    last_verified: Optional[datetime] = None


class InsightOut(BaseModel):
    id: str
    site_id: str
    insight_type: str
    title: str
    body: str
    supporting_facts: List[str] = []
    impact_score: float
    status: str


class DiscoveryCandidateOut(BaseModel):
    id: str
    site_id: str
    candidate_type: str
    proposed_slug: str
    proposed_data: dict
    metrics: dict
    status: str
    decision_reason: Optional[str] = None
    decided_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class DecideDiscoveryRequest(BaseModel):
    status: Literal["approved", "rejected"]
    reason: Optional[str] = None


class CompletenessRow(BaseModel):
    entity_id: str
    name: str
    entity_type: str
    fact_count: int
    categories: List[str] = []


class ResearchRunOut(BaseModel):
    id: str
    site_id: str
    task_type: str
    trigger: str
    status: str
    tokens_used: int
    search_calls: int
    cost_usd: float
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

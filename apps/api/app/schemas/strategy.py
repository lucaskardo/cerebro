from pydantic import BaseModel
from typing import Optional


class GoalCreate(BaseModel):
    description: str
    target_metric: str
    target_value: float
    mission_id: Optional[str] = None
    site_id: Optional[str] = None

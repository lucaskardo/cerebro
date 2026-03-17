from pydantic import BaseModel
from typing import Optional


class ContentGenerate(BaseModel):
    mission_id: str
    keyword: str
    topic_type: str = "spoke"
    cluster_id: Optional[str] = None
    site_id: Optional[str] = None


class ContentApprove(BaseModel):
    action: str   # "approve" | "reject" | "edit"
    notes: Optional[str] = None

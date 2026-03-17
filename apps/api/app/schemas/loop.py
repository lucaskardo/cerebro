from pydantic import BaseModel


class LoopRunRequest(BaseModel):
    goal_id: str
    dry_run: bool = False

from datetime import datetime
from pydantic import BaseModel

class AuditRead(BaseModel):
    id: int
    action: str
    actor_id: int
    actor_name: str
    occurred_at: datetime
    changes: dict
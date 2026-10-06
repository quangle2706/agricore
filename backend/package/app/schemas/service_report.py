#ServiceReport(id, file_url, notes, timestamp + field_job_id)

from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

class ServiceReportBase(BaseModel):
    file_url: str
    notes: str
    timestamp: datetime
    field_job_id: int

class ServiceReportRead(ServiceReportBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
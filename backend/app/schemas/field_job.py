#FieldJob(id, title, priority, status, equipment_id, operator_id)

from pydantic import BaseModel, ConfigDict, Field
from app.models import FieldJobPriority, FieldJobStatus

class FieldJobBase(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    priority: FieldJobPriority = FieldJobPriority.LOW
    status: FieldJobStatus = FieldJobStatus.IN_PROGRESS
    equipment_id: int
    operator_id: int 

class FieldJobCreate(FieldJobBase):
    """Shape of the Request Body for POST /field-jobs"""

class FieldJobRead(FieldJobBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

#Since we have /field-jobs/{id}/status, only provide status for update 
class FieldJobStatusUpdate(BaseModel):
    status: FieldJobStatus

#TODO: ---
#Business Question 2: Co-Location Discrepancy
#How many equipment units are assigned to farmhands who are NOT co-located
#at the same physical farm?

#TODO: ---
#Business Question 3: Reliability Metrics
#What is the field job completion/failure ratio
#broken down by equipment model?
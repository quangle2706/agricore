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

#Business Question 2: Co-Location Discrepancy
#How many equipment units are assigned to farmhands who are NOT co-located
#at the same physical farm?
class DiscrepancyRead(BaseModel):
    field_job_id: int
    title: str
    equipment_farm_id: int 
    operator_farm_id: int

    model_config = ConfigDict(from_attributes=True)


#Business Question 3: Reliability Metrics
#What is the field job completion/failure ratio
#broken down by equipment model?
class FieldJobRatioRead(BaseModel):
    equipment_model: str
    total_count: int
    completed_count: int
    failed_count: int
    completion_failure_ratio: float | None
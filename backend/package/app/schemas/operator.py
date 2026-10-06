#Operator(id, name, farm_id)

from pydantic import BaseModel, ConfigDict, Field

class OperatorBase(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    farm_id: int 

class OperatorCreate(OperatorBase):
    """Shape of Request Body for POST /operators"""

class OperatorRead(OperatorBase):
    id: int 

    model_config = ConfigDict(from_attributes=True)

#Business Question 5:
#Reporting Lines: How many farmhands reporting to a specific Regional Agronomy Supervisor
#have active field jobs assigned to them?
class ActiveOperatorCountRead(BaseModel):
    supervisor_id: int | None
    active_operator_count: int

class ActiveOperatorRead(BaseModel):
    supervisor_id: int | None
    operator_id: int
    operator_name: str
    farm_name: str
    active_jobs: int
    pending_jobs: int
    in_progress_jobs: int
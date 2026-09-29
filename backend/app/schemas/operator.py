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
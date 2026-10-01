#Farm(id, name, location_region, capacity, supervisor_id)

from pydantic import BaseModel, ConfigDict, Field

class FarmBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    location_region: str = Field(min_length=1, max_length=200)
    capacity: int = Field(ge=1, le=1000)
    supervisor_id: int

class FarmCreate(FarmBase):
    """Shape of the Request Body for POST /farms"""

class FarmRead(FarmBase):
    id: int #Beside those field in FarmBase, client can also see the id 

    #This allows us to return SQLAlchemy objects directly from the DB 
    # and have them automatically converted to Pydantic models
    model_config = ConfigDict(from_attributes=True)

#Business Question 4: 
# Which farms have more than 30% of their equipment currently flagged for maintenance?
class FarmMaintenanceRead(BaseModel):
    farm_id: int
    farm_name: str
    total_equipments: int
    total_maintenance_equipments: int
    maintenance_ratio: float = Field(ge=0, le=1)
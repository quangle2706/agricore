#Equipment(id, serial_number, model, status, fuel_level, farm_id)

from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
from app.models import EquipmentStatus

class EquipmentBase(BaseModel):
    serial_number: str = Field(min_length=1, max_length=50)
    model: str = Field(min_length=1, max_length=100)
    status: EquipmentStatus = EquipmentStatus.IN_USE
    fuel_level: Decimal = Field(ge=0, le=100) #Example: 42.5 ...
    farm_id: int

class EquipmentCreate(EquipmentBase):
    """Shape of the Request Body for POST /equipments"""

class EquipmentRead(EquipmentBase):
    id: int

    model_config = ConfigDict(from_attributes=True) #Usually used in Read /get

#TODO: ---
#Business Question 1: Low Fuel Alert
#Which active equipment units are operating below a 20% fuel level across all farms?
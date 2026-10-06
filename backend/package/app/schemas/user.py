from pydantic import BaseModel, ConfigDict, Field
from app.models import UserRole

class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    role: UserRole

class UserCreate(UserBase):
    password: str = Field(min_length=8)

class UserUpdate(UserBase):
    password: str | None = Field(default=None, min_length=8)

#Avoid expose the hashed password
class UserRead(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import require_permission
from app.permissions import ROLE_PERMISSIONS

class RoleRead(BaseModel):
    name: str
    permissions: list[str]

router = APIRouter(prefix="/roles", tags=["Roles"])

@router.get(
    "", 
    response_model=list[RoleRead],
    dependencies=[Depends(require_permission("role:read"))]
)
async def list_roles():
    return [
        RoleRead(name=role_name, permissions=sorted(permissions)) for role_name, permissions in ROLE_PERMISSIONS.items()
    ]
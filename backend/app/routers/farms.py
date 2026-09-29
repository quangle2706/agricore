#Define Farm APIs
#including: CRUD + endpoint that answer a business question

from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy import select, func, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models import Farm, Equipment, EquipmentStatus, User, UserRole
from app.schemas.farm import FarmRead, FarmCreate

router = APIRouter(prefix="/farms", tags=["farms"])

#CRUD Endpoints
@router.post("", response_model=FarmRead, status_code=status.HTTP_201_CREATED)
async def create_farm(
    payload: FarmCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
) -> FarmRead:
    farm = Farm(**payload.model_dump())
    db.add(farm)
    await db.commit()
    await db.refresh(farm)

    return farm


@router.get("", response_model=FarmRead)
async def list_farms(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
) -> list[FarmRead]:
    statement = select(Farm).order_by(Farm.id)
    result = await db.execute(statement)
    farms = result.scalars().all()
    return farms

@router.patch("/{farm_id}", response_model=FarmRead)
async def update_farm(
    farm_id: int,
    payload: FarmCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
) -> FarmRead:
    farm = await db.get(Farm, farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail=f"Farm {farm_id} not found")
    for key, value in payload.model_dump().items():
        setattr(farm, key, value)
    await db.commit()
    await db.refresh(farm)
    return farm

@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    farm = await db.get(Farm, farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail=f"Farm {farm_id} not found")
    await db.delete(farm)
    await db.commit()


#TODO: --Business Question 4
    

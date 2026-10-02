#Define Equipment API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy import select, func, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models import Equipment, EquipmentStatus, User, UserRole
from app.schemas.equipment import EquipmentCreate, EquipmentRead

from decimal import Decimal

router = APIRouter(prefix="/equipments", tags=["equipments"])

@router.post("", response_model=EquipmentRead, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    payload: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
) -> EquipmentRead:
    equipment = Equipment(**payload.model_dump())
    db.add(equipment)
    await db.commit()
    await db.refresh(equipment)
    return equipment

@router.get("", response_model=list[EquipmentRead])
async def list_equipments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
) -> list[EquipmentRead]:
    statement = select(Equipment).order_by(Equipment.id)
    result = await db.execute(statement)
    equipments = result.scalars().all()
    return equipments

#Business Question 1: Active equipment units are opertating below a 20% fuel level across all farms?
@router.get("/active", response_model=list[EquipmentRead])
async def list_active_equipments(
    max_fuel_level: Decimal | None = Query(
        default=None,
        ge=0,
        le=100,
        description="Only return active equipments strictly below this fuel level percentage"
    ),
    db: AsyncSession = Depends(get_db)
) -> list[EquipmentRead]:
    statement = select(Equipment).where(
        Equipment.status != EquipmentStatus.MAINTENANCE,
        Equipment.status != EquipmentStatus.RETIRED)

    if max_fuel_level is not None:
        statement = statement.where(Equipment.fuel_level < max_fuel_level)
    else:
        statement = statement.where(Equipment.fuel_level < 20)
    statement = statement.order_by(Equipment.id)

    result = await db.execute(statement)
    return result.scalars().all()
#----------------------------

@router.patch("/{equipment_id}", response_model=EquipmentRead)
async def update_equipment(
    equipment_id: int,
    payload: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
) -> EquipmentRead:
    equipment = await db.get(Equipment, equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment {equipment_id} not found"
        )
    for key, value in payload.model_dump().items():
        setattr(equipment, key, value)

    await db.commit()
    await db.refresh(equipment)
    return equipment

@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    equipment = await db.get(Equipment, equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment {equipment_id} not found"
        )
    await db.delete(equipment)
    await db.commit()
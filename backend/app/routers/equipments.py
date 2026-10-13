#Define Equipment API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response

from sqlalchemy import select, func, Float, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role, require_permission, PaginationParams
from app.models import Equipment, EquipmentStatus, User, UserRole
from app.schemas.equipment import EquipmentCreate, EquipmentRead
from app.schemas.pagination import Page

from app.services.record_service import (
    soft_delete_record,
    restore_record,
    create_record,
    update_record,
    get_record,
)

from app.schemas.audit import AuditRead
from app.services.audit_service import add_audit, read_history

from decimal import Decimal

router = APIRouter(prefix="/equipments", tags=["equipments"])

SORT_COLUMNS = {
    "id": Equipment.id,
    "serial_number": Equipment.serial_number,
    "model": Equipment.model,
    "status": Equipment.status,
    "fuel_level": Equipment.fuel_level,
    "farm_id": Equipment.farm_id,
}

async def query_equipment_page(
    db: AsyncSession,
    *,
    page: int, size: int, sort_by: str, sort_dir: str,
    search: str | None = None,
    status=None,
    farm_id: int | None = None,
):
    sort_column = SORT_COLUMNS.get(sort_by)
    if sort_column is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported sort field: {sort_by}",
        )

    # after has deleted_at for soft delete
    conditions = [
        Equipment.deleted_at.is_(None),
    ]

    if search and search.strip():
        term = (
            search.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        pattern = f"%{term}%"
        conditions.append(
            or_(Equipment.serial_number.ilike(pattern, escape="\\"),
                Equipment.model.ilike(pattern, escape="\\"),)
        )

    if status is not None:
        conditions.append(Equipment.status == status)
    if farm_id is not None:
        conditions.append(Equipment.farm_id == farm_id)

    count_stmt = (
        select(func.count()).select_from(Equipment).where(*conditions)
    )
    ordering = (sort_column.desc() if sort_dir == "desc" else sort_column.asc())
    rows_stmt = (select(Equipment).where(*conditions).order_by(ordering))

    # if sort_by by other columns may have same value => then sort_by id asc for those
    if sort_by != "id":
        rows_stmt = rows_stmt.order_by(Equipment.id.asc())

    rows_stmt = (rows_stmt.offset((page - 1) * size).limit(size))

    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(rows_stmt)).scalars().all()

    return { "items": items, "total": total }

    

@router.get("", response_model=Page[EquipmentRead])
async def list_equipments(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(default=None, max_length=100),
    status: EquipmentStatus | None = Query(default=None),
    farm_id: int | None = Query(default=None, ge=1),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("equipment:read"))
):
    return await query_equipment_page(
        db, 
        page=pagination.page,
        size=pagination.size,
        sort_by=pagination.sort_by,
        sort_dir=pagination.sort_dir,
        search=search,
        status=status,
        farm_id=farm_id,
    )

# inactive list
@router.get("/inactive", response_model=list[EquipmentRead])
async def inactive_equipments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    statement = (
        select(Equipment)
        .where(Equipment.deleted_at.is_not(None))
        .order_by(
            Equipment.deleted_at.desc(),
            Equipment.id.desc(),
        )
    )

    return (await db.scalars(statement)).all()


@router.post("", response_model=EquipmentRead, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    payload: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("equipment:create"))
) -> EquipmentRead:
    
    return await create_record(db, "equipment", payload, current_user)
    
    # equipment = Equipment(**payload.model_dump())
    # db.add(equipment)
    # await db.commit()
    # await db.refresh(equipment)
    # return equipment


# @router.get("", response_model=list[EquipmentRead])
# async def list_equipments(
#     db: AsyncSession = Depends(get_db),
#     # _: User = Depends(get_current_user)
#     _: User = Depends(require_permission("equipment:read"))
# ) -> list[EquipmentRead]:
#     statement = select(Equipment).order_by(Equipment.id)
#     result = await db.execute(statement)
#     equipments = result.scalars().all()
#     return equipments


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
    current_user: User = Depends(get_current_user),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("equipment:update"))
) -> EquipmentRead:

    return await update_record(db, "equipment", equipment_id, payload, current_user)
    
    # equipment = await db.get(Equipment, equipment_id)
    # if equipment is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_404_NOT_FOUND,
    #         detail=f"Equipment {equipment_id} not found"
    #     )
    # for key, value in payload.model_dump().items():
    #     setattr(equipment, key, value)

    # await db.commit()
    # await db.refresh(equipment)
    # return equipment

# @router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
# async def delete_equipment(
#     equipment_id: int,
#     db: AsyncSession = Depends(get_db),
#     # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
#     _: User = Depends(require_permission("equipment:delete"))
# ):
#     equipment = await db.get(Equipment, equipment_id)
#     if equipment is None:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Equipment {equipment_id} not found"
#         )
#     await db.delete(equipment)
#     await db.commit()

@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_equipment(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
    _: User = Depends(require_permission("equipment:delete"))
):
    await soft_delete_record(db, "equipment", equipment_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/{equipment_id}/restore", response_model=EquipmentRead)
async def restore_equipment(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
):
    return await restore_record(db, "equipment", equipment_id, admin)

# read history
@router.get(
    "/{equipment_id}/history",
    response_model=list[AuditRead]
)
async def equipment_history(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    # assumes every authenticated user can read equipment
    record = await get_record(db, "equipment", equipment_id, include_deleted=True,)

    role = getattr(user.role, "value", user.role) # to handle enum and string representation of role

    if (record.deleted_at is not None and role != UserRole.FARM_OPERATIONS_ADMIN):
        raise HTTPException(404, "Record not found")

    return await read_history(db, "equipment", equipment_id)
    
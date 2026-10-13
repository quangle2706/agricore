#Define Farm APIs
#including: CRUD + endpoint that answer a business question

from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy import select, func, Float, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role, require_permission, PaginationParams
from app.models import Farm, Equipment, EquipmentStatus, User, UserRole
from app.schemas.farm import FarmRead, FarmCreate, FarmMaintenanceRead
from app.schemas.pagination import Page

router = APIRouter(prefix="/farms", tags=["farms"])

SORT_COLUMNS = {
    "id": Farm.id,
    "name": Farm.name,
    "location_region": Farm.location_region,
    "capacity": Farm.capacity,
    "supervisor_id": Farm.supervisor_id,
}

async def query_farm_page(
    db: AsyncSession,
    *,
    page: int, size: int, sort_by: str, sort_dir: str,
    search: str | None = None,
    supervisor_id=None,
):
    sort_column = SORT_COLUMNS.get(sort_by)
    if sort_column is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported sort field: {sort_by}",
        )
    
    conditions = []

    if search and search.strip():
        term = (
            search.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )
        pattern = f"%{term}%"
        conditions.append(
            or_(Farm.name.ilike(pattern, escape="\\"),
                Farm.location_region.ilike(pattern, escape="\\"),)
        )

    if supervisor_id is not None:
        conditions.append(Farm.supervisor_id == supervisor_id)

    count_stmt = (
        select(func.count()).select_from(Farm).where(*conditions)
    )
    ordering = (sort_column.desc() if sort_dir == "desc" else sort_column.asc())
    rows_stmt = (select(Farm).where(*conditions).order_by(ordering))

    # if sort_by by other columns may have same value => then sort_by id asc for those
    if sort_by != "id":
        rows_stmt = rows_stmt.order_by(Farm.id.asc())

    rows_stmt = (rows_stmt.offset((page - 1) * size).limit(size))

    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(rows_stmt)).scalars().all()

    return { "items": items, "total": total }

    

@router.get("", response_model=Page[FarmRead])
async def list_farms(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(default=None, max_length=100),
    supervisor_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("farm:read"))
):
    return await query_farm_page(
        db, 
        page=pagination.page,
        size=pagination.size,
        sort_by=pagination.sort_by,
        sort_dir=pagination.sort_dir,
        search=search,
        supervisor_id=supervisor_id,
    )

#CRUD Endpoints
@router.post("", response_model=FarmRead, status_code=status.HTTP_201_CREATED)
async def create_farm(
    payload: FarmCreate,
    db: AsyncSession = Depends(get_db),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("farm:create"))
) -> FarmRead:
    farm = Farm(**payload.model_dump())
    db.add(farm)
    await db.commit()
    await db.refresh(farm)

    return farm


# @router.get("", response_model=list[FarmRead])
# async def list_farms(
#     db: AsyncSession = Depends(get_db),
#     # _: User = Depends(get_current_user)
#     _: User = Depends(require_permission("farm:read"))
# ) -> list[FarmRead]:
#     statement = select(Farm).order_by(Farm.id)
#     result = await db.execute(statement)
#     farms = result.scalars().all()
#     return farms

@router.patch("/{farm_id}", response_model=FarmRead)
async def update_farm(
    farm_id: int,
    payload: FarmCreate,
    db: AsyncSession = Depends(get_db),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("farm:update"))
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
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("farm:delete"))
):
    farm = await db.get(Farm, farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail=f"Farm {farm_id} not found")
    await db.delete(farm)
    await db.commit()


#--Business Question 4
@router.get("/maintenance-ratio", response_model=list[FarmMaintenanceRead])
async def get_farms_with_maintenance_ratio(
    threshold: float = Query(
        default=30,
        ge=0,
        le=100
    ),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
) -> list[FarmMaintenanceRead]:
    """To answer business #3 which branches have more than 30% of their ATMs currently flagged for maintenance"""
    #to make the statement shorter
    total_count = func.count(Equipment.id)
    maintenance_count = func.count().filter(Equipment.status == EquipmentStatus.MAINTENANCE)
    maintenance_ratio = maintenance_count.cast(Float) / total_count

    statement = (
        select(
            Farm.id.label("farm_id"),
            Farm.name.label("farm_name"),
            total_count.label("total_equipments"),
            maintenance_count.label("total_maintenance_equipments")
        )
        .join(Equipment, Equipment.farm_id == Farm.id)
        .group_by(Farm.id)
        .having(maintenance_ratio >= threshold / 100) #greater than or equal
        .order_by(Farm.id)
    )

    result = await db.execute(statement)
    rows = result.mappings().all()

    return [
        FarmMaintenanceRead(
            farm_id=row["farm_id"],
            farm_name=row["farm_name"],
            total_equipments=row["total_equipments"],
            total_maintenance_equipments=row["total_maintenance_equipments"],
            maintenance_ratio=(
                row["total_maintenance_equipments"] / row["total_equipments"]
            )
        ) for row in rows
    ]
    

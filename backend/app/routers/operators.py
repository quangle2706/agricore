#Define Operator API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response

from sqlalchemy import select, func, Float, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role, require_permission, PaginationParams
from app.models import Operator, User, UserRole, Farm, FieldJob, FieldJobStatus
from app.schemas.operator import OperatorCreate, OperatorRead, ActiveOperatorCountRead, ActiveOperatorRead
from app.schemas.pagination import Page

from app.services.record_service import soft_delete_record, restore_record, create_record, update_record, get_record
from app.schemas.audit import AuditRead
from app.services.audit_service import add_audit, read_history

router = APIRouter(prefix="/operators", tags=["operators"])

SORT_COLUMNS = {
    "id": Operator.id,
    "name": Operator.name,
    "farm_id": Operator.farm_id,
}

async def query_operator_page(
    db: AsyncSession,
    *,
    page: int, size: int, sort_by: str, sort_dir: str,
    search: str | None = None,
    farm_id=None,
):
    sort_column = SORT_COLUMNS.get(sort_by)
    if sort_column is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported sort field: {sort_by}",
        )
    
    conditions = [
        Operator.deleted_at.is_(None),
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
            or_(Operator.name.ilike(pattern, escape="\\"),)
        )

    if farm_id is not None:
        conditions.append(Operator.farm_id == farm_id)

    count_stmt = (
        select(func.count()).select_from(Operator).where(*conditions)
    )
    ordering = (sort_column.desc() if sort_dir == "desc" else sort_column.asc())
    rows_stmt = (select(Operator).where(*conditions).order_by(ordering))

    # if sort_by by other columns may have same value => then sort_by id asc for those
    if sort_by != "id":
        rows_stmt = rows_stmt.order_by(Operator.id.asc())

    rows_stmt = (rows_stmt.offset((page - 1) * size).limit(size))

    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(rows_stmt)).scalars().all()

    return { "items": items, "total": total }

@router.get("", response_model=Page[OperatorRead])
async def list_operators(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(default=None, max_length=100),
    farm_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("operator:read"))
):
    return await query_operator_page(
        db, 
        page=pagination.page,
        size=pagination.size,
        sort_by=pagination.sort_by,
        sort_dir=pagination.sort_dir,
        search=search,
        farm_id=farm_id,
    )

# get inactive list
@router.get("/inactive", response_model=list[OperatorRead])
async def inactive_operators(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    statement = (
        select(Operator).where(Operator.deleted_at.is_not(None))
        .order_by(Operator.deleted_at.desc(), Operator.id.desc(),)
    )

    return (await db.scalars(statement)).all()


#TODO: -- Update checking if FarmID exists --
@router.post("", response_model=OperatorRead, status_code=status.HTTP_201_CREATED)
async def create_operator(
    payload: OperatorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("operator:create"))
) -> OperatorRead:

    return await create_record(db, "operator", payload, current_user)
    
    # operator = Operator(**payload.model_dump())
    # db.add(operator)
    # await db.commit()
    # await db.refresh(operator)
    # return operator

# @router.get("", response_model=list[OperatorRead])
# async def list_operators(
#     db: AsyncSession = Depends(get_db),
#     # _: User = Depends(get_current_user)
#     _: User = Depends(require_permission("operator:read"))
# ) -> list[OperatorRead]:
#     statement = select(Operator).order_by(Operator.id)
#     result = await db.execute(statement)
#     operators = result.scalars().all()
#     return operators

@router.patch("/{operator_id}", response_model=OperatorRead)
async def update_operator(
    operator_id: int,
    payload: OperatorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("operator:update"))
) -> OperatorRead:

    return await update_record(db, "operator", operator_id, payload, current_user)
    
    # operator = await db.get(Operator, operator_id)
    # if operator is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_404_NOT_FOUND,
    #         detail=f"Operator {operator_id} not found"
    #     )
    # for key, value in payload.model_dump().items():
    #     setattr(operator, key, value)

    # await db.commit()
    # await db.refresh(operator)
    # return operator

@router.delete("/{operator_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_operator(
    operator_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("operator:delete"))
):
    await soft_delete_record(db, "operator", operator_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    # operator = await db.get(Operator, operator_id)
    # if operator is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_404_NOT_FOUND,
    #         detail=f"Operator {operator_id} not found"
    #     )
    # await db.delete(operator)
    # await db.commit()

# restore record
@router.post("/{operator_id}/restore", response_model=OperatorRead)
async def restore_operator(
    operator_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
):
    return await restore_record(db, "operator", operator_id, admin)

# read history
@router.get(
    "/{operator_id}/history",
    response_model=list[AuditRead]
)
async def operator_history(
    operator_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    record = await get_record(db, "operator", operator_id, include_deleted=True,)

    role = getattr(user.role, "value", user.role) # to handle enum and string representation of role

    if (record.deleted_at is not None and role != UserRole.FARM_OPERATIONS_ADMIN):
        raise HTTPException(404, "Record not found")

    return await read_history(db, "operator", operator_id)


#Question 5:
#---------
@router.get("/active-field-jobs", response_model=ActiveOperatorCountRead)
async def get_active_operator_count(
    supervisor_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ActiveOperatorCountRead:
    statement = (
        select(
            func.count(
                func.distinct(Operator.id)
            ).label("active_operator_count")
        )
        .join(Farm, Farm.id == Operator.farm_id)
        .join(FieldJob, FieldJob.operator_id == Operator.id)
        .where(FieldJob.status.in_([
            FieldJobStatus.PENDING, 
            FieldJobStatus.IN_PROGRESS
            ])
        )
    )

    if supervisor_id is not None:
        statement = statement.where(Farm.supervisor_id == supervisor_id) #Re-assign since SQLAlchemy statement is immutable

    result = await db.execute(statement)
    count = result.scalar_one()

    return ActiveOperatorCountRead(
        supervisor_id=supervisor_id,
        active_operator_count=count
    )

@router.get("/active-field-jobs-list", response_model=list[ActiveOperatorRead])
async def get_active_operator_list(
    supervisor_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ActiveOperatorRead]:
    statement = (
        select(
            Farm.supervisor_id.label("supervisor_id"),
            Operator.id.label("operator_id"),
            Operator.name.label("operator_name"),
            Farm.name.label("farm_name"),
            func.count(FieldJob.id).label("active_jobs"),
            func.count(FieldJob.id).filter(FieldJob.status == FieldJobStatus.PENDING)
                .label("pending_jobs"),
            func.count(FieldJob.id).filter(FieldJob.status == FieldJobStatus.IN_PROGRESS)
                .label("in_progress_jobs")
        )
        .join(Farm, Farm.id == Operator.farm_id)
        .join(FieldJob, FieldJob.operator_id == Operator.id)
        .where(FieldJob.status.in_([
            FieldJobStatus.PENDING, 
            FieldJobStatus.IN_PROGRESS
            ])
        )
    )

    if supervisor_id is not None:
        statement = statement.where(Farm.supervisor_id == supervisor_id) #Re-assign since SQLAlchemy statement is immutable
    statement = statement.group_by(
        Farm.supervisor_id,
        Operator.id,
        Operator.name,
        Farm.name,
    )

    result = await db.execute(statement)
    rows = result.mappings().all()

    return [ 
        ActiveOperatorRead(
            supervisor_id=row["supervisor_id"],
            operator_id=row["operator_id"],
            operator_name=row["operator_name"],
            farm_name=row["farm_name"],
            active_jobs=row["active_jobs"],
            pending_jobs=row["pending_jobs"],
            in_progress_jobs=row["in_progress_jobs"]
        ) for row in rows
    ]
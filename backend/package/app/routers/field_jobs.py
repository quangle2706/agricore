#Define Field Job API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response

from sqlalchemy import select, func, Float, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role, require_permission, PaginationParams
from app.models import FieldJob, FieldJobPriority, FieldJobStatus, User, UserRole, Equipment, Operator
from app.schemas.field_job import (
    DiscrepancyRead,
    FieldJobCreate,
    FieldJobRatioRead,
    FieldJobRead,
    FieldJobStatusUpdate,
)
from app.schemas.pagination import Page

from app.services.record_service import soft_delete_record, restore_record, create_record, update_record, get_record
from app.schemas.audit import AuditRead
from app.services.audit_service import add_audit, read_history

router = APIRouter(prefix="/field-jobs", tags=["field-jobs"])

SORT_COLUMNS = {
    "id": FieldJob.id,
    "title": FieldJob.title,
    "priority": FieldJob.priority,
    "status": FieldJob.status,
    "equipment_id": FieldJob.equipment_id,
    "operator_id": FieldJob.operator_id,
}

async def query_field_job_page(
    db: AsyncSession,
    *,
    page: int, size: int, sort_by: str, sort_dir: str,
    search: str | None = None,
    priority=None,
    status=None,
    equipment_id: int | None = None,
    operator_id: int | None = None,
):
    sort_column = SORT_COLUMNS.get(sort_by)
    if sort_column is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported sort field: {sort_by}",
        )
    
    conditions = [
        FieldJob.deleted_at.is_(None),
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
            or_(FieldJob.title.ilike(pattern, escape="\\"),)
        )

    if priority is not None:
        conditions.append(FieldJob.priority == priority)
    if status is not None:
        conditions.append(FieldJob.status == status)
    if equipment_id is not None:
        conditions.append(FieldJob.equipment_id == equipment_id)
    if operator_id is not None:
        conditions.append(FieldJob.operator_id == operator_id)

    count_stmt = (
        select(func.count()).select_from(FieldJob).where(*conditions)
    )
    ordering = (sort_column.desc() if sort_dir == "desc" else sort_column.asc())
    rows_stmt = (select(FieldJob).where(*conditions).order_by(ordering))

    # if sort_by by other columns may have same value => then sort_by id asc for those
    if sort_by != "id":
        rows_stmt = rows_stmt.order_by(FieldJob.id.asc())

    rows_stmt = (rows_stmt.offset((page - 1) * size).limit(size))

    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(rows_stmt)).scalars().all()

    return { "items": items, "total": total }

    

@router.get("", response_model=Page[FieldJobRead])
async def list_field_jobs(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(default=None, max_length=100),
    priority: FieldJobPriority | None = Query(default=None),
    status: FieldJobStatus | None = Query(default=None),
    equipment_id: int | None = Query(default=None, ge=1),
    operator_id: int | None = Query(default=None, ge=1),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("field_job:read"))
):
    return await query_field_job_page(
        db, 
        page=pagination.page,
        size=pagination.size,
        sort_by=pagination.sort_by,
        sort_dir=pagination.sort_dir,
        search=search,
        priority=priority,
        status=status,
        equipment_id=equipment_id,
        operator_id=operator_id,
    )


# inactive list
@router.get("/inactive", response_model=list[FieldJobRead])
async def inactive_field_jobs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    statement = (
        select(FieldJob)
        .where(FieldJob.deleted_at.is_not(None))
        .order_by(
            FieldJob.deleted_at.desc(),
            FieldJob.id.desc(),
        )
    )

    return (await db.scalars(statement)).all()

#---------

@router.post("", response_model=FieldJobRead, status_code=status.HTTP_201_CREATED)
async def create_field_jobs(
    payload: FieldJobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("field_job:create"))
) -> FieldJobRead:
    field_job = FieldJob(**payload.model_dump())

    #check if equipment exists
    equipment = await db.get(Equipment, field_job.equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment '{field_job.equipment_id}' not found"
        )

    #check if operator exists
    operator = await db.get(Operator, field_job.operator_id)
    if operator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator '{field_job.operator_id}' not found"
        )

    return await create_record(db, "field_job", payload, current_user)

    # db.add(field_job)
    # await db.commit()
    # await db.refresh(field_job)
    # return field_job

# @router.get("", response_model=list[FieldJobRead])
# async def list_field_jobs(
#     db: AsyncSession = Depends(get_db),
#     # _: User = Depends(get_current_user)
#     _: User = Depends(require_permission("field_job:read"))
# ) -> list[FieldJobRead]:
#     statement = select(FieldJob).order_by(FieldJob.id)
#     result = await db.execute(statement)
#     field_jobs = result.scalars().all()
#     return field_jobs

@router.patch("/{field_job_id}", response_model=FieldJobRead)
async def update_field_job(
    field_job_id: int,
    payload: FieldJobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("field_job:update"))
) -> FieldJobRead:
    field_job = await db.get(FieldJob, field_job_id)
    if field_job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field Job {field_job_id} not found"
        )
    for key, value in payload.model_dump().items():
        setattr(field_job, key, value)

    #check if equipment exists
    equipment = await db.get(Equipment, field_job.equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Equipment '{field_job.equipment_id}' not found"
        )

    #check if operator exists
    operator = await db.get(Operator, field_job.operator_id)
    if operator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator '{field_job.operator_id}' not found"
        )

    return await update_record(db, "field_job", field_job_id, payload, current_user)

    # await db.commit()
    # await db.refresh(field_job)
    # return field_job

@router.delete("/{field_job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field_job(
    field_job_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("field_job:delete"))
):
    field_job = await db.get(FieldJob, field_job_id)
    if field_job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field Job {field_job_id} not found"
        )

    await soft_delete_record(db, "field_job", field_job_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    # await db.delete(field_job)
    # await db.commit()

@router.post("/{field_job_id}/restore", response_model=FieldJobRead)
async def restore_field_job(
    field_job_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
):
    return await restore_record(db, "field_job", field_job_id, admin)


# read history
@router.get(
    "/{field_job_id}/history",
    response_model=list[AuditRead]
)
async def field_job_history(
    field_job_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    record = await get_record(db, "field_job", field_job_id, include_deleted=True,)

    role = getattr(user.role, "value", user.role) # to handle enum and string representation of role

    if (record.deleted_at is not None and role != UserRole.FARM_OPERATIONS_ADMIN):
        raise HTTPException(404, "Record not found")

    return await read_history(db, "field_job", field_job_id)

#--------------

#Update status of a field job
@router.patch("/{field_job_id}/status", response_model=FieldJobRead)
async def update_field_job_status(
    field_job_id: int,
    payload: FieldJobStatusUpdate,
    db: AsyncSession = Depends(get_db),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN, UserRole.FIELD_HAND))
    _: User = Depends(require_permission("field_job:update_status"))
) -> FieldJobRead:
    field_job = await db.get(FieldJob, field_job_id)
    if field_job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field Job {field_job_id} not found"
        )
    field_job.status = payload.status
    await db.commit()
    await db.refresh(field_job)
    return field_job

#--------
#Question 2:
@router.get("/discrepancies", response_model=list[DiscrepancyRead])
async def list_colocation_discrepancies(
    #to set filter by priority, status
    priority: FieldJobPriority | None = Query(
        default=None,
        description="Only return discrepancies for field jobs of this priority"
    ),
    status: FieldJobStatus | None = Query(
        default=None,
        description="Only return discrepancies for field jobs of this status"
    ),
    db: AsyncSession=Depends(get_db),
    #add role to use this API
    _: User = Depends(get_current_user)
):
    """ Answer business question #2 """
    statement = (
        select(
            FieldJob.id.label("field_job_id"),
            FieldJob.title,
            Equipment.farm_id.label("equipment_farm_id"),
            Operator.farm_id.label("operator_farm_id")
        )
        .join(Equipment, Equipment.id == FieldJob.equipment_id)
        .join(Operator, Operator.id == FieldJob.operator_id)
        .where(Equipment.farm_id != Operator.farm_id,
               Equipment.deleted_at.is_(None),
               Operator.deleted_at.is_(None),
               FieldJob.deleted_at.is_(None))
    )

    #use the query parameter
    if priority is not None:
        statement = statement.where(FieldJob.priority == priority)

    if status is not None:
        statement = statement.where(FieldJob.status == status)

    statement = statement.order_by(FieldJob.id) # follow the order to statement in SQL -> order_by is the last
    result = await db.execute(statement)
    return [dict(row) for row in result.mappings().all()]


#Question 3:
#get service call completion/failure ratio by ATM models
@router.get("/completion-failure-ratio", response_model=list[FieldJobRatioRead])
async def get_completion_failure_ratio(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
) -> list[FieldJobRatioRead]:
    statement = (
        select(
            Equipment.model.label("equipment_model"),
            func.count().label("total_count"),
            func.count().filter(FieldJob.status == FieldJobStatus.COMPLETED)
                .label("completed_count"),
            func.count().filter(FieldJob.status == FieldJobStatus.FAILED)
                .label("failed_count")
        )
        .join(FieldJob, FieldJob.equipment_id == Equipment.id)
        .where(
            Equipment.deleted_at.is_(None),
            FieldJob.deleted_at.is_(None))
        .group_by(Equipment.model)
    )

    result = await db.execute(statement)
    rows = result.mappings().all()

    #response list field jobs with ratio info
    return [
        FieldJobRatioRead(
            equipment_model=row["equipment_model"],
            total_count=row["total_count"],
            completed_count=row["completed_count"],
            failed_count=row["failed_count"],
            completion_failure_ratio=(
                row["completed_count"] / row["failed_count"] if row["failed_count"] > 0 else None
            )
        ) for row in rows
    ]

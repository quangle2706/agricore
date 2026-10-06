#Define Field Job API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy import select, func, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models import FieldJob, FieldJobPriority, FieldJobStatus, User, UserRole, Equipment, Operator
from app.schemas.field_job import (
    DiscrepancyRead,
    FieldJobCreate,
    FieldJobRatioRead,
    FieldJobRead,
    FieldJobStatusUpdate,
)

router = APIRouter(prefix="/field-jobs", tags=["field-jobs"])

@router.post("", response_model=FieldJobRead, status_code=status.HTTP_201_CREATED)
async def create_field_jobs(
    payload: FieldJobCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
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

    db.add(field_job)
    await db.commit()
    await db.refresh(field_job)
    return field_job

@router.get("", response_model=list[FieldJobRead])
async def list_field_jobs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
) -> list[FieldJobRead]:
    statement = select(FieldJob).order_by(FieldJob.id)
    result = await db.execute(statement)
    field_jobs = result.scalars().all()
    return field_jobs

@router.patch("/{field_job_id}", response_model=FieldJobRead)
async def update_field_job(
    field_job_id: int,
    payload: FieldJobCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
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

    await db.commit()
    await db.refresh(field_job)
    return field_job

@router.delete("/{field_job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field_job(
    field_job_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    field_job = await db.get(FieldJob, field_job_id)
    if field_job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field Job {field_job_id} not found"
        )
    await db.delete(field_job)
    await db.commit()

#Update status of a field job
@router.patch("/{field_job_id}/status", response_model=FieldJobRead)
async def update_field_job_status(
    field_job_id: int,
    payload: FieldJobStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN, UserRole.FIELD_HAND))
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
        .where(Equipment.farm_id != Operator.farm_id)
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

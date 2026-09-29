#Define Field Job API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy import select, func, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models import FieldJob, FieldJobPriority, FieldJobStatus, User, UserRole, Equipment, Operator
from app.schemas.field_job import FieldJobCreate, FieldJobRead

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
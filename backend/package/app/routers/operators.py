#Define Operator API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy import select, func, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models import Operator, User, UserRole, Farm, FieldJob, FieldJobStatus
from app.schemas.operator import OperatorCreate, OperatorRead, ActiveOperatorCountRead, ActiveOperatorRead

router = APIRouter(prefix="/operators", tags=["operators"])

#TODO: -- Update checking if FarmID exists --

@router.post("", response_model=OperatorRead, status_code=status.HTTP_201_CREATED)
async def create_operator(
    payload: OperatorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
) -> OperatorRead:
    operator = Operator(**payload.model_dump())
    db.add(operator)
    await db.commit()
    await db.refresh(operator)
    return operator

@router.get("", response_model=list[OperatorRead])
async def list_operators(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
) -> list[OperatorRead]:
    statement = select(Operator).order_by(Operator.id)
    result = await db.execute(statement)
    operators = result.scalars().all()
    return operators

@router.patch("/{operator_id}", response_model=OperatorRead)
async def update_operator(
    operator_id: int,
    payload: OperatorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
) -> OperatorRead:
    operator = await db.get(Operator, operator_id)
    if operator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator {operator_id} not found"
        )
    for key, value in payload.model_dump().items():
        setattr(operator, key, value)

    await db.commit()
    await db.refresh(operator)
    return operator

@router.delete("/{operator_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_operator(
    operator_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    operator = await db.get(Operator, operator_id)
    if operator is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator {operator_id} not found"
        )
    await db.delete(operator)
    await db.commit()

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
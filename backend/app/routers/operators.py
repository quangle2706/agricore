#Define Operator API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy import select, func, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models import Operator, User, UserRole
from app.schemas.operator import OperatorCreate, OperatorRead

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
#Define Service Report API endpoints

from fastapi import APIRouter, Depends, HTTPException, Query, status

from sqlalchemy import select, func, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models import ServiceReport, User, UserRole
from app.schemas.service_report import ServiceReportRead

router = APIRouter(prefix="/service-reports", tags=["service-reports"])

#TODO: Update upload service report when connect to AWS/S3Bucket
# @router.post("", response_model=ServiceReportRead, status_code=status.HTTP_201_CREATED)
# async def create_service_report(
#     db: AsyncSession = Depends(get_db),
#     _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
# ) -> ServiceReportRead:
#     # service_report = ServiceReport(**payload.model_dump())
#     # db.add(service_report)
#     # await db.commit()
#     # await db.refresh(service_report)
#     # return service_report
#     pass

@router.get("", response_model=list[ServiceReportRead])
async def list_service_reports(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
) -> list[ServiceReportRead]:
    statement = select(ServiceReport).order_by(ServiceReport.id)
    result = await db.execute(statement)
    service_reports = result.scalars().all()
    return service_reports

#TODO: 
# @router.patch("/{service_report_id}", response_model=ServiceReportRead)
# async def update_service_report(
#     service_report_id: int,
#     db: AsyncSession = Depends(get_db),
#     _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
# ) -> ServiceReport:
#     # service_report = await db.get(ServiceReport, service_report_id)
#     # if service_report is None:
#     #     raise HTTPException(
#     #         status_code=status.HTTP_404_NOT_FOUND,
#     #         detail=f"Service Report {service_report_id} not found"
#     #     )

#     # #TODO: ---

#     # await db.commit()
#     # await db.refresh(service_report)
#     # return service_report
#     pass

@router.delete("/{service_report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_report(
    service_report_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    service_report = await db.get(ServiceReport, service_report_id)
    if service_report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service Report {service_report_id} not found"
        )
    await db.delete(service_report)
    await db.commit()
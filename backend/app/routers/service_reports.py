#Define Service Report API endpoints
import uuid 
from urllib.parse import quote, unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile, Form
from app.services.s3_service import create_presigned_download_url, upload_file_to_s3
from app.config import settings

from sqlalchemy import select, func, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models import ServiceReport, User, UserRole, FieldJob
from app.schemas.service_report import ServiceReportRead

router = APIRouter(prefix="/service-reports", tags=["service-reports"])

#TODO: Update upload service report when connect to AWS/S3Bucket
@router.post("", response_model=ServiceReportRead)
async def upload_diagnostic_report(
    field_job_id: int = Form(...),
    file: UploadFile = File(...),
    note: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN, UserRole.FIELD_HAND))
) -> ServiceReportRead:
    field_job = await db.get(FieldJob, field_job_id)
    if field_job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Field job {field_job_id} not found",
        )

    # Generate a unique S3 key for the uploaded file
    s3_key = f"diagnostic_reports/{uuid.uuid4()}_{file.filename}"

    # Upload the file to S3
    try:
        upload_file_to_s3(file.file, s3_key)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file to S3: {str(e)}"
        )

    service_report = ServiceReport(
        field_job_id=field_job_id,
        file_url=(
            f"https://{settings.s3_bucket_name}.s3.{settings.aws_region}.amazonaws.com/"
            f"{quote(s3_key, safe='/')}"
        ),
        notes=note or ""
    )
    db.add(service_report)
    await db.commit()
    await db.refresh(service_report)

    return service_report

@router.get("", response_model=list[ServiceReportRead])
async def list_service_reports(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
) -> list[ServiceReportRead]:
    statement = select(ServiceReport).order_by(ServiceReport.id)
    result = await db.execute(statement)
    service_reports = result.scalars().all()
    return service_reports

@router.get("/{service_report_id}/download-url")
async def get_service_report_download_url(
    service_report_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, str]:
    service_report = await db.get(ServiceReport, service_report_id)
    if service_report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service report {service_report_id} not found",
        )

    s3_key = unquote(urlparse(service_report.file_url).path.lstrip("/"))
    if not s3_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Service report does not have a valid S3 object key",
        )

    return {"url": create_presigned_download_url(s3_key)}

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
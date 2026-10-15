#Define Service Report API endpoints
import uuid 
from urllib.parse import quote, unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile, Form, Response
from app.services.s3_service import create_presigned_download_url, upload_file_to_s3
from app.config import settings

from sqlalchemy import select, func, Float, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role, require_permission, PaginationParams
from app.models import ServiceReport, User, UserRole, FieldJob
from app.schemas.service_report import ServiceReportRead
from app.schemas.pagination import Page

from app.services.record_service import soft_delete_record, restore_record, create_record, update_record, get_record, snapshot
from app.schemas.audit import AuditRead
from app.services.audit_service import add_audit, read_history

router = APIRouter(prefix="/service-reports", tags=["service-reports"])

SORT_COLUMNS = {
    "id": ServiceReport.id,
    "field_job_id": ServiceReport.field_job_id,
    "file_url": ServiceReport.file_url,
    "notes": ServiceReport.notes,
    "timestamp": ServiceReport.timestamp,
}

async def query_operator_page(
    db: AsyncSession,
    *,
    page: int, size: int, sort_by: str, sort_dir: str,
    search: str | None = None,
    field_job_id=None,
):
    sort_column = SORT_COLUMNS.get(sort_by)
    if sort_column is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported sort field: {sort_by}",
        )
    
    conditions = [
        ServiceReport.deleted_at.is_(None),
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
            or_(ServiceReport.notes.ilike(pattern, escape="\\"),)
        )

    if field_job_id is not None:
        conditions.append(ServiceReport.field_job_id == field_job_id)

    count_stmt = (
        select(func.count()).select_from(ServiceReport).where(*conditions)
    )
    ordering = (sort_column.desc() if sort_dir == "desc" else sort_column.asc())
    rows_stmt = (select(ServiceReport).where(*conditions).order_by(ordering))

    # if sort_by by other columns may have same value => then sort_by id asc for those
    if sort_by != "id":
        rows_stmt = rows_stmt.order_by(ServiceReport.id.asc())

    rows_stmt = (rows_stmt.offset((page - 1) * size).limit(size))

    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(rows_stmt)).scalars().all()

    return { "items": items, "total": total }

@router.get("", response_model=Page[ServiceReportRead])
async def list_service_reports(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(default=None, max_length=100),
    field_job_id: int | None = Query(default=None, ge=1),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("equipment:read"))
):
    return await query_operator_page(
        db, 
        page=pagination.page,
        size=pagination.size,
        sort_by=pagination.sort_by,
        sort_dir=pagination.sort_dir,
        search=search,
        field_job_id=field_job_id,
    )


# inactive list
@router.get("/inactive", response_model=list[ServiceReportRead])
async def inactive_service_reports(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    statement = (
        select(ServiceReport)
        .where(ServiceReport.deleted_at.is_not(None))
        .order_by(
            ServiceReport.deleted_at.desc(),
            ServiceReport.id.desc(),
        )
    )

    return (await db.scalars(statement)).all()


#TODO: Update upload service report when connect to AWS/S3Bucket
@router.post("", response_model=ServiceReportRead)
async def upload_service_report(
    field_job_id: int = Form(...),
    file: UploadFile = File(...),
    note: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN, UserRole.FIELD_HAND))
    _: User = Depends(require_permission("service_report:create"))
) -> ServiceReportRead:
    field_job = await db.get(FieldJob, field_job_id)
    if field_job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Field job {field_job_id} not found",
        )

    # Generate a unique S3 key for the uploaded file
    s3_key = f"service_reports/{uuid.uuid4()}_{file.filename}"

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
    await db.flush()

    add_audit(
        db,
        record_type="service_report",
        record_id=field_job_id,
        action="CREATE",
        actor=current_user,
        changes={
            key: {"before": None, "after": value}
            for key, value in snapshot(service_report).items()
        },
    )

    await db.commit()
    await db.refresh(service_report)

    return service_report

# @router.get("", response_model=list[ServiceReportRead])
# async def list_service_reports(
#     db: AsyncSession = Depends(get_db),
#     # _: User = Depends(get_current_user)
#     _: User = Depends(require_permission("service_report:read"))
# ) -> list[ServiceReportRead]:
#     statement = select(ServiceReport).order_by(ServiceReport.id)
#     result = await db.execute(statement)
#     service_reports = result.scalars().all()
#     return service_reports

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
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
    # _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
    _: User = Depends(require_permission("service_report:delete"))
):
    service_report = await db.get(ServiceReport, service_report_id)
    if service_report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service Report {service_report_id} not found"
        )

    await soft_delete_record(db, "service_report", service_report_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    # await db.delete(service_report)
    # await db.commit()

@router.post("/{service_report_id}/restore", response_model=ServiceReportRead)
async def restore_service_report(
    service_report_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN)),
):
    return await restore_record(db, "service_report", service_report_id, admin)

# read history
@router.get(
    "/{service_report_id}/history",
    response_model=list[AuditRead]
)
async def service_report_history(
    service_report_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    record = await get_record(db, "service_report", service_report_id, include_deleted=True,)

    role = getattr(user.role, "value", user.role) # to handle enum and string representation of role

    if (record.deleted_at is not None and role != UserRole.FARM_OPERATIONS_ADMIN):
        raise HTTPException(404, "Record not found")

    return await read_history(db, "service_report", service_report_id)
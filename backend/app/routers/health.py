import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.services.s3_service import s3_client
from app.config import settings
from app.models import User, UserRole


router = APIRouter(prefix="/health", tags=["health"])

@router.get("")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

DB_TIMEOUT_SECONDS = 3
S3_TIMEOUT_SECONDS = 4

logger = logging.getLogger(__name__)

async def check_database(
    db: AsyncSession
) -> bool:
    try:
        await asyncio.wait_for(
            db.execute(text("SELECT 1")),
            # db.execute(text("SELECT * FROM invalid_health_check")),
            timeout=DB_TIMEOUT_SECONDS,
        )
        return True
    except Exception:
        logger.exception("Database health check failed")
        return False

async def check_s3() -> bool:
    try:
        await asyncio.wait_for(
            asyncio.to_thread(
                s3_client.head_bucket,
                Bucket=settings.s3_bucket_name,
                # Bucket="agricore-invalid-bucket",
            ),
            timeout=S3_TIMEOUT_SECONDS,
        )
        return True
    except Exception:
        logger.exception("S3 health check failed")
        return False

@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    database_ok = await check_database(db)
    return JSONResponse(
        status_code=200 if database_ok else 503,
        content={
            "status": "ready" if database_ok else "not_ready",
        },
    )

@router.get("/detail")
async def detailed_health_check(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.FARM_OPERATIONS_ADMIN))
):
    database_ok, s3_ok = await asyncio.gather(
        check_database(db),
        check_s3(),
    )

    return {
        "status": (
            "healthy" if database_ok and s3_ok else "degraded"
        ),
        "ready": database_ok,
        "checks": {
            "database": "connected" if database_ok else "unavailable",
            "s3": "accessible" if s3_ok else "unavailable",
        }
    }

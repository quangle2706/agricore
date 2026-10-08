import hashlib
import re
import secrets

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.refresh_token import RefreshToken

# secrets.token_urlsafe(32) generates a 43-character string matching the TOKEN_PATTERN
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")

def unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Invalid or expired refresh token")

def validate_refresh_token(value: object) -> str:
    if not isinstance(value, str) or not TOKEN_PATTERN.fullmatch(value):
        raise unauthorized()
    return value

def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest() # Hash the raw token using SHA-256

def add_refresh_token(
    db: AsyncSession,
    user_id: int,
    *,
    chain_id: UUID | None = None,
    expires_at: datetime | None = None,
) -> str :
    now = datetime.now(timezone.utc)
    raw_token = secrets.token_urlsafe(32)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_token(raw_token),
            issued_at=now,
            expires_at=(
                expires_at if expires_at is not None else now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            ),
            revoked=False,
            chain_id=chain_id if chain_id is not None else uuid4(),
        )
    )

    # endpoint will handle the commit
    return raw_token

async def get_locked_token(
    db: AsyncSession,
    raw_token: str,
) -> RefreshToken | None:
    token_hash = hash_token(raw_token)

    # get chain_id before lock
    chain_id = await db.scalar(
        select(RefreshToken.chain_id).where(
            RefreshToken.token_hash == token_hash
        )
    )

    if chain_id is None:
        return None

    # Lock the entire chain, specifically for PostgreSQL.
    # All refresh/logout operations for the chain must go through this lock.
    await db.execute(
        text(
            "SELECT pg_advisory_xact_lock("
            "hashtextextended(:chain_key, 0)"
            ")"
        ),
        {"chain_key": f"refresh-chain:{chain_id}"},
    )

    # Read the token again AFTER acquiring the lock to see the latest state.
    return await db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .execution_options(populate_existing=True)
    )


async def revoke_chain(
    db: AsyncSession,
    chain_id: UUID,
) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.chain_id == chain_id)
        .values(revoked=True)
    )
    
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import AuditLog, User

def add_audit(
    db: AsyncSession,
    *,
    record_type: str,
    record_id: int,
    action: str,
    actor: User,
    changes: dict,
) -> None:
    db.add(AuditLog(
        record_type=record_type,
        record_id=record_id,
        action=action,
        actor_id=actor.id,
        changes=jsonable_encoder(changes), # change enum, datetime, and other non-serializable types to JSON serializable types
    ))
    # commit will be handled by the calling function

async def read_history(db, record_type, record_id):
    statement = (
        select(
            AuditLog.id,
            AuditLog.action,
            AuditLog.actor_id,
            User.username.label("actor_name"),
            AuditLog.occurred_at,
            AuditLog.changes,
        )
        .join(User, User.id == AuditLog.actor_id)
        .where(
            AuditLog.record_type == record_type,
            AuditLog.record_id == record_id,
        )
        .order_by(
            AuditLog.occurred_at.asc(),
            AuditLog.id.asc(),
        )
    )

    return (await db.execute(statement)).mappings().all()
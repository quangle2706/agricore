from datetime import datetime, timezone

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Equipment, FieldJob, User
from app.services.audit_service import add_audit

RECORD_MODELS = {
    "equipment": Equipment,
    "field_job": FieldJob,
}

async def get_record(
    db: AsyncSession,
    record_type: str,
    record_id: int,
    *,
    include_deleted: bool = False,
    lock: bool = False,
):
    model = RECORD_MODELS[record_type]

    statement = select(model).where(model.id == record_id)

    # to prevent returning a soft-deleted record unless explicitly requested, 
    # we filter out records with deleted_at set to a non-null value. 
    # This ensures that only active records are returned by default.
    if not include_deleted:
        statement = statement.where(model.deleted_at.is_(None))

    # to prevent race conditions and ensure data integrity, 
    # we can use a "FOR UPDATE" lock on the selected record.
    if lock:
        statement = statement.with_for_update()

    record = await db.scalar(statement)

    if record is None:
        raise HTTPException(404, "Record not found")

    return record


def snapshot(record) -> dict:
    # to create a snapshot of the current state of a record, 
    # we can iterate over its columns and extract their values.
    # We exclude the deleted_at and deleted_by fields from the snapshot, 
    # as they are not relevant to the record's business state. 
    # The resulting dictionary can be used for auditing or comparison purposes.
    return jsonable_encoder({
        column.key: getattr(record, column.key)
        for column in record.__table__.columns
        if column.key not in {"deleted_at", "deleted_by"}
    })


async def validate_equipment_reference(
    db: AsyncSession,
    record_type: str,
    values: dict,
) -> None:
    if record_type != "field_job":
        return

    if "equipment_id" not in values:
        return

    equipment_id = values["equipment_id"]

    if equipment_id is None:
        raise HTTPException(422, "equipment_id cannot be null")

    # Prevent assigning a new/updated job to deleted equipment.
    # Lock also coordinates with an equipment delete operation.
    await get_record(
        db,
        "equipment",
        equipment_id,
        lock=True,
    )


async def create_record(
    db: AsyncSession,
    record_type: str,
    payload,
    actor: User,
):
    try:

        # no id, deleted_at, or deleted_by fields.
        values = payload.model_dump()

        await validate_equipment_reference(
            db, record_type, values
        )

        model = RECORD_MODELS[record_type]
        record = model(**values)

        db.add(record)
        await db.flush()  # Generate record.id without committing.

        add_audit(
            db,
            record_type=record_type,
            record_id=record.id,
            action="CREATE",
            actor=actor,
            changes={
                key: {"before": None, "after": value}
                for key, value in snapshot(record).items()
            },
        )

        await db.commit()
        return record

    except Exception:
        await db.rollback()
        raise


async def update_record(
    db: AsyncSession,
    record_type: str,
    record_id: int,
    payload,
    actor: User,
):
    try:
        record = await get_record(
            db, record_type, record_id, lock=True
        )

        # only editable business fields.
        values = payload.model_dump(exclude_unset=True)

        await validate_equipment_reference(
            db, record_type, values
        )

        changes = {}

        for field, new_value in values.items():
            old_value = getattr(record, field)

            if old_value != new_value:
                changes[field] = {
                    "before": old_value,
                    "after": new_value,
                }
                setattr(record, field, new_value)

        if changes:
            add_audit(
                db,
                record_type=record_type,
                record_id=record.id,
                action="UPDATE",
                actor=actor,
                changes=changes,
            )

        await db.commit()
        return record

    except Exception:
        await db.rollback()
        raise


async def soft_delete_record(
    db: AsyncSession,
    record_type: str,
    record_id: int,
    actor: User,
):
    try:
        record = await get_record(
            db, record_type, record_id, lock=True
        )

        now = datetime.now(timezone.utc)

        record.deleted_at = now
        record.deleted_by = actor.id

        add_audit(
            db,
            record_type=record_type,
            record_id=record.id,
            action="DELETE",
            actor=actor,
            changes={
                "deleted_at": {
                    "before": None,
                    "after": now,
                },
                "deleted_by": {
                    "before": None,
                    "after": actor.id,
                },
            },
        )

        await db.commit()

    except Exception:
        await db.rollback()
        raise


async def restore_record(
    db: AsyncSession,
    record_type: str,
    record_id: int,
    actor: User,
):
    try:
        record = await get_record(
            db,
            record_type,
            record_id,
            include_deleted=True,
            lock=True,
        )

        if record.deleted_at is None:
            raise HTTPException(409, "Record is already active")

        changes = {
            "deleted_at": {
                "before": record.deleted_at,
                "after": None,
            },
            "deleted_by": {
                "before": record.deleted_by,
                "after": None,
            },
        }

        record.deleted_at = None
        record.deleted_by = None

        add_audit(
            db,
            record_type=record_type,
            record_id=record.id,
            action="RESTORE",
            actor=actor,
            changes=changes,
        )

        await db.commit()
        return record

    except Exception:
        await db.rollback()
        raise
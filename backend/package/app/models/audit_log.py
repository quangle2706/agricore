from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB 
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)

    record_type: Mapped[str] = mapped_column(String(30))
    record_id: Mapped[int] = mapped_column(Integer)

    action: Mapped[str] = mapped_column(String(20))
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    occurred_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    changes: Mapped[dict] = mapped_column(JSONB, nullable=False) # to store the changes made to the record in JSON format

    # table args for indexing and performance optimization
    __table_args__ = (
        Index(
            "ix_audit_record_history",
            "record_type",
            "record_id",
            "occurred_at",
            "id",
        ),
    )
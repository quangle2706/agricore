#ServiceReport (id, file_url, notes, timestamp + field_job_id)

from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, Integer, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .field_job import FieldJob

class ServiceReport(Base):
    __tablename__ = "service_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    file_url: Mapped[str] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    field_job_id: Mapped[int] = mapped_column(Integer, ForeignKey("field_jobs.id"))

    field_job: Mapped["FieldJob"] = relationship(back_populates="service_reports")

    def __repr__(self) -> str:
        return (f"Service Report(id={self.id}, field_job_id={self.field_job_id}, "
                f"file_url={self.file_url!r})")

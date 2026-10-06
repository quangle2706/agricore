#Field Job(id, title, priority, status, equipment_id, operator_id)

from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .enums import FieldJobPriority, FieldJobStatus

if TYPE_CHECKING:
    from .equipment import Equipment
    from .operator import Operator
    from .service_report import ServiceReport

class FieldJob(Base):
    __tablename__ = "field_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    priority: Mapped[FieldJobPriority] = mapped_column(
        SqlEnum(
            FieldJobPriority,
            name="field_job_priority",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        # default=FieldJobPriority.MEDIUM,
    )
    status: Mapped[FieldJobStatus] = mapped_column(
        SqlEnum(
            FieldJobStatus,
            name="field_job_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=FieldJobStatus.PENDING,
    )
    equipment_id: Mapped[int] = mapped_column(Integer, ForeignKey("equipments.id"))
    operator_id: Mapped[int] = mapped_column(Integer, ForeignKey("operators.id"))

    equipment: Mapped["Equipment"] = relationship(back_populates="field_jobs")
    operator: Mapped["Operator"] = relationship(back_populates="field_jobs")
    service_reports: Mapped[list["ServiceReport"]] = relationship(back_populates="field_job")

    def mark_completed(self) -> None:
        self.status = FieldJobStatus.COMPLETED

    def mark_failed(self) -> None:
        self.status = FieldJobStatus.FAILED

    def __repr__(self):
        return (f"Field Job(id={self.id}, title={self.title!r}, "
                f"priority={self.priority.value}, status={self.status.value})") #enum use .value
#Equipment(id, serial_number, model, status, fuel_level, farm_id)

from __future__ import annotations
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, Numeric, CheckConstraint, ForeignKey
from sqlalchemy import Enum as SqlEnum #Differentiate with Enum of Python
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .enums import EquipmentStatus

if TYPE_CHECKING:
    from .farm import Farm
    from .field_job import FieldJob

class Equipment(Base):
    __tablename__ = "equipments"

    #there is a table level constaint where the fuel_level column is ALWAYS between 0 and 100
    __table_args__ = (
        CheckConstraint("fuel_level BETWEEN 0 AND 100",
                        name="fuel_level_range"), #must have a comma
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    serial_number: Mapped[str] = mapped_column(String(50), unique=True)
    model: Mapped[str] = mapped_column(String(100))
    #status uses our enum
    status: Mapped[EquipmentStatus] = mapped_column(
        SqlEnum(
            EquipmentStatus,
            name="equipment_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=EquipmentStatus.IDLE,
    )
    fuel_level: Mapped[Decimal] = mapped_column(Numeric(5,2))
    farm_id: Mapped[int] = mapped_column(Integer, ForeignKey("farms.id"))

    farm: Mapped["Farm"] = relationship(back_populates="equipments")
    field_jobs: Mapped[list["FieldJob"]] = relationship(back_populates="equipment")

    LOW_FUEL_THRESHOLD: int = 20

    def is_low_fuel(self, threshold: int | None = None) -> bool:
        limit = threshold if threshold is not None else self.LOW_FUEL_THRESHOLD
        return self.fuel_level < limit

    def needs_maintenance(self) -> bool:
        return self.status == EquipmentStatus.MAINTENANCE

    #tostring
    def __repr__(self):
        return (f"Equipment(serial={self.serial_number!r}, model={self.model!r}, "
                f"Fuel={self.fuel_level}%, status={self.status.value})")
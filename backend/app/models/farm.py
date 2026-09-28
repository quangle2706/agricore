#Farm(id, name, location_region, capacity, supervisor_id)

from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .operator import Operator
    from .equipment import Equipment

class Farm(Base):
    #setting the table name for the farm model in the database
    __tablename__ = "farms"

    #define our columns
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    location_region: Mapped[str] = mapped_column(String(50))
    capacity: Mapped[int] = mapped_column(Integer)
    supervisor_id: Mapped[int] = mapped_column(Integer)

    #creating the relationship with other tables
    equipments: Mapped[list["Equipment"]] = relationship(back_populates="farm")
    operators: Mapped[list["Operator"]] = relationship(back_populates="farm")

    def __repr__(self) -> str:
        return (f"Farm(id={self.id}, name={self.name!r}, "
                f"region={self.location_region!r})")

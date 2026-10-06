#Operator(id, name, farm_id)

from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

#let us import Farm for type hints without importing it at runtime
# -> prevent a circular import if farm.py also refer to Operator
if TYPE_CHECKING:
    from .farm import Farm
    from .field_job import FieldJob

class Operator(Base):
    __tablename__ = "operators"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    farm_id: Mapped[int] = mapped_column(Integer, ForeignKey("farms.id"))

    farm: Mapped["Farm"] = relationship(back_populates="operators")
    field_jobs: Mapped[list["FieldJob"]] = relationship(back_populates="operator")

    def __repr__(self):
        return (f"Operator(id={self.id}, name={self.name!r}, "
                f"farm_id={self.farm_id})")
import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    slot_datetime: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus), default=AppointmentStatus.confirmed, nullable=False
    )
    reason_for_visit: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships with explicit foreign_keys to avoid AmbiguousForeignKeysError
    patient: Mapped["User"] = relationship(  # noqa: F821
        foreign_keys=[patient_id]
    )
    doctor: Mapped["User"] = relationship(  # noqa: F821
        foreign_keys=[doctor_id]
    )

    __table_args__ = (
        Index(
            "uq_appointment_active_slot",
            "doctor_id",
            "slot_datetime",
            unique=True,
            postgresql_where=text("status != 'cancelled'"),
        ),
    )

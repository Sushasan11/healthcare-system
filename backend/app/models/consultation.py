import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.core.encryption import EncryptedString


class ConsultationStatus(str, enum.Enum):
    active = "active"
    completed = "completed"


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id"), unique=True, nullable=False
    )
    status: Mapped[ConsultationStatus] = mapped_column(
        Enum(ConsultationStatus), default=ConsultationStatus.active, nullable=False
    )
    started_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    appointment: Mapped["Appointment"] = relationship()  # noqa: F821
    messages: Mapped[list["Message"]] = relationship(
        back_populates="consultation", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "consultation_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    consultation_id: Mapped[int] = mapped_column(
        ForeignKey("consultations.id"), nullable=False
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str | None] = mapped_column(
        EncryptedString, nullable=True
    )  # PHI encrypted via AES-256-GCM
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    delivered_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    consultation: Mapped["Consultation"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship()  # noqa: F821

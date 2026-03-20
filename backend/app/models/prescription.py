import enum

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.core.encryption import EncryptedString


class PrescriptionStatus(str, enum.Enum):
    issued = "issued"
    dispensed = "dispensed"
    completed = "completed"


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    consultation_id: Mapped[int] = mapped_column(
        ForeignKey("consultations.id"), nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    diagnosis: Mapped[str] = mapped_column(EncryptedString, nullable=False)  # PHI
    status: Mapped[PrescriptionStatus] = mapped_column(
        Enum(PrescriptionStatus), default=PrescriptionStatus.issued, nullable=False
    )
    hmac_token: Mapped[str] = mapped_column(String(64), nullable=False)
    issued_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    items: Mapped[list["PrescriptionItem"]] = relationship(
        back_populates="prescription", cascade="all, delete-orphan"
    )
    consultation: Mapped["Consultation"] = relationship()  # noqa: F821
    doctor: Mapped["User"] = relationship(foreign_keys=[doctor_id])  # noqa: F821
    patient: Mapped["User"] = relationship(foreign_keys=[patient_id])  # noqa: F821


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prescription_id: Mapped[int] = mapped_column(
        ForeignKey("prescriptions.id"), nullable=False
    )
    medicine_name: Mapped[str] = mapped_column(EncryptedString, nullable=False)  # PHI
    dosage_amount: Mapped[str] = mapped_column(EncryptedString, nullable=False)  # PHI
    dosage_unit: Mapped[str] = mapped_column(EncryptedString, nullable=False)  # PHI
    frequency: Mapped[str] = mapped_column(EncryptedString, nullable=False)  # PHI
    duration: Mapped[str] = mapped_column(EncryptedString, nullable=False)  # PHI
    instructions: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)  # PHI

    # Relationships
    prescription: Mapped["Prescription"] = relationship(back_populates="items")


class Drug(Base):
    __tablename__ = "drugs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    generic_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    form: Mapped[str | None] = mapped_column(String(100), nullable=True)

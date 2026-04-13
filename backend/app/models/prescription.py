import enum

from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    false as sa_false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.core.encryption import EncryptedString


class PrescriptionStatus(str, enum.Enum):
    issued = "issued"
    ordered = "ordered"
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
    drug_id: Mapped[int | None] = mapped_column(
        ForeignKey("drugs.id"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )

    # Relationships
    prescription: Mapped["Prescription"] = relationship(back_populates="items")
    drug: Mapped["Drug | None"] = relationship(foreign_keys=[drug_id])


class MedicineCategory(str, enum.Enum):
    pain_relief = "pain_relief"
    cold_and_flu = "cold_and_flu"
    digestive = "digestive"
    vitamins_supplements = "vitamins_supplements"
    first_aid = "first_aid"
    skin_care = "skin_care"


class Drug(Base):
    __tablename__ = "drugs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    generic_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    form: Mapped[str | None] = mapped_column(String(100), nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=MedicineCategory.first_aid.value,
        server_default="first_aid",
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    dosage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stock_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    low_stock_threshold: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10, server_default="10"
    )
    rx_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sa_false()
    )
    archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sa_false()
    )

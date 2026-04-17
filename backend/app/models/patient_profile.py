from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.encryption import EncryptedString
from app.db import Base


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    # --- UNENCRYPTED (query-able) ---
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    blood_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # --- ENCRYPTED PHI (AES-256-GCM) ---
    phone: Mapped[str | None] = mapped_column(EncryptedString(500), nullable=True)
    address: Mapped[str | None] = mapped_column(EncryptedString(1000), nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(EncryptedString(500), nullable=True)
    allergies: Mapped[str | None] = mapped_column(EncryptedString(2000), nullable=True)
    current_medications: Mapped[str | None] = mapped_column(EncryptedString(2000), nullable=True)
    chronic_conditions: Mapped[str | None] = mapped_column(EncryptedString(2000), nullable=True)
    # Relationships
    user: Mapped["User"] = relationship(back_populates="patient_profile")  # noqa: F821

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    pharmacist = "pharmacist"
    admin = "admin"


class AccountStatus(str, enum.Enum):
    pending_verification = "pending_verification"  # email not yet verified
    pending_approval = "pending_approval"  # doctor/pharmacist awaiting admin
    active = "active"
    suspended = "suspended"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    account_status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus), default=AccountStatus.pending_verification, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Doctor-specific fields (nullable for non-doctors)
    specialty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    medical_license_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    years_of_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Shared optional fields
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    # Relationships
    patient_profile: Mapped["PatientProfile | None"] = relationship(  # noqa: F821
        back_populates="user", uselist=False
    )
    doctor_profile: Mapped["DoctorProfile | None"] = relationship(  # noqa: F821
        back_populates="user", uselist=False
    )

import enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    qualifications: Mapped[str | None] = mapped_column(Text, nullable=True)
    consultation_fee: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rating: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="doctor_profile")  # noqa: F821
    availability: Mapped[list["DoctorAvailability"]] = relationship(
        back_populates="doctor_profile", cascade="all, delete-orphan"
    )
    slot_blocks: Mapped[list["SlotBlock"]] = relationship(
        back_populates="doctor_profile", cascade="all, delete-orphan"
    )


class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_profile_id: Mapped[int] = mapped_column(ForeignKey("doctor_profiles.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon, 6=Sun
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # "HH:MM"
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    doctor_profile: Mapped["DoctorProfile"] = relationship(back_populates="availability")


class SlotBlock(Base):
    __tablename__ = "slot_blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doctor_profile_id: Mapped[int] = mapped_column(ForeignKey("doctor_profiles.id"), nullable=False)
    slot_datetime: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    doctor_profile: Mapped["DoctorProfile"] = relationship(back_populates="slot_blocks")

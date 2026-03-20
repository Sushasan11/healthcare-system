"""Availability router — doctor schedule management and slot generation.

Endpoints:
  GET    /doctors/me/schedule           — doctor reads own weekly schedule
  PUT    /doctors/me/schedule           — doctor sets own weekly schedule
  POST   /doctors/me/schedule/blocks    — doctor blocks a specific slot
  DELETE /doctors/me/schedule/blocks    — doctor unblocks a specific slot
  GET    /doctors/{doctor_id}/slots     — public slot listing for a doctor
"""

from datetime import date, datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.db import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor_profile import DoctorAvailability, DoctorProfile, SlotBlock
from app.models.user import User, UserRole
from app.schemas.appointment import SlotOut
from app.schemas.doctor import DoctorAvailabilityIn, DoctorAvailabilityOut
from app.services.slot_generator import generate_available_slots

router = APIRouter(tags=["availability"])


class SlotBlockRequest(BaseModel):
    slot_datetime: datetime


async def _get_or_create_profile(user: User, db: AsyncSession) -> DoctorProfile:
    """Get doctor profile, creating one if it doesn't exist."""
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = DoctorProfile(user_id=user.id)
        db.add(profile)
        await db.flush()
    return profile


@router.get("/doctors/me/schedule", response_model=list[DoctorAvailabilityOut])
async def get_my_schedule(
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    """Return the doctor's current weekly schedule."""
    result = await db.execute(
        select(DoctorProfile)
        .options(selectinload(DoctorProfile.availability))
        .where(DoctorProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return []

    return [DoctorAvailabilityOut.model_validate(a) for a in profile.availability]


@router.put("/doctors/me/schedule", response_model=list[DoctorAvailabilityOut])
async def update_my_schedule(
    schedule: list[DoctorAvailabilityIn],
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    """Replace the doctor's weekly schedule entirely."""
    profile = await _get_or_create_profile(current_user, db)

    # Delete existing availability rows for this profile
    await db.execute(
        delete(DoctorAvailability).where(
            DoctorAvailability.doctor_profile_id == profile.id
        )
    )

    # Insert new rows
    new_entries = []
    for entry in schedule:
        avail = DoctorAvailability(
            doctor_profile_id=profile.id,
            day_of_week=entry.day_of_week,
            start_time=entry.start_time,
            end_time=entry.end_time,
            is_active=entry.is_active,
        )
        db.add(avail)
        new_entries.append(avail)

    await db.commit()
    for entry in new_entries:
        await db.refresh(entry)

    return [DoctorAvailabilityOut.model_validate(a) for a in new_entries]


@router.post("/doctors/me/schedule/blocks", status_code=status.HTTP_201_CREATED)
async def add_slot_block(
    data: SlotBlockRequest,
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    """Block a specific slot datetime so it won't appear in available slots."""
    profile = await _get_or_create_profile(current_user, db)

    block = SlotBlock(
        doctor_profile_id=profile.id,
        slot_datetime=data.slot_datetime,
    )
    db.add(block)
    await db.commit()
    return {"detail": "Slot blocked"}


@router.delete("/doctors/me/schedule/blocks", status_code=status.HTTP_204_NO_CONTENT)
async def remove_slot_block(
    data: SlotBlockRequest,
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a slot block, making the slot available again."""
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    await db.execute(
        delete(SlotBlock).where(
            SlotBlock.doctor_profile_id == profile.id,
            SlotBlock.slot_datetime == data.slot_datetime,
        )
    )
    await db.commit()


@router.get("/doctors/{doctor_id}/slots", response_model=list[SlotOut])
async def get_doctor_slots(
    doctor_id: int,
    start_date: date = Query(default=None),
    days: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    """Return available appointment slots for a specific doctor. Public endpoint."""
    if start_date is None:
        start_date = date.today()

    # Verify doctor exists and is active
    result = await db.execute(
        select(User).where(User.id == doctor_id).where(User.role == UserRole.doctor)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found")

    # Load doctor profile with schedule and blocks
    profile_result = await db.execute(
        select(DoctorProfile)
        .options(
            selectinload(DoctorProfile.availability),
            selectinload(DoctorProfile.slot_blocks),
        )
        .where(DoctorProfile.user_id == doctor_id)
    )
    profile = profile_result.scalar_one_or_none()

    if not profile:
        return []

    # Load existing non-cancelled appointments for this doctor
    appt_result = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status != AppointmentStatus.cancelled,
        )
    )
    booked_appointments = appt_result.scalars().all()

    # Build schedule list for slot_generator
    schedule = [
        {
            "day_of_week": a.day_of_week,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "is_active": a.is_active,
        }
        for a in profile.availability
    ]

    _UTC = ZoneInfo("UTC")

    def _to_utc(dt: datetime) -> datetime:
        """Ensure datetime is UTC-aware (handle SQLite returning naive datetimes)."""
        if dt is None:
            return dt
        if dt.tzinfo is None:
            return dt.replace(tzinfo=_UTC)
        return dt.astimezone(_UTC)

    # Build blocked datetimes
    blocks = [_to_utc(b.slot_datetime) for b in profile.slot_blocks]

    # Build booked datetimes
    booked = [_to_utc(appt.slot_datetime) for appt in booked_appointments]

    available_slots = generate_available_slots(
        schedule=schedule,
        blocks=blocks,
        booked=booked,
        start_date=start_date,
        days=days,
    )

    return [SlotOut(slot_datetime=slot, is_available=True) for slot in available_slots]

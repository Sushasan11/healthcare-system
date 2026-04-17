"""Appointments router — slot holds, booking, listing, and cancellation.

Endpoints:
  POST   /appointments/hold     — patient holds a slot via DB SETNX
  POST   /appointments          — patient books a confirmed appointment
  GET    /appointments          — role-filtered appointment listing
  DELETE /appointments/{id}     — cancel appointment (2-hour guard)
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.db import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor_profile import DoctorProfile
from app.models.payment import Payment, PaymentStatus
from app.models.user import AccountStatus, User, UserRole
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentOut,
    SlotHoldRequest,
    SlotHoldResponse,
)
from app.services.kv_store import KVStore
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/appointments", tags=["appointments"])

SLOT_HOLD_TTL = 300  # 5 minutes in seconds


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


async def acquire_slot_hold(kv: KVStore, doctor_id: int, slot_dt: datetime) -> bool:
    """Try to acquire a slot hold. Returns True if acquired."""
    key = f"slot_hold:{doctor_id}:{slot_dt.isoformat()}"
    result = await kv.set(key, "held", nx=True, ex=SLOT_HOLD_TTL)
    return result is not None


async def release_slot_hold(kv: KVStore, doctor_id: int, slot_dt: datetime) -> None:
    """Release a slot hold key."""
    await kv.delete(f"slot_hold:{doctor_id}:{slot_dt.isoformat()}")


def _build_appointment_out(
    appt: Appointment, payment: Payment | None = None
) -> AppointmentOut:
    """Build AppointmentOut from an Appointment with loaded relationships."""
    doctor_name = appt.doctor.full_name if appt.doctor else None
    patient_name = appt.patient.full_name if appt.patient else None
    payment_status = None
    payment_amount = None
    if payment is not None:
        payment_status = (
            payment.status.value if hasattr(payment.status, "value") else payment.status
        )
        payment_amount = str(payment.gross_amount)
    return AppointmentOut(
        id=appt.id,
        patient_id=appt.patient_id,
        doctor_id=appt.doctor_id,
        slot_datetime=appt.slot_datetime,
        status=appt.status.value if hasattr(appt.status, "value") else appt.status,
        reason_for_visit=appt.reason_for_visit,
        created_at=appt.created_at,
        doctor_name=doctor_name,
        patient_name=patient_name,
        payment_status=payment_status,
        payment_amount=payment_amount,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/hold", response_model=SlotHoldResponse, status_code=status.HTTP_201_CREATED)
async def hold_slot(
    data: SlotHoldRequest,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """Hold a slot for 5 minutes. Patient role only."""
    # Check DB for existing non-cancelled appointment at this slot
    existing = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == data.doctor_id,
            Appointment.slot_datetime == data.slot_datetime,
            Appointment.status != AppointmentStatus.cancelled,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot already booked",
        )

    # Acquire slot hold
    kv = KVStore(db)
    acquired = await acquire_slot_hold(kv, data.doctor_id, data.slot_datetime)
    if not acquired:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot is currently held by another patient",
        )

    held_until = datetime.now(timezone.utc) + timedelta(seconds=SLOT_HOLD_TTL)
    return SlotHoldResponse(held_until=held_until)


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def book_appointment(
    data: AppointmentCreate,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """Book a confirmed appointment. Patient role only."""
    # Check DB for existing non-cancelled appointment
    existing = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == data.doctor_id,
            Appointment.slot_datetime == data.slot_datetime,
            Appointment.status != AppointmentStatus.cancelled,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot already booked",
        )

    # Verify doctor exists and is active
    doctor_result = await db.execute(
        select(User).where(
            User.id == data.doctor_id,
            User.role == UserRole.doctor,
            User.account_status == AccountStatus.active,
        )
    )
    doctor = doctor_result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found or not active",
        )

    # Fetch doctor profile for consultation fee
    profile_result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.user_id == data.doctor_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile or profile.consultation_fee is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Doctor has no consultation fee set",
        )

    # Create appointment first to obtain its id
    appointment = Appointment(
        patient_id=current_user.id,
        doctor_id=data.doctor_id,
        slot_datetime=data.slot_datetime,
        status=AppointmentStatus.confirmed,
        reason_for_visit=data.reason_for_visit,
    )
    db.add(appointment)
    await db.flush()

    # Charge consultation fee (per D-01). PaymentService does not commit.
    payment_service = PaymentService(db)
    try:
        payment = await payment_service.charge_consultation(
            appointment_id=appointment.id,
            patient_id=current_user.id,
            provider_id=data.doctor_id,
            gross_amount=Decimal(str(profile.consultation_fee)),
        )
    except ValueError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment could not be processed. Please try again.",
        )

    await db.commit()

    # Release slot hold
    kv = KVStore(db)
    await release_slot_hold(kv, data.doctor_id, data.slot_datetime)

    # Eager-load patient and doctor relationships
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
        .where(Appointment.id == appointment.id)
    )
    appt_with_rels = result.scalar_one()
    payment_result = await db.execute(
        select(Payment).where(Payment.appointment_id == appt_with_rels.id)
    )
    payment_obj = payment_result.scalar_one_or_none()
    return _build_appointment_out(appt_with_rels, payment=payment_obj)


@router.get("", response_model=list[AppointmentOut])
async def list_appointments(
    status: str | None = Query(default=None),
    tab: str = Query(default="upcoming"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List appointments filtered by role and tab. Requires auth."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    query = (
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
    )

    # Role-based filter
    if current_user.role == UserRole.doctor:
        query = query.where(Appointment.doctor_id == current_user.id)
    elif current_user.role == UserRole.patient:
        query = query.where(Appointment.patient_id == current_user.id)

    # Status filter
    if status:
        query = query.where(Appointment.status == status)
    else:
        # Tab-based filter
        if tab == "today":
            query = query.where(
                Appointment.slot_datetime >= today_start,
                Appointment.slot_datetime < today_end,
            )
        elif tab == "upcoming":
            query = query.where(
                Appointment.slot_datetime >= now,
                Appointment.status != AppointmentStatus.cancelled,
            )
        elif tab == "past":
            query = query.where(
                (Appointment.slot_datetime < now) |
                Appointment.status.in_([
                    AppointmentStatus.cancelled,
                    AppointmentStatus.completed,
                ])
            )

    result = await db.execute(query)
    appointments = result.scalars().all()

    appt_ids = [a.id for a in appointments]
    if appt_ids:
        payment_results = await db.execute(
            select(Payment).where(Payment.appointment_id.in_(appt_ids))
        )
        payments_by_appt = {
            p.appointment_id: p for p in payment_results.scalars().all()
        }
    else:
        payments_by_appt = {}
    return [
        _build_appointment_out(a, payment=payments_by_appt.get(a.id))
        for a in appointments
    ]


@router.delete("/{appointment_id}", response_model=AppointmentOut)
async def cancel_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an appointment. Enforces 2-hour cancellation window."""
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
        .where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    # Check ownership
    if current_user.role == UserRole.patient and appointment.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own appointments",
        )
    if current_user.role == UserRole.doctor and appointment.doctor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own appointments",
        )

    # Check 2-hour cancellation window
    now = datetime.now(timezone.utc)
    slot_dt = appointment.slot_datetime
    # Normalize slot_dt to UTC-aware if it comes back timezone-naive (SQLite)
    if slot_dt.tzinfo is None:
        from zoneinfo import ZoneInfo
        slot_dt = slot_dt.replace(tzinfo=ZoneInfo("UTC"))

    if (slot_dt - now) < timedelta(hours=2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel within 2 hours of appointment",
        )

    # Refund payment if exists and completed (per D-03)
    payment_result = await db.execute(
        select(Payment).where(Payment.appointment_id == appointment_id)
    )
    existing_payment = payment_result.scalar_one_or_none()
    if existing_payment and existing_payment.status == PaymentStatus.completed:
        payment_service = PaymentService(db)
        await payment_service.refund_payment(existing_payment)

    appointment.status = AppointmentStatus.cancelled
    await db.commit()
    await db.refresh(appointment)

    # Reload with relationships after refresh
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
        .where(Appointment.id == appointment_id)
    )
    appt_with_rels = result.scalar_one()
    payment_reload = await db.execute(
        select(Payment).where(Payment.appointment_id == appointment_id)
    )
    payment_obj = payment_reload.scalar_one_or_none()
    return _build_appointment_out(appt_with_rels, payment=payment_obj)

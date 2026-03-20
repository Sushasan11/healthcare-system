"""Appointment endpoint tests — covers APPT-01, APPT-02.

Tests use the async_client fixture from conftest.py which provides:
- SQLite (aiosqlite) in-memory test database
- fakeredis for Redis isolation
"""

from datetime import date, datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AccountStatus, User


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


async def register_and_activate_doctor(
    client: AsyncClient,
    db: AsyncSession,
    email: str = "appt_doctor@example.dev",
    password: str = "Test@1234",
    full_name: str = "Appt Doctor",
    specialty: str = "Cardiology",
) -> tuple[str, int]:
    """Register a doctor, activate account, login. Returns (token, user_id)."""
    response = await client.post(
        "/auth/register/doctor",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "specialty": specialty,
            "medical_license_number": "LIC-APPT-001",
            "years_of_experience": 5,
        },
    )
    assert response.status_code == 201, f"Register failed: {response.json()}"
    user_id = response.json()["id"]

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one()
    user.email_verified = True
    user.account_status = AccountStatus.active
    await db.commit()

    login_resp = await client.post(
        "/auth/login", json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.json()}"
    return login_resp.json()["access_token"], user_id


async def register_and_activate_patient(
    client: AsyncClient,
    db: AsyncSession,
    email: str = "appt_patient@example.dev",
    password: str = "Test@1234",
    full_name: str = "Appt Patient",
) -> tuple[str, int]:
    """Register a patient, activate account, login. Returns (token, user_id)."""
    response = await client.post(
        "/auth/register/patient",
        json={"email": email, "password": password, "full_name": full_name},
    )
    assert response.status_code == 201, f"Register failed: {response.json()}"
    user_id = response.json()["id"]

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one()
    user.email_verified = True
    user.account_status = AccountStatus.active
    await db.commit()

    login_resp = await client.post(
        "/auth/login", json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.json()}"
    return login_resp.json()["access_token"], user_id


def get_next_monday_slots() -> list[datetime]:
    """Return the first 4 slot datetimes for next Monday 09:00-11:00 UTC."""
    today = date.today()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    next_monday = today + timedelta(days=days_ahead)

    slots = []
    for i in range(4):
        minute_offset = i * 30
        hour = 9 + minute_offset // 60
        minute = minute_offset % 60
        dt = datetime(
            next_monday.year, next_monday.month, next_monday.day,
            hour, minute, tzinfo=timezone.utc
        )
        slots.append(dt)
    return slots


async def setup_doctor_with_schedule(
    client: AsyncClient,
    db: AsyncSession,
    email: str,
    full_name: str = "Schedule Doctor",
) -> tuple[str, int]:
    """Register, activate doctor, set Mon 09:00-11:00 schedule. Returns (token, user_id)."""
    token, doctor_id = await register_and_activate_doctor(
        client, db, email=email, full_name=full_name
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Set schedule: Monday 09:00-11:00
    sched_resp = await client.put(
        "/doctors/me/schedule",
        json=[{"day_of_week": 0, "start_time": "09:00", "end_time": "11:00", "is_active": True}],
        headers=headers,
    )
    assert sched_resp.status_code == 200
    return token, doctor_id


# ---------------------------------------------------------------------------
# Slot hold tests
# ---------------------------------------------------------------------------


class TestSlotHold:
    async def test_slot_hold(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Patient can hold a slot, gets 201 with held_until. Second hold returns 409."""
        _, doctor_id = await setup_doctor_with_schedule(
            async_client, db_session, email="hold_doc@example.dev"
        )
        patient_token, _ = await register_and_activate_patient(
            async_client, db_session, email="hold_patient@example.dev"
        )
        headers = {"Authorization": f"Bearer {patient_token}"}

        slot = get_next_monday_slots()[0]

        # First hold
        resp = await async_client.post(
            "/appointments/hold",
            json={"doctor_id": doctor_id, "slot_datetime": slot.isoformat()},
            headers=headers,
        )
        assert resp.status_code == 201, f"Hold failed: {resp.json()}"
        data = resp.json()
        assert "held_until" in data

        # Second hold for same slot should be 409
        resp2 = await async_client.post(
            "/appointments/hold",
            json={"doctor_id": doctor_id, "slot_datetime": slot.isoformat()},
            headers=headers,
        )
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# Booking tests
# ---------------------------------------------------------------------------


class TestAppointmentBooking:
    async def test_book_appointment(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Patient books appointment, gets 201. Slot no longer in /doctors/{id}/slots."""
        _, doctor_id = await setup_doctor_with_schedule(
            async_client, db_session, email="book_doc@example.dev"
        )
        patient_token, _ = await register_and_activate_patient(
            async_client, db_session, email="book_patient@example.dev"
        )
        p_headers = {"Authorization": f"Bearer {patient_token}"}

        slot = get_next_monday_slots()[0]
        next_monday = slot.date()

        # Check slot exists before booking
        slots_before = await async_client.get(
            f"/doctors/{doctor_id}/slots",
            params={"start_date": next_monday.isoformat(), "days": 7},
        )
        assert slots_before.status_code == 200
        assert len(slots_before.json()) == 4

        # Book the appointment
        book_resp = await async_client.post(
            "/appointments",
            json={
                "doctor_id": doctor_id,
                "slot_datetime": slot.isoformat(),
                "reason_for_visit": "Checkup",
            },
            headers=p_headers,
        )
        assert book_resp.status_code == 201, f"Booking failed: {book_resp.json()}"
        appt = book_resp.json()
        assert appt["status"] == "confirmed"
        assert appt["doctor_name"] is not None
        assert appt["patient_name"] is not None

        # GET /appointments should show it
        list_resp = await async_client.get("/appointments", headers=p_headers)
        assert list_resp.status_code == 200
        appt_ids = [a["id"] for a in list_resp.json()]
        assert appt["id"] in appt_ids

        # Slot no longer available after booking
        slots_after = await async_client.get(
            f"/doctors/{doctor_id}/slots",
            params={"start_date": next_monday.isoformat(), "days": 7},
        )
        assert slots_after.status_code == 200
        slot_dts = [s["slot_datetime"] for s in slots_after.json()]
        # The booked slot should no longer appear
        assert len(slots_after.json()) == 3

    async def test_double_book_fails(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """After booking, another patient trying the same slot gets 409."""
        _, doctor_id = await setup_doctor_with_schedule(
            async_client, db_session, email="dbl_doc@example.dev"
        )
        patient1_token, _ = await register_and_activate_patient(
            async_client, db_session, email="dbl_patient1@example.dev"
        )
        patient2_token, _ = await register_and_activate_patient(
            async_client, db_session, email="dbl_patient2@example.dev"
        )

        slot = get_next_monday_slots()[0]

        # Patient 1 books
        resp1 = await async_client.post(
            "/appointments",
            json={"doctor_id": doctor_id, "slot_datetime": slot.isoformat()},
            headers={"Authorization": f"Bearer {patient1_token}"},
        )
        assert resp1.status_code == 201

        # Patient 2 tries same slot
        resp2 = await async_client.post(
            "/appointments",
            json={"doctor_id": doctor_id, "slot_datetime": slot.isoformat()},
            headers={"Authorization": f"Bearer {patient2_token}"},
        )
        assert resp2.status_code == 409


# ---------------------------------------------------------------------------
# Cancellation tests
# ---------------------------------------------------------------------------


class TestCancellation:
    async def test_cancel_appointment(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Patient cancels appointment more than 2 hours away, gets 200 with status cancelled."""
        _, doctor_id = await setup_doctor_with_schedule(
            async_client, db_session, email="cancel_doc@example.dev"
        )
        patient_token, _ = await register_and_activate_patient(
            async_client, db_session, email="cancel_patient@example.dev"
        )
        p_headers = {"Authorization": f"Bearer {patient_token}"}

        slot = get_next_monday_slots()[0]  # Next Monday 09:00 — far in the future

        # Book appointment
        book_resp = await async_client.post(
            "/appointments",
            json={"doctor_id": doctor_id, "slot_datetime": slot.isoformat()},
            headers=p_headers,
        )
        assert book_resp.status_code == 201
        appt_id = book_resp.json()["id"]

        # Cancel it
        cancel_resp = await async_client.delete(
            f"/appointments/{appt_id}",
            headers=p_headers,
        )
        assert cancel_resp.status_code == 200
        assert cancel_resp.json()["status"] == "cancelled"

    async def test_cancel_too_late(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Patient tries to cancel appointment < 2 hours away, gets 400."""
        _, doctor_id = await setup_doctor_with_schedule(
            async_client, db_session, email="late_doc@example.dev"
        )
        patient_token, _ = await register_and_activate_patient(
            async_client, db_session, email="late_patient@example.dev"
        )
        p_headers = {"Authorization": f"Bearer {patient_token}"}

        # Set slot to 30 minutes from now (within 2-hour window)
        soon_slot = datetime.now(timezone.utc) + timedelta(minutes=30)

        # Directly insert appointment bypassing slot availability checks
        from app.models.appointment import Appointment, AppointmentStatus
        from sqlalchemy import select

        # Get patient and doctor IDs from DB
        patient_result = await db_session.execute(
            select(User).where(User.email == "late_patient@example.dev")
        )
        patient_user = patient_result.scalar_one()

        appt = Appointment(
            patient_id=patient_user.id,
            doctor_id=doctor_id,
            slot_datetime=soon_slot,
            status=AppointmentStatus.confirmed,
        )
        db_session.add(appt)
        await db_session.commit()
        await db_session.refresh(appt)

        # Try to cancel
        cancel_resp = await async_client.delete(
            f"/appointments/{appt.id}",
            headers=p_headers,
        )
        assert cancel_resp.status_code == 400
        assert "2 hours" in cancel_resp.json()["detail"]


# ---------------------------------------------------------------------------
# Doctor appointment view tests
# ---------------------------------------------------------------------------


class TestDoctorAppointmentsView:
    async def test_doctor_appointments_view(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Doctor GETs /appointments, sees their upcoming appointments with patient_name populated."""
        doctor_token, doctor_id = await setup_doctor_with_schedule(
            async_client, db_session, email="view_doc@example.dev", full_name="View Doctor"
        )
        patient_token, _ = await register_and_activate_patient(
            async_client, db_session, email="view_patient@example.dev", full_name="View Patient"
        )
        p_headers = {"Authorization": f"Bearer {patient_token}"}

        slot = get_next_monday_slots()[0]

        # Patient books appointment
        book_resp = await async_client.post(
            "/appointments",
            json={"doctor_id": doctor_id, "slot_datetime": slot.isoformat()},
            headers=p_headers,
        )
        assert book_resp.status_code == 201

        # Doctor views their appointments
        d_headers = {"Authorization": f"Bearer {doctor_token}"}
        list_resp = await async_client.get("/appointments", headers=d_headers)
        assert list_resp.status_code == 200
        appointments = list_resp.json()

        assert len(appointments) >= 1
        appt = appointments[0]
        assert appt["doctor_id"] == doctor_id
        assert appt["patient_name"] == "View Patient"

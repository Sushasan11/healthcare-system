"""Availability endpoint tests — covers doctor schedule management and slot generation.

Tests use the async_client fixture from conftest.py which provides:
- SQLite (aiosqlite) in-memory test database
- KV store backed by test DB
"""

from datetime import date, timedelta

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
    email: str = "avail_doctor@example.dev",
    password: str = "Test@1234",
    full_name: str = "Avail Doctor",
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
            "medical_license_number": "LIC-AVAIL-001",
            "years_of_experience": 3,
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
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.json()}"
    return login_resp.json()["access_token"], user_id


def get_next_monday() -> date:
    """Return next Monday's date (or today if already Monday)."""
    today = date.today()
    days_ahead = (7 - today.weekday()) % 7 or 7  # 0=Mon, so Monday is weekday 0
    # Actually we want next Monday (strictly in the future to avoid past slots)
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return today + timedelta(days=days_ahead)


# ---------------------------------------------------------------------------
# Schedule tests
# ---------------------------------------------------------------------------


class TestScheduleManagement:
    async def test_set_working_hours(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Doctor sets Mon 09:00-17:00, GET schedule returns 1 entry."""
        token, doctor_id = await register_and_activate_doctor(
            async_client, db_session, email="sched_doctor@example.dev"
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Set schedule: Monday only
        put_resp = await async_client.put(
            "/doctors/me/schedule",
            json=[{"day_of_week": 0, "start_time": "09:00", "end_time": "17:00", "is_active": True}],
            headers=headers,
        )
        assert put_resp.status_code == 200
        schedule = put_resp.json()
        assert len(schedule) == 1
        assert schedule[0]["day_of_week"] == 0
        assert schedule[0]["start_time"] == "09:00"
        assert schedule[0]["end_time"] == "17:00"

        # GET schedule
        get_resp = await async_client.get("/doctors/me/schedule", headers=headers)
        assert get_resp.status_code == 200
        assert len(get_resp.json()) == 1

    async def test_schedule_replaces_existing(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Calling PUT schedule twice replaces, not appends."""
        token, doctor_id = await register_and_activate_doctor(
            async_client, db_session, email="replace_sched@example.dev"
        )
        headers = {"Authorization": f"Bearer {token}"}

        # First schedule: Mon + Tue
        await async_client.put(
            "/doctors/me/schedule",
            json=[
                {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00", "is_active": True},
                {"day_of_week": 1, "start_time": "09:00", "end_time": "17:00", "is_active": True},
            ],
            headers=headers,
        )

        # Second schedule: Mon only
        put_resp = await async_client.put(
            "/doctors/me/schedule",
            json=[{"day_of_week": 0, "start_time": "10:00", "end_time": "16:00", "is_active": True}],
            headers=headers,
        )
        assert put_resp.status_code == 200
        assert len(put_resp.json()) == 1  # Only 1 entry now


# ---------------------------------------------------------------------------
# Slot availability tests
# ---------------------------------------------------------------------------


class TestAvailableSlots:
    async def test_available_slots(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Doctor sets schedule, GET /doctors/{id}/slots returns generated 30-min slots."""
        token, doctor_id = await register_and_activate_doctor(
            async_client, db_session, email="slots_doctor@example.dev"
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Set Mon 09:00-11:00 (4 slots: 09:00, 09:30, 10:00, 10:30)
        await async_client.put(
            "/doctors/me/schedule",
            json=[{"day_of_week": 0, "start_time": "09:00", "end_time": "11:00", "is_active": True}],
            headers=headers,
        )

        # Get next Monday
        next_monday = get_next_monday()

        resp = await async_client.get(
            f"/doctors/{doctor_id}/slots",
            params={"start_date": next_monday.isoformat(), "days": 7},
        )
        assert resp.status_code == 200
        slots = resp.json()
        # Should have exactly 4 slots (09:00, 09:30, 10:00, 10:30)
        assert len(slots) == 4
        for slot in slots:
            assert slot["is_available"] is True

    async def test_block_slot(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Doctor blocks a slot, it no longer appears in GET /doctors/{id}/slots."""
        token, doctor_id = await register_and_activate_doctor(
            async_client, db_session, email="block_doctor@example.dev"
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Set Mon 09:00-11:00
        await async_client.put(
            "/doctors/me/schedule",
            json=[{"day_of_week": 0, "start_time": "09:00", "end_time": "11:00", "is_active": True}],
            headers=headers,
        )

        next_monday = get_next_monday()

        # Get initial slots
        resp = await async_client.get(
            f"/doctors/{doctor_id}/slots",
            params={"start_date": next_monday.isoformat(), "days": 7},
        )
        assert resp.status_code == 200
        slots_before = resp.json()
        assert len(slots_before) == 4

        # Block the first slot (09:00 Monday)
        first_slot = slots_before[0]["slot_datetime"]
        block_resp = await async_client.post(
            "/doctors/me/schedule/blocks",
            json={"slot_datetime": first_slot},
            headers=headers,
        )
        assert block_resp.status_code == 201

        # Check slot no longer appears
        resp_after = await async_client.get(
            f"/doctors/{doctor_id}/slots",
            params={"start_date": next_monday.isoformat(), "days": 7},
        )
        assert resp_after.status_code == 200
        slots_after = resp_after.json()
        assert len(slots_after) == 3  # One slot removed
        slot_datetimes = [s["slot_datetime"] for s in slots_after]
        assert first_slot not in slot_datetimes

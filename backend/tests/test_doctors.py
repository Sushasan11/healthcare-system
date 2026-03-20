"""Doctor endpoint tests — covers DISC-01, DISC-02, DISC-03.

Tests use the async_client fixture from conftest.py which provides:
- SQLite (aiosqlite) in-memory test database
- fakeredis for Redis isolation
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AccountStatus, User, UserRole
from app.core.security import hash_password


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


async def register_and_activate_doctor(
    client: AsyncClient,
    db: AsyncSession,
    email: str = "doctor_test@example.dev",
    password: str = "Test@1234",
    full_name: str = "Test Doctor",
    specialty: str = "Cardiology",
) -> str:
    """Register a doctor, activate account, login, return access token."""
    response = await client.post(
        "/auth/register/doctor",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "specialty": specialty,
            "medical_license_number": "LIC-TEST-001",
            "years_of_experience": 5,
        },
    )
    assert response.status_code == 201, f"Register failed: {response.json()}"

    # Activate the account directly in DB
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one()
    user.email_verified = True
    user.account_status = AccountStatus.active
    await db.commit()

    # Login
    login_resp = await client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.json()}"
    return login_resp.json()["access_token"]


async def register_and_activate_patient(
    client: AsyncClient,
    db: AsyncSession,
    email: str = "patient_test@example.dev",
    password: str = "Test@1234",
    full_name: str = "Test Patient",
) -> str:
    """Register a patient, activate account, login, return access token."""
    response = await client.post(
        "/auth/register/patient",
        json={"email": email, "password": password, "full_name": full_name},
    )
    assert response.status_code == 201, f"Register failed: {response.json()}"

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
    return login_resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Doctor profile tests
# ---------------------------------------------------------------------------


class TestDoctorProfile:
    async def test_doctor_profile_update(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Doctor can update their profile and the changes appear in GET /doctors/{id}."""
        token = await register_and_activate_doctor(
            async_client, db_session, email="profile_doctor@example.dev"
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Update profile
        update_resp = await async_client.put(
            "/doctors/me/profile",
            json={"bio": "Test bio", "consultation_fee": 150.00},
            headers=headers,
        )
        assert update_resp.status_code == 200, f"PUT failed: {update_resp.json()}"
        data = update_resp.json()
        assert data["bio"] == "Test bio"
        assert float(data["consultation_fee"]) == 150.0

        # Get doctor user ID
        result = await db_session.execute(
            select(User).where(User.email == "profile_doctor@example.dev")
        )
        doctor = result.scalar_one()

        # Verify via GET /doctors/{id}
        get_resp = await async_client.get(f"/doctors/{doctor.id}")
        assert get_resp.status_code == 200
        detail = get_resp.json()
        assert detail["profile"]["bio"] == "Test bio"
        assert float(detail["profile"]["consultation_fee"]) == 150.0

    async def test_doctor_profile_forbidden(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Patient cannot access PUT /doctors/me/profile — must get 403."""
        token = await register_and_activate_patient(
            async_client, db_session, email="patient_forbidden@example.dev"
        )
        headers = {"Authorization": f"Bearer {token}"}

        resp = await async_client.put(
            "/doctors/me/profile",
            json={"bio": "Should fail"},
            headers=headers,
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Doctor listing tests
# ---------------------------------------------------------------------------


class TestDoctorListing:
    async def test_doctor_listing_filter(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """GET /doctors?specialty=Neurology returns only matching doctors."""
        # Create two doctors with different specialties
        await register_and_activate_doctor(
            async_client, db_session,
            email="cardio_doc@example.dev",
            full_name="Cardio Doctor",
            specialty="Cardiology",
        )
        await register_and_activate_doctor(
            async_client, db_session,
            email="neuro_doc@example.dev",
            full_name="Neuro Doctor",
            specialty="Neurology",
        )

        resp = await async_client.get("/doctors?specialty=Neurology")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["specialty"] == "Neurology"

        # Verify cardiology doctor not in neurology results
        emails_in_result = [item["email"] for item in data["items"]]
        assert "cardio_doc@example.dev" not in emails_in_result

    async def test_doctor_name_search(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """GET /doctors?name=partial returns case-insensitive name matches."""
        await register_and_activate_doctor(
            async_client, db_session,
            email="unique_named_doc@example.dev",
            full_name="Dr Uniquename Searchable",
            specialty="Dermatology",
        )

        # Search partial name lowercase
        resp = await async_client.get("/doctors?name=uniquename")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        names = [item["full_name"] for item in data["items"]]
        assert any("Uniquename" in n for n in names)

    async def test_doctor_listing_pagination(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """GET /doctors?page=1&page_size=1 returns 1 item but total reflects full count."""
        # Ensure at least 2 active doctors exist
        await register_and_activate_doctor(
            async_client, db_session,
            email="pag_doc1@example.dev",
            full_name="Pagination Doctor One",
            specialty="Radiology",
        )
        await register_and_activate_doctor(
            async_client, db_session,
            email="pag_doc2@example.dev",
            full_name="Pagination Doctor Two",
            specialty="Radiology",
        )

        resp = await async_client.get("/doctors?page=1&page_size=1")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["total"] > 1
        assert data["page"] == 1
        assert data["page_size"] == 1

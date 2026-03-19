"""Auth endpoint test suite — covers AUTH-01 through AUTH-04.

Tests use the async_client fixture from conftest.py which provides:
- SQLite (aiosqlite) in-memory test database
- fakeredis for Redis isolation
- httpx AsyncClient with ASGITransport

Helper functions bypass email flow for tests by directly setting DB state.
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


async def register_patient(
    client: AsyncClient,
    email: str = "patient@example.com",
    password: str = "Test@1234",
    full_name: str = "Test Patient",
) -> dict:
    response = await client.post(
        "/auth/register/patient",
        json={"email": email, "password": password, "full_name": full_name},
    )
    return response


async def register_doctor(
    client: AsyncClient,
    email: str = "doctor@example.com",
    password: str = "Test@1234",
    full_name: str = "Test Doctor",
) -> dict:
    response = await client.post(
        "/auth/register/doctor",
        json={
            "email": email,
            "password": password,
            "full_name": full_name,
            "specialty": "Cardiology",
            "medical_license_number": "LIC-001",
            "years_of_experience": 5,
        },
    )
    return response


async def login_user(client: AsyncClient, email: str, password: str):
    return await client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )


async def verify_user_email(db: AsyncSession, email: str) -> None:
    """Directly activate a user in the DB — bypasses the email flow for tests."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.email_verified = True
        user.account_status = AccountStatus.active
        await db.commit()
        await db.refresh(user)


async def create_admin_user(db: AsyncSession, email: str = "admin@test.com") -> User:
    """Directly insert an admin user into the DB."""
    from app.core.security import hash_password

    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    admin = User(
        email=email,
        hashed_password=hash_password("Admin@1234"),
        full_name="Test Admin",
        role=UserRole.admin,
        account_status=AccountStatus.active,
        is_active=True,
        email_verified=True,
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    return admin


# ---------------------------------------------------------------------------
# Registration tests
# ---------------------------------------------------------------------------


class TestRegistration:
    async def test_patient_register(self, async_client: AsyncClient, db_session: AsyncSession):
        response = await register_patient(async_client, email="newpatient@example.com")
        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "patient"
        assert data["account_status"] == "pending_verification"
        assert "email" in data

    async def test_doctor_register_pending(self, async_client: AsyncClient, db_session: AsyncSession):
        response = await register_doctor(async_client, email="newdoctor@example.com")
        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "doctor"
        assert data["account_status"] == "pending_approval"

    async def test_admin_registration_endpoint_not_found(self, async_client: AsyncClient):
        response = await async_client.post(
            "/auth/register/admin",
            json={
                "email": "hacker@example.com",
                "password": "Test@1234",
                "full_name": "Hacker",
            },
        )
        assert response.status_code in (404, 405)

    async def test_duplicate_email(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "duplicate@example.com"
        r1 = await register_patient(async_client, email=email)
        assert r1.status_code == 201
        r2 = await register_patient(async_client, email=email)
        assert r2.status_code == 409

    async def test_password_validation(self, async_client: AsyncClient):
        # Too short
        response = await async_client.post(
            "/auth/register/patient",
            json={"email": "weakpw@example.com", "password": "short", "full_name": "User"},
        )
        assert response.status_code == 422

        # Missing uppercase
        response = await async_client.post(
            "/auth/register/patient",
            json={"email": "weakpw2@example.com", "password": "lowercase1!", "full_name": "User"},
        )
        assert response.status_code == 422

        # Missing special character
        response = await async_client.post(
            "/auth/register/patient",
            json={"email": "weakpw3@example.com", "password": "NoSpecial1", "full_name": "User"},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------


class TestLogin:
    async def test_login_success(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "login_success@example.com"
        await register_patient(async_client, email=email)
        await verify_user_email(db_session, email)
        response = await login_user(async_client, email, "Test@1234")
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Refresh token should be in HttpOnly cookie
        assert "set-cookie" in response.headers or "Set-Cookie" in response.headers

    async def test_login_wrong_email_same_error(self, async_client: AsyncClient):
        response = await login_user(async_client, "nonexistent@example.com", "Test@1234")
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect email or password"

    async def test_login_wrong_password_same_error(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "wrongpw@example.com"
        await register_patient(async_client, email=email)
        await verify_user_email(db_session, email)
        response = await login_user(async_client, email, "WrongPass@999")
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect email or password"

    async def test_account_lockout(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "lockout_user@example.com"
        await register_patient(async_client, email=email)
        await verify_user_email(db_session, email)
        # 5 failed attempts
        for _ in range(5):
            await login_user(async_client, email, "WrongPass@999")
        # 6th attempt should be locked out
        response = await login_user(async_client, email, "WrongPass@999")
        assert response.status_code == 429
        assert "locked" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Session / token tests
# ---------------------------------------------------------------------------


class TestSession:
    async def test_refresh_token(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "refresh_user@example.com"
        await register_patient(async_client, email=email)
        await verify_user_email(db_session, email)
        login_resp = await login_user(async_client, email, "Test@1234")
        assert login_resp.status_code == 200

        # Call refresh with cookie from login
        refresh_resp = await async_client.post("/auth/refresh")
        assert refresh_resp.status_code == 200
        assert "access_token" in refresh_resp.json()

    async def test_protected_route(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "me_user@example.com"
        await register_patient(async_client, email=email)
        await verify_user_email(db_session, email)
        login_resp = await login_user(async_client, email, "Test@1234")
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        me_resp = await async_client.get(
            "/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == email

    async def test_logout_revokes_refresh(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "logout_user@example.com"
        await register_patient(async_client, email=email)
        await verify_user_email(db_session, email)
        login_resp = await login_user(async_client, email, "Test@1234")
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        # Logout
        logout_resp = await async_client.post(
            "/auth/logout", headers={"Authorization": f"Bearer {token}"}
        )
        assert logout_resp.status_code == 200

        # Try to use refresh token after logout
        refresh_resp = await async_client.post("/auth/refresh")
        assert refresh_resp.status_code == 401

    async def test_revoked_token_rejected(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "revoked_user@example.com"
        await register_patient(async_client, email=email)
        await verify_user_email(db_session, email)
        login_resp = await login_user(async_client, email, "Test@1234")
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        # Logout to revoke
        await async_client.post(
            "/auth/logout", headers={"Authorization": f"Bearer {token}"}
        )

        # Try refresh again with same (now-revoked) cookie
        refresh_resp = await async_client.post("/auth/refresh")
        assert refresh_resp.status_code == 401


# ---------------------------------------------------------------------------
# RBAC tests
# ---------------------------------------------------------------------------


class TestRBAC:
    async def test_wrong_role_blocked(self, async_client: AsyncClient, db_session: AsyncSession):
        email = "rbac_patient@example.com"
        await register_patient(async_client, email=email)
        await verify_user_email(db_session, email)
        login_resp = await login_user(async_client, email, "Test@1234")
        token = login_resp.json()["access_token"]

        response = await async_client.get(
            "/admin/applications", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403

    async def test_admin_role_access(self, async_client: AsyncClient, db_session: AsyncSession):
        admin = await create_admin_user(db_session, email="admin_access@test.com")
        login_resp = await login_user(async_client, admin.email, "Admin@1234")
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]

        response = await async_client.get(
            "/admin/applications", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_admin_no_phi_leak(self, async_client: AsyncClient, db_session: AsyncSession):
        # Register a doctor (pending_approval)
        doctor_email = "phi_doctor@example.com"
        await register_doctor(async_client, email=doctor_email)

        # Create admin
        admin = await create_admin_user(db_session, email="admin_phi@test.com")
        login_resp = await login_user(async_client, admin.email, "Admin@1234")
        token = login_resp.json()["access_token"]

        response = await async_client.get(
            "/admin/applications", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        forbidden_keys = [
            "phone", "address", "allergies", "current_medications",
            "chronic_conditions", "emergency_contact",
        ]
        for item in response.json():
            for forbidden_key in forbidden_keys:
                assert forbidden_key not in item, f"PHI leak: {forbidden_key} in admin response"

"""Integration tests for admin panel endpoints.

Tests cover: user listing with pagination/filter, suspend/activate, admin protection,
applications with doctor profiles, rejection reason, commission CRUD, and stats.
"""

import uuid

import pytest
import pytest_asyncio

from app.core.security import create_access_token, hash_password
from app.models.doctor_profile import DoctorProfile
from app.models.user import AccountStatus, User, UserRole


async def create_admin_and_token(db_session):
    """Helper: create an admin user and return (admin, token)."""
    uid = uuid.uuid4().hex[:8]
    admin = User(
        email=f"admin_{uid}@test.dev",
        full_name="Admin Test",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.admin,
        account_status=AccountStatus.active,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.flush()
    token = create_access_token(str(admin.id), UserRole.admin)
    return admin, token


async def create_user(db_session, role=UserRole.patient, status=AccountStatus.active):
    """Helper: create a generic user."""
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"user_{uid}@test.dev",
        full_name=f"User {uid}",
        hashed_password=hash_password("TestPass1!"),
        role=role,
        account_status=status,
        is_active=(status != AccountStatus.suspended),
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_list_users_pagination(db_session, async_client):
    """GET /admin/users?limit=2&offset=0 returns 2 users with total >= 3."""
    _, admin_token = await create_admin_and_token(db_session)
    # Create 3 extra users
    for _ in range(3):
        await create_user(db_session)
    await db_session.commit()

    resp = await async_client.get(
        "/admin/users?limit=2&offset=0",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert "total" in data
    assert len(data["users"]) == 2
    assert data["total"] >= 3


@pytest.mark.asyncio
async def test_list_users_role_filter(db_session, async_client):
    """GET /admin/users?role=doctor returns only doctor users."""
    _, admin_token = await create_admin_and_token(db_session)
    await create_user(db_session, role=UserRole.doctor)
    await create_user(db_session, role=UserRole.patient)
    await db_session.commit()

    resp = await async_client.get(
        "/admin/users?role=doctor",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert all(u["role"] == "doctor" for u in data["users"])


@pytest.mark.asyncio
async def test_suspend_user(db_session, async_client):
    """POST /admin/users/{id}/suspend sets account_status to suspended."""
    _, admin_token = await create_admin_and_token(db_session)
    patient = await create_user(db_session, role=UserRole.patient)
    await db_session.commit()

    resp = await async_client.post(
        f"/admin/users/{patient.id}/suspend",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["account_status"] == "suspended"


@pytest.mark.asyncio
async def test_activate_user(db_session, async_client):
    """POST /admin/users/{id}/activate sets account_status to active."""
    _, admin_token = await create_admin_and_token(db_session)
    patient = await create_user(
        db_session, role=UserRole.patient, status=AccountStatus.suspended
    )
    await db_session.commit()

    resp = await async_client.post(
        f"/admin/users/{patient.id}/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["account_status"] == "active"


@pytest.mark.asyncio
async def test_cannot_suspend_admin(db_session, async_client):
    """POST /admin/users/{admin_id}/suspend returns 400."""
    admin, admin_token = await create_admin_and_token(db_session)
    # Create another admin to try to suspend
    uid = uuid.uuid4().hex[:8]
    other_admin = User(
        email=f"admin2_{uid}@test.dev",
        full_name="Admin 2",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.admin,
        account_status=AccountStatus.active,
        is_active=True,
    )
    db_session.add(other_admin)
    await db_session.commit()

    resp = await async_client.post(
        f"/admin/users/{other_admin.id}/suspend",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
    assert "Cannot suspend admin accounts" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_suspended_user_blocked(db_session, async_client):
    """A suspended user with a valid JWT receives 403 on any authenticated endpoint."""
    _, admin_token = await create_admin_and_token(db_session)
    patient = await create_user(db_session, role=UserRole.patient)
    await db_session.commit()

    # Create patient's token before suspension
    patient_token = create_access_token(str(patient.id), UserRole.patient)

    # Suspend the patient
    resp = await async_client.post(
        f"/admin/users/{patient.id}/suspend",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200

    # The suspended patient's token should now return 403
    resp2 = await async_client.get(
        "/appointments",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp2.status_code == 403
    assert "suspended" in resp2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_applications_profile(db_session, async_client):
    """GET /admin/applications includes doctor_profile with bio field for doctors."""
    _, admin_token = await create_admin_and_token(db_session)

    # Create a doctor with pending_approval status
    uid = uuid.uuid4().hex[:8]
    doctor = User(
        email=f"doc_{uid}@test.dev",
        full_name="Dr. Pending",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.doctor,
        account_status=AccountStatus.pending_approval,
        is_active=True,
    )
    db_session.add(doctor)
    await db_session.flush()

    # Add doctor profile with bio and qualifications
    profile = DoctorProfile(
        user_id=doctor.id,
        bio="Experienced cardiologist",
        qualifications="MBBS, MD Cardiology",
    )
    db_session.add(profile)
    await db_session.commit()

    resp = await async_client.get(
        "/admin/applications",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    # Find our doctor in the response
    doctor_entry = next((u for u in data if u["id"] == doctor.id), None)
    assert doctor_entry is not None
    assert doctor_entry["doctor_profile"] is not None
    assert doctor_entry["doctor_profile"]["bio"] == "Experienced cardiologist"


@pytest.mark.asyncio
async def test_reject_with_reason(db_session, async_client):
    """POST /admin/applications/{id}/reject stores rejection_reason in DB."""
    _, admin_token = await create_admin_and_token(db_session)

    uid = uuid.uuid4().hex[:8]
    doctor = User(
        email=f"doc_{uid}@test.dev",
        full_name="Dr. Rejected",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.doctor,
        account_status=AccountStatus.pending_approval,
        is_active=True,
    )
    db_session.add(doctor)
    await db_session.commit()

    resp = await async_client.post(
        f"/admin/applications/{doctor.id}/reject",
        json={"rejection_reason": "Incomplete docs"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200

    # Verify DB has the rejection_reason stored
    await db_session.refresh(doctor)
    assert doctor.rejection_reason == "Incomplete docs"


@pytest.mark.asyncio
async def test_get_commission(db_session, async_client):
    """GET /admin/settings/commission returns a commission_rate float."""
    _, admin_token = await create_admin_and_token(db_session)
    await db_session.commit()

    resp = await async_client.get(
        "/admin/settings/commission",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "commission_rate" in data
    assert isinstance(data["commission_rate"], (int, float))


@pytest.mark.asyncio
async def test_set_commission(db_session, async_client):
    """PUT /admin/settings/commission sets the rate; GET returns the updated value."""
    _, admin_token = await create_admin_and_token(db_session)
    await db_session.commit()

    # Set commission rate
    resp = await async_client.put(
        "/admin/settings/commission",
        json={"commission_rate": 15.5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["commission_rate"] == 15.5

    # Verify with GET
    resp2 = await async_client.get(
        "/admin/settings/commission",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["commission_rate"] == 15.5


@pytest.mark.asyncio
async def test_admin_stats(db_session, async_client):
    """GET /admin/stats returns total_users, by_role, pending_applications, commission_rate."""
    _, admin_token = await create_admin_and_token(db_session)
    await create_user(db_session, role=UserRole.patient)
    await create_user(db_session, role=UserRole.doctor, status=AccountStatus.pending_approval)
    await db_session.commit()

    resp = await async_client.get(
        "/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_users" in data
    assert "by_role" in data
    assert "pending_applications" in data
    assert "commission_rate" in data
    assert data["total_users"] >= 2
    assert data["pending_applications"] >= 1

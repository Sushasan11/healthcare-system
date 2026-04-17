"""Phase 6 payment foundation — test scaffold (Wave 0).

All 14 tests are stubs that pytest.skip until implemented in later plans.
Helpers exist to create doctor/patient fixtures, set commission rate, and log in.
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor_profile import DoctorProfile
from app.models.payment import (
    Payment,
    PaymentLedger,
    PaymentStatus,
    TransactionType,
)
from app.models.pharmacy_order import (
    OrderStatus,
    PharmacyOrder,
    PharmacyOrderItem,
)
from app.models.user import AccountStatus, User, UserRole
from app.services.kv_store import KVStore


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def create_doctor_with_fee(db_session, fee: Decimal = Decimal("50.00")):
    """Create an active doctor user with a DoctorProfile having consultation_fee set."""
    uid = uuid.uuid4().hex[:8]
    doctor = User(
        email=f"doc_{uid}@test.dev",
        full_name="Dr. PayTest",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.doctor,
        account_status=AccountStatus.active,
    )
    db_session.add(doctor)
    await db_session.flush()
    profile = DoctorProfile(
        user_id=doctor.id,
        specialty="General",
        consultation_fee=fee,
    )
    db_session.add(profile)
    await db_session.flush()
    return doctor


async def create_patient(db_session):
    uid = uuid.uuid4().hex[:8]
    patient = User(
        email=f"patient_{uid}@test.dev",
        full_name="Patient PayTest",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.patient,
        account_status=AccountStatus.active,
    )
    db_session.add(patient)
    await db_session.flush()
    return patient


async def set_commission_rate(db_session, rate_pct: str):
    """Set commission_rate in KVStore. rate_pct is a percentage string like '15'."""
    kv = KVStore(db_session)
    await kv.set("commission_rate", rate_pct)


async def login_as(async_client: AsyncClient, email: str, password: str = "TestPass1!") -> str:
    """Login and return the access_token."""
    res = await async_client.post(
        "/auth/login", json={"email": email, "password": password}
    )
    assert res.status_code == 200
    return res.json()["access_token"]


# ---------------------------------------------------------------------------
# Test stubs (14)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_consultation_payment(db_session, async_client):
    """PAY-01: POST /appointments with doctor.consultation_fee creates a Payment
    (status=completed, correct gross_amount)."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_consultation_fee_not_set(db_session, async_client):
    """PAY-01: POST /appointments when doctor has no consultation_fee returns 422."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_cancellation_refund(db_session, async_client):
    """PAY-01/D-03: DELETE /appointments/{id} >2h before slot sets Payment.status=refunded."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_cancellation_no_refund(db_session, async_client):
    """PAY-01/D-03: DELETE /appointments/{id} <2h before slot does NOT refund (400 guard)."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_order_payment(db_session, async_client):
    """PAY-02: POST /pharmacy/orders creates Payment with transaction_type=order_sale."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_commission_snapshot(db_session, async_client):
    """PAY-03/D-05: After consultation payment, PaymentLedger.commission_rate matches
    the KVStore value at payment time."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_commission_immutable(db_session, async_client):
    """PAY-03/D-05: Changing KVStore commission_rate after payment does not change
    the existing ledger entry."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_earnings_summary(db_session, async_client):
    """PAY-04: GET /payments/earnings returns total_gross, total_commission, total_net
    matching ledger data."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_earnings_time_filter(db_session, async_client):
    """PAY-04/D-10: GET /payments/earnings?period=today excludes yesterday's transactions."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_consultation_receipt(db_session, async_client):
    """PAY-05/D-13: GET /appointments/{id}/receipt returns date, doctor_name, specialty,
    amount, status, transaction_id."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_receipt_hides_commission(db_session, async_client):
    """PAY-05/D-06/D-15: Receipt response does NOT contain commission_amount or net_amount."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_order_invoice(db_session, async_client):
    """PAY-05/D-14: GET /pharmacy/orders/{id}/invoice returns itemized lines
    (medicine_name, quantity, unit_price, line_total)."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_admin_transactions(db_session, async_client):
    """ADMIN-01/D-16: GET /admin/transactions returns paginated transaction list."""
    pytest.skip("Not implemented yet — Wave 0 stub")


@pytest.mark.asyncio
async def test_admin_commission_visible(db_session, async_client):
    """ADMIN-01/D-16: Admin transaction list includes commission_amount per row
    and total_commission summary."""
    pytest.skip("Not implemented yet — Wave 0 stub")

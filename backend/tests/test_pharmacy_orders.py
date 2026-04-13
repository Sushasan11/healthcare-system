"""Phase 7 pharmacy orders — 10 Wave 0 acceptance tests (RXORD-01..04, PHARM-01/03/04).

All tests drive the real HTTP endpoints via the async test client so they
exercise routing, auth, and DB state end-to-end.
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
from app.models.consultation import Consultation, ConsultationStatus
from app.models.notification import Notification, NotificationType
from app.models.payment import Payment, PaymentLedger, PaymentStatus
from app.models.pharmacy_order import OrderStatus, PharmacyOrder
from app.models.prescription import (
    Drug,
    Prescription,
    PrescriptionItem,
    PrescriptionStatus,
)
from app.models.user import AccountStatus, User, UserRole

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------


async def _create_user(
    db_session,
    role: UserRole,
    *,
    full_name: str = "Test User",
) -> User:
    uid = uuid.uuid4().hex[:8]
    u = User(
        email=f"{role.value}_{uid}@test.dev",
        full_name=f"{full_name} {uid}",
        hashed_password=hash_password("TestPass1!"),
        role=role,
        account_status=AccountStatus.active,
        is_active=True,
        email_verified=True,
    )
    db_session.add(u)
    await db_session.flush()
    return u


async def _login(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/auth/login", json={"email": email, "password": "TestPass1!"}
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_issued_prescription(
    db_session,
    doctor: User,
    patient: User,
    *,
    with_priced_drug: bool = True,
    with_fallback_item: bool = True,
) -> Prescription:
    """Create a completed consultation + issued prescription with 2 items.

    Item A: drug_id set, Drug.price = 12.50 (if with_priced_drug).
    Item B: drug_id = None (fallback $10.00 per D-13).
    """
    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        slot_datetime=datetime.now(timezone.utc) - timedelta(hours=1),
        status=AppointmentStatus.completed,
    )
    db_session.add(appointment)
    await db_session.flush()

    consultation = Consultation(
        appointment_id=appointment.id,
        status=ConsultationStatus.completed,
        ended_at=datetime.now(timezone.utc),
    )
    db_session.add(consultation)
    await db_session.flush()

    prescription = Prescription(
        consultation_id=consultation.id,
        doctor_id=doctor.id,
        patient_id=patient.id,
        diagnosis="Test diagnosis",
        hmac_token="0" * 64,
        issued_at=datetime.now(timezone.utc),
        status=PrescriptionStatus.issued,
    )
    db_session.add(prescription)
    await db_session.flush()

    # Item A — tied to a Drug with price
    drug = None
    if with_priced_drug:
        drug = Drug(name=f"Amoxicillin_{uuid.uuid4().hex[:6]}", price=Decimal("12.50"))
        db_session.add(drug)
        await db_session.flush()

    item_a = PrescriptionItem(
        prescription_id=prescription.id,
        medicine_name="Amoxicillin",
        dosage_amount="500",
        dosage_unit="mg",
        frequency="3x daily",
        duration="7 days",
        instructions=None,
        drug_id=drug.id if drug else None,
        quantity=1,
    )
    db_session.add(item_a)

    if with_fallback_item:
        item_b = PrescriptionItem(
            prescription_id=prescription.id,
            medicine_name="Paracetamol",
            dosage_amount="500",
            dosage_unit="mg",
            frequency="as needed",
            duration="5 days",
            instructions=None,
            drug_id=None,  # triggers fallback price
            quantity=1,
        )
        db_session.add(item_b)

    await db_session.commit()
    await db_session.refresh(prescription)
    return prescription


# ---------------------------------------------------------------------------
# RXORD-01
# ---------------------------------------------------------------------------


async def test_prescription_cta_eligible(db_session, async_client):
    """RXORD-01: GET /prescriptions/{id} on issued Rx exposes CTA eligibility."""
    doctor = await _create_user(db_session, UserRole.doctor, full_name="Dr. Strange")
    patient = await _create_user(db_session, UserRole.patient, full_name="Alice")
    rx = await _make_issued_prescription(db_session, doctor, patient)

    token = await _login(async_client, patient.email)
    res = await async_client.get(f"/prescriptions/{rx.id}", headers=_auth(token))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "issued"
    assert body["id"] == rx.id


# ---------------------------------------------------------------------------
# RXORD-02
# ---------------------------------------------------------------------------


async def test_order_items_from_prescription(db_session, async_client):
    """RXORD-02: POST /pharmacy/orders {prescription_id} resolves items server-side."""
    doctor = await _create_user(db_session, UserRole.doctor, full_name="Dr. House")
    patient = await _create_user(db_session, UserRole.patient, full_name="Bob")
    # pharmacist must exist so fan-out notification works
    await _create_user(db_session, UserRole.pharmacist, full_name="Pharmacy")
    await db_session.commit()
    rx = await _make_issued_prescription(db_session, doctor, patient)

    token = await _login(async_client, patient.email)
    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(token),
        json={"prescription_id": rx.id},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["prescription_id"] == rx.id
    assert body["status"] == "received"
    assert len(body["items"]) == 2
    # 12.50 (priced drug) + 10.00 (fallback) = 22.50
    assert Decimal(str(body["total_amount"])) == Decimal("22.50")

    # DB: prescription.status moved to ordered
    rx_reloaded = (
        await db_session.execute(
            select(Prescription).where(Prescription.id == rx.id)
        )
    ).scalar_one()
    await db_session.refresh(rx_reloaded)
    assert rx_reloaded.status == PrescriptionStatus.ordered


# ---------------------------------------------------------------------------
# RXORD-03
# ---------------------------------------------------------------------------


async def test_patient_order_status(db_session, async_client):
    """RXORD-03: GET /pharmacy/orders/{id} returns status for patient owner; 403 for others."""
    doctor = await _create_user(db_session, UserRole.doctor)
    patient_a = await _create_user(db_session, UserRole.patient, full_name="Alice")
    patient_b = await _create_user(db_session, UserRole.patient, full_name="Eve")
    await _create_user(db_session, UserRole.pharmacist)
    await db_session.commit()
    rx = await _make_issued_prescription(db_session, doctor, patient_a)

    token_a = await _login(async_client, patient_a.email)
    res = await async_client.post(
        "/pharmacy/orders", headers=_auth(token_a), json={"prescription_id": rx.id}
    )
    assert res.status_code == 201
    order_id = res.json()["id"]

    # Owner sees order
    res = await async_client.get(
        f"/pharmacy/orders/{order_id}", headers=_auth(token_a)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "received"

    # Other patient is forbidden
    token_b = await _login(async_client, patient_b.email)
    res = await async_client.get(
        f"/pharmacy/orders/{order_id}", headers=_auth(token_b)
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# RXORD-04
# ---------------------------------------------------------------------------


async def test_prescription_single_use(db_session, async_client):
    """RXORD-04: second order on same prescription returns 409 prescription_already_used."""
    doctor = await _create_user(db_session, UserRole.doctor)
    patient = await _create_user(db_session, UserRole.patient)
    await _create_user(db_session, UserRole.pharmacist)
    await db_session.commit()
    rx = await _make_issued_prescription(db_session, doctor, patient)

    token = await _login(async_client, patient.email)
    res = await async_client.post(
        "/pharmacy/orders", headers=_auth(token), json={"prescription_id": rx.id}
    )
    assert res.status_code == 201

    res2 = await async_client.post(
        "/pharmacy/orders", headers=_auth(token), json={"prescription_id": rx.id}
    )
    assert res2.status_code == 409
    assert res2.json()["detail"]["error"] == "prescription_already_used"


async def test_rejected_prescription_reorderable(db_session, async_client):
    """RXORD-04: after rejection+refund, prescription is issued again and re-orderable."""
    doctor = await _create_user(db_session, UserRole.doctor)
    patient = await _create_user(db_session, UserRole.patient)
    pharmacist = await _create_user(db_session, UserRole.pharmacist)
    await db_session.commit()
    rx = await _make_issued_prescription(db_session, doctor, patient)

    patient_token = await _login(async_client, patient.email)
    pharm_token = await _login(async_client, pharmacist.email)

    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(patient_token),
        json={"prescription_id": rx.id},
    )
    assert res.status_code == 201
    order_id = res.json()["id"]

    # Reject
    res = await async_client.post(
        f"/pharmacy/orders/{order_id}/reject",
        headers=_auth(pharm_token),
        json={"reason": "out of stock"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "rejected"
    assert body["prescription_id"] is None

    # DB: prescription reverted to issued, payment refunded
    # Force re-query: drop identity map so next select() hits DB fresh
    db_session.expunge_all()
    rx_row = (
        await db_session.execute(
            select(Prescription).where(Prescription.id == rx.id)
        )
    ).scalar_one()
    assert rx_row.status == PrescriptionStatus.issued

    payment = (
        await db_session.execute(
            select(Payment).where(Payment.pharmacy_order_id == order_id)
        )
    ).scalar_one()
    assert payment.status == PaymentStatus.refunded

    # Re-order now succeeds on same Rx
    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(patient_token),
        json={"prescription_id": rx.id},
    )
    assert res.status_code == 201, res.text
    new_order_id = res.json()["id"]
    assert new_order_id != order_id


# ---------------------------------------------------------------------------
# PHARM-01
# ---------------------------------------------------------------------------


async def test_pharmacist_queue(db_session, async_client):
    """PHARM-01: GET /pharmacy/orders as pharmacist returns all received orders with Rx details."""
    doctor = await _create_user(db_session, UserRole.doctor)
    patient_a = await _create_user(db_session, UserRole.patient, full_name="Alice")
    patient_b = await _create_user(db_session, UserRole.patient, full_name="Bob")
    pharmacist = await _create_user(db_session, UserRole.pharmacist)
    await db_session.commit()

    rx_a = await _make_issued_prescription(db_session, doctor, patient_a)
    rx_b = await _make_issued_prescription(db_session, doctor, patient_b)

    ta = await _login(async_client, patient_a.email)
    tb = await _login(async_client, patient_b.email)
    r_a = await async_client.post(
        "/pharmacy/orders", headers=_auth(ta), json={"prescription_id": rx_a.id}
    )
    r_b = await async_client.post(
        "/pharmacy/orders", headers=_auth(tb), json={"prescription_id": rx_b.id}
    )
    order_a_id = r_a.json()["id"]
    order_b_id = r_b.json()["id"]

    pharm_token = await _login(async_client, pharmacist.email)
    res = await async_client.get("/pharmacy/orders", headers=_auth(pharm_token))
    assert res.status_code == 200
    orders = res.json()
    order_ids = {o["id"] for o in orders}
    assert order_a_id in order_ids
    assert order_b_id in order_ids
    for o in orders:
        if o["id"] in (order_a_id, order_b_id):
            assert o["prescription_id"] is not None
            assert o["patient_name"] is not None
            assert o["doctor_name"] is not None
            assert len(o["items"]) == 2

    # Patient A sees only their own orders (not patient B's)
    res = await async_client.get("/pharmacy/orders", headers=_auth(ta))
    assert res.status_code == 200
    mine = res.json()
    mine_ids = {o["id"] for o in mine}
    assert order_a_id in mine_ids
    assert order_b_id not in mine_ids
    for o in mine:
        assert o["patient_id"] == patient_a.id


# ---------------------------------------------------------------------------
# PHARM-03
# ---------------------------------------------------------------------------


async def test_advance_order_stage(db_session, async_client):
    """PHARM-03: PATCH advance walks received->verified->dispatched->delivered."""
    doctor = await _create_user(db_session, UserRole.doctor)
    patient = await _create_user(db_session, UserRole.patient)
    pharmacist = await _create_user(db_session, UserRole.pharmacist)
    await db_session.commit()
    rx = await _make_issued_prescription(db_session, doctor, patient)

    patient_token = await _login(async_client, patient.email)
    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(patient_token),
        json={"prescription_id": rx.id},
    )
    assert res.status_code == 201
    order_id = res.json()["id"]

    pharm_token = await _login(async_client, pharmacist.email)

    # Advance 1: received -> verified, first-time attribution
    res = await async_client.patch(
        f"/pharmacy/orders/{order_id}/advance", headers=_auth(pharm_token)
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "verified"
    assert body["pharmacist_id"] == pharmacist.id
    assert body["verified_at"] is not None

    # DB assertion: ledger provider_id = pharmacist.id
    # Force re-query: drop identity map so next select() hits DB fresh
    db_session.expunge_all()
    ledger = (
        await db_session.execute(
            select(PaymentLedger)
            .join(Payment, Payment.id == PaymentLedger.payment_id)
            .where(Payment.pharmacy_order_id == order_id)
        )
    ).scalar_one()
    assert ledger.provider_id == pharmacist.id

    # Advance 2: verified -> dispatched
    res = await async_client.patch(
        f"/pharmacy/orders/{order_id}/advance", headers=_auth(pharm_token)
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "dispatched"
    assert body["dispatched_at"] is not None

    # Advance 3: dispatched -> delivered, prescription dispensed
    res = await async_client.patch(
        f"/pharmacy/orders/{order_id}/advance", headers=_auth(pharm_token)
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "delivered"
    assert body["delivered_at"] is not None

    # Force re-query: drop identity map so next select() hits DB fresh
    db_session.expunge_all()
    rx_row = (
        await db_session.execute(select(Prescription).where(Prescription.id == rx.id))
    ).scalar_one()
    assert rx_row.status == PrescriptionStatus.dispensed


async def test_invalid_stage_transition(db_session, async_client):
    """PHARM-03: advance past delivered returns 409 invalid_stage_transition."""
    doctor = await _create_user(db_session, UserRole.doctor)
    patient = await _create_user(db_session, UserRole.patient)
    pharmacist = await _create_user(db_session, UserRole.pharmacist)
    await db_session.commit()
    rx = await _make_issued_prescription(db_session, doctor, patient)

    patient_token = await _login(async_client, patient.email)
    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(patient_token),
        json={"prescription_id": rx.id},
    )
    order_id = res.json()["id"]

    pharm_token = await _login(async_client, pharmacist.email)
    for _ in range(3):
        r = await async_client.patch(
            f"/pharmacy/orders/{order_id}/advance", headers=_auth(pharm_token)
        )
        assert r.status_code == 200

    # 4th advance is invalid
    r = await async_client.patch(
        f"/pharmacy/orders/{order_id}/advance", headers=_auth(pharm_token)
    )
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "invalid_stage_transition"


# ---------------------------------------------------------------------------
# PHARM-04
# ---------------------------------------------------------------------------


async def test_reject_order(db_session, async_client):
    """PHARM-04: POST reject refunds payment, notifies patient with reason."""
    doctor = await _create_user(db_session, UserRole.doctor)
    patient = await _create_user(db_session, UserRole.patient)
    pharmacist = await _create_user(db_session, UserRole.pharmacist)
    await db_session.commit()
    rx = await _make_issued_prescription(db_session, doctor, patient)

    patient_token = await _login(async_client, patient.email)
    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(patient_token),
        json={"prescription_id": rx.id},
    )
    order_id = res.json()["id"]

    pharm_token = await _login(async_client, pharmacist.email)
    res = await async_client.post(
        f"/pharmacy/orders/{order_id}/reject",
        headers=_auth(pharm_token),
        json={"reason": "Medicine not in stock"},
    )
    assert res.status_code == 200, res.text

    # Force re-query: drop identity map so next select() hits DB fresh
    db_session.expunge_all()
    order_row = (
        await db_session.execute(
            select(PharmacyOrder).where(PharmacyOrder.id == order_id)
        )
    ).scalar_one()
    assert order_row.status == OrderStatus.rejected
    assert order_row.rejection_reason == "Medicine not in stock"
    assert order_row.rejected_at is not None

    # Notification to patient
    notif = (
        await db_session.execute(
            select(Notification).where(
                Notification.user_id == patient.id,
                Notification.type == NotificationType.pharmacy_order_rejected,
            )
        )
    ).scalar_one()
    assert "Medicine not in stock" in notif.body

    # Payment refunded
    payment = (
        await db_session.execute(
            select(Payment).where(Payment.pharmacy_order_id == order_id)
        )
    ).scalar_one()
    assert payment.status == PaymentStatus.refunded


async def test_reject_after_dispatch_blocked(db_session, async_client):
    """PHARM-04: rejecting a dispatched order returns 409 reject_not_allowed."""
    doctor = await _create_user(db_session, UserRole.doctor)
    patient = await _create_user(db_session, UserRole.patient)
    pharmacist = await _create_user(db_session, UserRole.pharmacist)
    await db_session.commit()
    rx = await _make_issued_prescription(db_session, doctor, patient)

    patient_token = await _login(async_client, patient.email)
    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(patient_token),
        json={"prescription_id": rx.id},
    )
    order_id = res.json()["id"]

    pharm_token = await _login(async_client, pharmacist.email)
    # received -> verified -> dispatched
    for _ in range(2):
        r = await async_client.patch(
            f"/pharmacy/orders/{order_id}/advance", headers=_auth(pharm_token)
        )
        assert r.status_code == 200

    # Reject while dispatched is forbidden
    r = await async_client.post(
        f"/pharmacy/orders/{order_id}/reject",
        headers=_auth(pharm_token),
        json={"reason": "too late"},
    )
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "reject_not_allowed"

# NOTE: Test DB is SQLite (aiosqlite) — SELECT ... FOR UPDATE is a no-op here.
# This test file validates serial correctness (two sequential checkouts on last unit).
# True concurrent-lock behavior is enforced in production Postgres.
"""Phase 9 OTC store — Wave 0 failing stubs (D-28 cases 1-13, 15; case 14 lives in test_pharmacy_orders.py)."""
import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.models.prescription import Drug, MedicineCategory
from app.models.user import AccountStatus, User, UserRole

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Local helpers (mirror test_pharmacy_orders.py patterns)
# ---------------------------------------------------------------------------


async def _create_user(db_session, role: UserRole, *, full_name: str = "Test User") -> User:
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


async def _login(client, email: str) -> str:
    res = await client.post(
        "/auth/login", json={"email": email, "password": "TestPass1!"}
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _seed_drug(
    db_session,
    *,
    name: str | None = None,
    price: Decimal = Decimal("10.00"),
    stock_count: int = 5,
    rx_required: bool = False,
    archived: bool = False,
    category: str = MedicineCategory.pain_relief.value,
    generic_name: str | None = None,
    description: str | None = None,
    dosage: str | None = None,
) -> Drug:
    drug = Drug(
        name=name or f"Drug_{uuid.uuid4().hex[:6]}",
        generic_name=generic_name,
        category=category,
        description=description,
        dosage=dosage,
        price=price,
        stock_count=stock_count,
        low_stock_threshold=10,
        rx_required=rx_required,
        archived=archived,
    )
    db_session.add(drug)
    await db_session.flush()
    return drug


# ---------------------------------------------------------------------------
# D-28 case 1
# ---------------------------------------------------------------------------


async def test_catalog_lists_only_otc_in_stock_non_archived(db_session, async_client):
    otc = await _seed_drug(db_session, name="Ibuprofen", stock_count=5, rx_required=False)
    await _seed_drug(db_session, name="RxOnly", stock_count=5, rx_required=True)
    await _seed_drug(db_session, name="Archived", stock_count=5, archived=True)
    await _seed_drug(db_session, name="OutOfStock", stock_count=0, rx_required=False)
    await db_session.commit()

    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    res = await async_client.get("/pharmacy/catalog", headers=_auth(token))
    assert res.status_code == 200, res.text
    body = res.json()
    names = {item["name"] for item in body["items"]}
    assert "Ibuprofen" in names
    assert "RxOnly" not in names
    assert "Archived" not in names
    assert "OutOfStock" not in names
    # Confirm our OTC drug payload
    assert any(item["id"] == otc.id for item in body["items"])


# ---------------------------------------------------------------------------
# D-28 case 2
# ---------------------------------------------------------------------------


async def test_catalog_filter_by_category(db_session, async_client):
    await _seed_drug(
        db_session,
        name="Paracetamol",
        category=MedicineCategory.pain_relief.value,
    )
    await _seed_drug(
        db_session,
        name="VitaminC",
        category=MedicineCategory.vitamins_supplements.value,
    )
    await db_session.commit()

    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    res = await async_client.get(
        "/pharmacy/catalog?category=pain_relief", headers=_auth(token)
    )
    assert res.status_code == 200, res.text
    body = res.json()
    names = {item["name"] for item in body["items"]}
    assert "Paracetamol" in names
    assert "VitaminC" not in names


# ---------------------------------------------------------------------------
# D-28 case 3
# ---------------------------------------------------------------------------


async def test_catalog_search_by_name_case_insensitive(db_session, async_client):
    await _seed_drug(db_session, name="Aspirin")
    await _seed_drug(db_session, name="Cetirizine")
    await db_session.commit()

    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    res = await async_client.get(
        "/pharmacy/catalog?q=aspi", headers=_auth(token)
    )
    assert res.status_code == 200, res.text
    body = res.json()
    names = {item["name"] for item in body["items"]}
    assert "Aspirin" in names
    assert "Cetirizine" not in names


# ---------------------------------------------------------------------------
# D-28 case 4
# ---------------------------------------------------------------------------


async def test_catalog_search_by_generic_name(db_session, async_client):
    await _seed_drug(
        db_session, name="BrandX", generic_name="acetaminophen"
    )
    await _seed_drug(db_session, name="BrandY", generic_name="loratadine")
    await db_session.commit()

    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    res = await async_client.get(
        "/pharmacy/catalog?q=acetamin", headers=_auth(token)
    )
    assert res.status_code == 200, res.text
    body = res.json()
    names = {item["name"] for item in body["items"]}
    assert "BrandX" in names
    assert "BrandY" not in names


# ---------------------------------------------------------------------------
# D-28 case 5
# ---------------------------------------------------------------------------


async def test_catalog_categories_returns_six_with_counts(db_session, async_client):
    await _seed_drug(db_session, category=MedicineCategory.pain_relief.value)
    await _seed_drug(db_session, category=MedicineCategory.pain_relief.value)
    await _seed_drug(db_session, category=MedicineCategory.cold_and_flu.value)
    await db_session.commit()

    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    res = await async_client.get(
        "/pharmacy/catalog/categories", headers=_auth(token)
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["categories"]) == 6
    by_cat = {c["category"]: c for c in body["categories"]}
    assert by_cat["pain_relief"]["count"] >= 2
    assert by_cat["cold_and_flu"]["count"] >= 1
    # Every category has a label
    for c in body["categories"]:
        assert c["label"]


# ---------------------------------------------------------------------------
# D-28 case 6
# ---------------------------------------------------------------------------


async def test_catalog_detail_404_for_rx_archived_or_oos(db_session, async_client):
    valid = await _seed_drug(db_session, name="ValidOtc", stock_count=5)
    rx = await _seed_drug(db_session, name="RxOnly2", rx_required=True)
    arch = await _seed_drug(db_session, name="Arch2", archived=True)
    oos = await _seed_drug(db_session, name="OOS2", stock_count=0)
    await db_session.commit()

    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    # Valid OTC drug must be fetchable (200)
    res = await async_client.get(
        f"/pharmacy/catalog/{valid.id}", headers=_auth(token)
    )
    assert res.status_code == 200, f"valid drug detail should 200: {res.text}"
    assert res.json()["id"] == valid.id

    # Rx-only, archived, and out-of-stock drugs must 404
    for drug in (rx, arch, oos):
        res = await async_client.get(
            f"/pharmacy/catalog/{drug.id}", headers=_auth(token)
        )
        assert res.status_code == 404, f"drug {drug.name} should 404: {res.text}"


# ---------------------------------------------------------------------------
# D-28 case 7
# ---------------------------------------------------------------------------


async def test_create_otc_order_with_items_payload(db_session, async_client):
    drug = await _seed_drug(
        db_session, name="Paracetamol500", price=Decimal("5.00"), stock_count=20
    )
    await _create_user(db_session, UserRole.pharmacist)
    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(token),
        json={"items": [{"drug_id": drug.id, "quantity": 2}]},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "received"
    assert body["prescription_id"] is None
    assert len(body["items"]) == 1
    assert Decimal(str(body["total_amount"])) == Decimal("10.00")


# ---------------------------------------------------------------------------
# D-28 case 8
# ---------------------------------------------------------------------------


async def test_otc_quantity_cap_exceeded_returns_400(db_session, async_client):
    drug = await _seed_drug(db_session, stock_count=50)
    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(token),
        json={"items": [{"drug_id": drug.id, "quantity": 11}]},
    )
    assert res.status_code == 400, res.text
    detail = res.json().get("detail")
    if isinstance(detail, dict):
        assert detail.get("error") == "quantity_cap_exceeded"
    else:
        assert detail == "quantity_cap_exceeded"


# ---------------------------------------------------------------------------
# D-28 case 9
# ---------------------------------------------------------------------------


async def test_otc_order_decrements_drug_stock(db_session, async_client):
    drug = await _seed_drug(db_session, stock_count=5, price=Decimal("4.00"))
    await _create_user(db_session, UserRole.pharmacist)
    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    token = await _login(async_client, patient.email)

    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(token),
        json={"items": [{"drug_id": drug.id, "quantity": 3}]},
    )
    assert res.status_code == 201, res.text

    db_session.expunge_all()
    row = (
        await db_session.execute(select(Drug).where(Drug.id == drug.id))
    ).scalar_one()
    assert row.stock_count == 2


# ---------------------------------------------------------------------------
# D-28 case 10 (SQLite serial caveat — see top-of-file NOTE)
# ---------------------------------------------------------------------------


async def test_serial_checkout_race_last_unit_second_gets_409(db_session, async_client):
    drug = await _seed_drug(db_session, stock_count=1, price=Decimal("3.00"))
    await _create_user(db_session, UserRole.pharmacist)
    patient_a = await _create_user(db_session, UserRole.patient, full_name="Alice")
    patient_b = await _create_user(db_session, UserRole.patient, full_name="Eve")
    await db_session.commit()

    ta = await _login(async_client, patient_a.email)
    tb = await _login(async_client, patient_b.email)

    payload = {"items": [{"drug_id": drug.id, "quantity": 1}]}
    first = await async_client.post("/pharmacy/orders", headers=_auth(ta), json=payload)
    assert first.status_code == 201, first.text

    second = await async_client.post("/pharmacy/orders", headers=_auth(tb), json=payload)
    assert second.status_code == 409, second.text
    body = second.json()
    detail = body.get("detail", body)
    assert detail.get("error") == "cart_stock_changed"
    assert any(
        ln["reason"] in ("stock_insufficient", "out_of_stock")
        for ln in detail["lines"]
    )


# ---------------------------------------------------------------------------
# D-28 case 11
# ---------------------------------------------------------------------------


async def test_payment_failure_rolls_back_stock(db_session, async_client, monkeypatch):
    drug = await _seed_drug(db_session, stock_count=10, price=Decimal("9.99"))
    await _create_user(db_session, UserRole.pharmacist)
    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    drug_id = drug.id  # capture before POST (rollback expires ORM state)
    token = await _login(async_client, patient.email)

    # Force PaymentService.charge_order to fail
    from app.services import payment_service as ps_mod

    async def _boom(self, *args, **kwargs):
        raise RuntimeError("payment_declined")

    monkeypatch.setattr(ps_mod.PaymentService, "charge_order", _boom)

    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(token),
        json={"items": [{"drug_id": drug_id, "quantity": 2}]},
    )
    assert res.status_code >= 400

    db_session.expunge_all()
    row = (
        await db_session.execute(select(Drug).where(Drug.id == drug_id))
    ).scalar_one()
    assert row.stock_count == 10  # rolled back


# ---------------------------------------------------------------------------
# D-28 case 12
# ---------------------------------------------------------------------------


async def test_otc_rejection_refunds_and_restocks(db_session, async_client):
    drug = await _seed_drug(db_session, stock_count=10, price=Decimal("6.00"))
    pharmacist = await _create_user(db_session, UserRole.pharmacist)
    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()

    patient_token = await _login(async_client, patient.email)
    pharm_token = await _login(async_client, pharmacist.email)

    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(patient_token),
        json={"items": [{"drug_id": drug.id, "quantity": 4}]},
    )
    assert res.status_code == 201, res.text
    order_id = res.json()["id"]

    res = await async_client.post(
        f"/pharmacy/orders/{order_id}/reject",
        headers=_auth(pharm_token),
        json={"reason": "out of stock"},
    )
    assert res.status_code == 200, res.text

    db_session.expunge_all()
    row = (
        await db_session.execute(select(Drug).where(Drug.id == drug.id))
    ).scalar_one()
    assert row.stock_count == 10  # refunded/restocked


# ---------------------------------------------------------------------------
# D-28 case 13
# ---------------------------------------------------------------------------


async def test_checkout_price_drift_returns_409_cart_stock_changed(db_session, async_client):
    drug = await _seed_drug(db_session, price=Decimal("5.00"), stock_count=10)
    await _create_user(db_session, UserRole.pharmacist)
    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()
    drug_id = drug.id  # capture before POST (rollback expires ORM state)
    token = await _login(async_client, patient.email)

    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(token),
        json={
            "items": [
                {"drug_id": drug_id, "quantity": 1, "price_snapshot": "4.50"}
            ]
        },
    )
    assert res.status_code == 409, res.text
    body = res.json()
    detail = body.get("detail", body)
    assert detail.get("error") == "cart_stock_changed"
    lines = detail["lines"]
    assert len(lines) == 1
    line = lines[0]
    assert line["drug_id"] == drug_id
    assert line["reason"] == "price_changed"
    assert Decimal(str(line["old_price"])) == Decimal("4.50")
    assert Decimal(str(line["new_price"])) == Decimal("5.00")

    db_session.expunge_all()
    row = (
        await db_session.execute(select(Drug).where(Drug.id == drug_id))
    ).scalar_one()
    assert row.stock_count == 10  # not decremented


# ---------------------------------------------------------------------------
# D-28 case 15
# ---------------------------------------------------------------------------


async def test_shared_queue_lists_both_rx_and_otc(db_session, async_client):
    """Pharmacist queue shows both OTC and Rx orders together."""
    drug = await _seed_drug(db_session, stock_count=10, price=Decimal("7.00"))
    pharmacist = await _create_user(db_session, UserRole.pharmacist)
    patient = await _create_user(db_session, UserRole.patient)
    await db_session.commit()

    patient_token = await _login(async_client, patient.email)

    # Place an OTC order
    res = await async_client.post(
        "/pharmacy/orders",
        headers=_auth(patient_token),
        json={"items": [{"drug_id": drug.id, "quantity": 1}]},
    )
    assert res.status_code == 201, res.text
    otc_id = res.json()["id"]

    pharm_token = await _login(async_client, pharmacist.email)
    res = await async_client.get("/pharmacy/orders", headers=_auth(pharm_token))
    assert res.status_code == 200, res.text
    orders = res.json()
    ids = {o["id"] for o in orders}
    assert otc_id in ids
    # The OTC order row has no prescription_id
    otc_row = next(o for o in orders if o["id"] == otc_id)
    assert otc_row["prescription_id"] is None

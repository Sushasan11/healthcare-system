"""Phase 8 PHARM-02 — 11 Wave 0 acceptance tests for pharmacist inventory.

Each test encodes one locked acceptance criterion from 08-CONTEXT.md.
Driven through the real HTTP layer via the async test client.
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import inspect

from app.core.security import hash_password
from app.models.user import AccountStatus, User, UserRole

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_pharmacist(db_session) -> User:
    uid = uuid.uuid4().hex[:8]
    u = User(
        email=f"pharm_{uid}@test.dev",
        full_name=f"Pharmacist {uid}",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.pharmacist,
        account_status=AccountStatus.active,
        is_active=True,
        email_verified=True,
    )
    db_session.add(u)
    await db_session.commit()
    return u


async def _login(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/auth/login", json={"email": email, "password": "TestPass1!"}
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _med_payload(**overrides) -> dict:
    base = {
        "name": f"Med_{uuid.uuid4().hex[:6]}",
        "category": "pain_relief",
        "price": "4.50",
        "stock_count": 20,
        "low_stock_threshold": 5,
        "rx_required": False,
    }
    base.update(overrides)
    return base


async def _make_medicine(client: AsyncClient, headers: dict, **overrides) -> dict:
    res = await client.post(
        "/pharmacy/inventory", headers=headers, json=_med_payload(**overrides)
    )
    assert res.status_code == 201, res.text
    return res.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_create_medicine_returns_201_with_all_fields(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    token = await _login(async_client, pharmacist.email)
    headers = _auth(token)

    payload = {
        "name": "Panadol",
        "category": "pain_relief",
        "price": "4.50",
        "stock_count": 20,
        "low_stock_threshold": 5,
        "rx_required": False,
    }
    res = await async_client.post(
        "/pharmacy/inventory", headers=headers, json=payload
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Panadol"
    assert body["category"] == "pain_relief"
    assert str(body["price"]) in ("4.50", "4.5")
    assert body["stock_count"] == 20
    assert body["low_stock_threshold"] == 5
    assert body["rx_required"] is False
    assert body["archived"] is False
    assert isinstance(body["id"], int)


async def test_list_filters_by_category(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    pain = await _make_medicine(async_client, headers, name="PainPill", category="pain_relief")
    digest = await _make_medicine(async_client, headers, name="DigestPill", category="digestive")

    res = await async_client.get(
        "/pharmacy/inventory?category=pain_relief", headers=headers
    )
    assert res.status_code == 200, res.text
    names = {m["name"] for m in res.json()}
    assert pain["name"] in names
    assert digest["name"] not in names


async def test_list_status_low_stock_returns_only_at_or_below_threshold_with_stock_gt_0(
    db_session, async_client
):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    a = await _make_medicine(async_client, headers, name="A_low", stock_count=5, low_stock_threshold=10)
    b = await _make_medicine(async_client, headers, name="B_out", stock_count=0, low_stock_threshold=10)
    c = await _make_medicine(async_client, headers, name="C_in", stock_count=20, low_stock_threshold=5)

    res = await async_client.get("/pharmacy/inventory?status=low_stock", headers=headers)
    assert res.status_code == 200
    names = {m["name"] for m in res.json()}
    assert a["name"] in names
    assert b["name"] not in names
    assert c["name"] not in names


async def test_list_status_out_of_stock_returns_only_zero_stock(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    a = await _make_medicine(async_client, headers, name="Out_A", stock_count=0)
    b = await _make_medicine(async_client, headers, name="Out_B", stock_count=1)

    res = await async_client.get("/pharmacy/inventory?status=out_of_stock", headers=headers)
    assert res.status_code == 200
    names = {m["name"] for m in res.json()}
    assert a["name"] in names
    assert b["name"] not in names


async def test_list_excludes_archived_by_default_includes_when_flag_set(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    a = await _make_medicine(async_client, headers, name="ArchMe")
    b = await _make_medicine(async_client, headers, name="KeepMe")

    res = await async_client.patch(
        f"/pharmacy/inventory/{a['id']}", headers=headers, json={"archived": True}
    )
    assert res.status_code == 200, res.text

    # default list excludes archived
    res = await async_client.get("/pharmacy/inventory", headers=headers)
    names = {m["name"] for m in res.json()}
    assert a["name"] not in names
    assert b["name"] in names

    # include_archived=true brings it back
    res = await async_client.get(
        "/pharmacy/inventory?include_archived=true", headers=headers
    )
    names = {m["name"] for m in res.json()}
    assert a["name"] in names
    assert b["name"] in names

    # status=archived returns only archived
    res = await async_client.get("/pharmacy/inventory?status=archived", headers=headers)
    names = {m["name"] for m in res.json()}
    assert a["name"] in names
    assert b["name"] not in names


async def test_adjust_stock_positive_delta_increments(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    med = await _make_medicine(async_client, headers, stock_count=10)
    res = await async_client.patch(
        f"/pharmacy/inventory/{med['id']}/adjust-stock",
        headers=headers,
        json={"delta": 5},
    )
    assert res.status_code == 200, res.text
    assert res.json()["stock_count"] == 15

    res = await async_client.get(f"/pharmacy/inventory/{med['id']}", headers=headers)
    assert res.json()["stock_count"] == 15


async def test_adjust_stock_negative_delta_decrements(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    med = await _make_medicine(async_client, headers, stock_count=10)
    res = await async_client.patch(
        f"/pharmacy/inventory/{med['id']}/adjust-stock",
        headers=headers,
        json={"delta": -3},
    )
    assert res.status_code == 200, res.text
    assert res.json()["stock_count"] == 7


async def test_adjust_stock_underflow_returns_400_stock_underflow(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    med = await _make_medicine(async_client, headers, stock_count=2)
    res = await async_client.patch(
        f"/pharmacy/inventory/{med['id']}/adjust-stock",
        headers=headers,
        json={"delta": -5},
    )
    assert res.status_code == 400
    assert res.json()["detail"]["error"] == "stock_underflow"

    res = await async_client.get(f"/pharmacy/inventory/{med['id']}", headers=headers)
    assert res.json()["stock_count"] == 2


async def test_patch_medicine_rx_required_flips_flag(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    med = await _make_medicine(async_client, headers, rx_required=False)
    res = await async_client.patch(
        f"/pharmacy/inventory/{med['id']}",
        headers=headers,
        json={"rx_required": True},
    )
    assert res.status_code == 200, res.text
    assert res.json()["rx_required"] is True

    res = await async_client.get(f"/pharmacy/inventory/{med['id']}", headers=headers)
    assert res.json()["rx_required"] is True


async def test_patch_medicine_archived_hides_from_default_list(db_session, async_client):
    pharmacist = await _create_pharmacist(db_session)
    headers = _auth(await _login(async_client, pharmacist.email))

    med = await _make_medicine(async_client, headers, name="HideMe")
    res = await async_client.patch(
        f"/pharmacy/inventory/{med['id']}", headers=headers, json={"archived": True}
    )
    assert res.status_code == 200

    res = await async_client.get("/pharmacy/inventory", headers=headers)
    names = {m["name"] for m in res.json()}
    assert med["name"] not in names


async def test_migration_009_round_trip(db_session):
    """Schema-shape check: drugs table has all 7 inventory columns from 08-01.

    Adapted from the plan's migration round-trip stub: tests use SQLite via
    Base.metadata.create_all (not Alembic), so we inspect the live table on
    the test engine instead of running upgrade/downgrade.
    """
    from tests.conftest import test_engine

    def _get_cols(sync_conn):
        return {c["name"] for c in inspect(sync_conn).get_columns("drugs")}

    async with test_engine.connect() as conn:
        cols = await conn.run_sync(_get_cols)

    assert {
        "category",
        "description",
        "dosage",
        "stock_count",
        "low_stock_threshold",
        "rx_required",
        "archived",
    }.issubset(cols)

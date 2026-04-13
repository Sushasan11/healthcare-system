import pytest

pytestmark = pytest.mark.asyncio


async def test_prescription_cta_eligible():
    """RXORD-01: GET /prescriptions/{id} on issued Rx exposes CTA eligibility."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_order_items_from_prescription():
    """RXORD-02: POST /pharmacy/orders {prescription_id} resolves items server-side."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_patient_order_status():
    """RXORD-03: GET /pharmacy/orders/{id} returns current status for patient owner."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_prescription_single_use():
    """RXORD-04: second order on same prescription returns 409 Conflict."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_rejected_prescription_reorderable():
    """RXORD-04: after rejection+refund, prescription is issued again and re-orderable."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_pharmacist_queue():
    """PHARM-01: GET /pharmacy/orders as pharmacist returns all received orders with Rx details."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_advance_order_stage():
    """PHARM-03: PATCH /pharmacy/orders/{id}/advance moves received->verified, sets pharmacist_id, updates ledger."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_invalid_stage_transition():
    """PHARM-03: advancing from dispatched does not go backwards; illegal transition returns 409."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_reject_order():
    """PHARM-04: POST /pharmacy/orders/{id}/reject refunds payment, releases Rx, notifies patient."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")


async def test_reject_after_dispatch_blocked():
    """PHARM-04: rejecting a dispatched order returns 409."""
    pytest.fail("Wave 0 stub — implementation pending in plan 07-02")

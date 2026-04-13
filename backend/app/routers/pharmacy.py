"""Pharmacy orders router — Phase 7: prescription-linked ordering.

Endpoints:
  POST   /pharmacy/orders                 — patient creates order from prescription (RXORD-02)
  GET    /pharmacy/orders/preview         — patient previews order total from Rx (RXORD-02)
  GET    /pharmacy/orders                 — pharmacist queue / patient orders list (RXORD-03, PHARM-01)
  GET    /pharmacy/orders/{id}            — single order detail (RXORD-03)
  GET    /pharmacy/orders/{id}/invoice    — legacy Phase 6 invoice (PAY-05)
  PATCH  /pharmacy/orders/{id}/advance    — pharmacist advances stage (PHARM-03)
  POST   /pharmacy/orders/{id}/reject     — pharmacist rejects + refund (PHARM-04)
"""
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.db import get_db
from app.models.notification import Notification, NotificationType
from app.models.payment import Payment, PaymentLedger
from app.models.pharmacy_order import OrderStatus, PharmacyOrder, PharmacyOrderItem
from app.models.prescription import Prescription, PrescriptionItem, PrescriptionStatus
from app.models.user import AccountStatus, User, UserRole
from app.schemas.payment import InvoiceOut
from app.schemas.payment import OrderItemOut as LegacyInvoiceItemOut
from app.schemas.pharmacy_order import (
    OrderItemOut,
    OrderItemPreviewOut,
    PharmacyOrderCreateIn,
    PharmacyOrderOut,
    PharmacyOrderPreviewOut,
    RejectOrderIn,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])

# ---------------------------------------------------------------------------
# Phase 7 constants (D-02, D-07, D-13)
# ---------------------------------------------------------------------------

VALID_TRANSITIONS: dict[OrderStatus, OrderStatus] = {
    OrderStatus.received: OrderStatus.verified,
    OrderStatus.verified: OrderStatus.dispatched,
    OrderStatus.dispatched: OrderStatus.delivered,
}
REJECTABLE_FROM: set[OrderStatus] = {OrderStatus.received, OrderStatus.verified}
FALLBACK_UNIT_PRICE: Decimal = Decimal("10.00")  # D-13 placeholder
STAGE_TIMESTAMP_FIELD: dict[OrderStatus, str] = {
    OrderStatus.verified: "verified_at",
    OrderStatus.dispatched: "dispatched_at",
    OrderStatus.delivered: "delivered_at",
}
STAGE_BODY: dict[OrderStatus, str] = {
    OrderStatus.verified: "Your order has been verified by the pharmacist.",
    OrderStatus.dispatched: "Your order has been dispatched.",
    OrderStatus.delivered: "Your order has been delivered.",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_item_price(item: PrescriptionItem) -> tuple[Decimal, bool]:
    """Return (unit_price, is_fallback)."""
    if item.drug is not None and item.drug.price is not None:
        return Decimal(item.drug.price), False
    return FALLBACK_UNIT_PRICE, True


async def _load_prescription_for_order(
    db: AsyncSession, prescription_id: int
) -> Prescription:
    result = await db.execute(
        select(Prescription)
        .options(
            selectinload(Prescription.items).selectinload(PrescriptionItem.drug),
            selectinload(Prescription.doctor),
            selectinload(Prescription.patient),
        )
        .where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    if prescription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "prescription_not_found"},
        )
    return prescription


async def _load_order(
    db: AsyncSession, order_id: int, *, with_payment: bool = False
) -> PharmacyOrder:
    opts = [
        selectinload(PharmacyOrder.items),
        selectinload(PharmacyOrder.patient),
        selectinload(PharmacyOrder.pharmacist),
        selectinload(PharmacyOrder.prescription).selectinload(Prescription.items),
        selectinload(PharmacyOrder.prescription).selectinload(Prescription.doctor),
    ]
    if with_payment:
        opts.append(selectinload(PharmacyOrder.payment))
    result = await db.execute(
        select(PharmacyOrder).options(*opts).where(PharmacyOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "order_not_found"},
        )
    return order


def _serialize_order(order: PharmacyOrder) -> PharmacyOrderOut:
    doctor_name = None
    if order.prescription is not None and order.prescription.doctor is not None:
        doctor_name = order.prescription.doctor.full_name
    patient_name = order.patient.full_name if order.patient is not None else None
    return PharmacyOrderOut(
        id=order.id,
        patient_id=order.patient_id,
        patient_name=patient_name,
        prescription_id=order.prescription_id,
        pharmacist_id=order.pharmacist_id,
        doctor_name=doctor_name,
        total_amount=order.total_amount,
        status=order.status.value,
        rejection_reason=order.rejection_reason,
        created_at=order.created_at,
        verified_at=order.verified_at,
        dispatched_at=order.dispatched_at,
        delivered_at=order.delivered_at,
        rejected_at=order.rejected_at,
        items=[
            OrderItemOut(
                id=i.id,
                medicine_name=i.medicine_name,
                quantity=i.quantity,
                unit_price=i.unit_price,
                line_total=i.line_total,
            )
            for i in order.items
        ],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/orders",
    response_model=PharmacyOrderOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_order(
    data: PharmacyOrderCreateIn,
    current_user: User = Depends(require_role(UserRole.patient)),
    db: AsyncSession = Depends(get_db),
):
    """Create a pharmacy order from a prescription. Items and total are resolved
    server-side from PrescriptionItem + Drug.price (fallback $10.00/unit)."""
    prescription = await _load_prescription_for_order(db, data.prescription_id)

    if prescription.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "not_your_prescription"},
        )
    if prescription.status != PrescriptionStatus.issued:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "prescription_already_used"},
        )

    # Resolve items server-side
    order_items: list[PharmacyOrderItem] = []
    total = Decimal("0.00")
    for item in prescription.items:
        unit_price, _fallback = _resolve_item_price(item)
        quantity = int(item.quantity or 1)
        line_total = (unit_price * quantity).quantize(Decimal("0.01"))
        total += line_total
        order_items.append(
            PharmacyOrderItem(
                medicine_name=item.medicine_name,
                quantity=quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )
    total = total.quantize(Decimal("0.01"))

    order = PharmacyOrder(
        patient_id=current_user.id,
        prescription_id=prescription.id,
        total_amount=total,
        status=OrderStatus.received,
    )
    db.add(order)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "prescription_already_used"},
        )

    for it in order_items:
        it.order_id = order.id
    db.add_all(order_items)
    await db.flush()

    # Charge the patient (provider_id deliberately None per D-03 — ledger
    # attribution happens on first advance when a pharmacist picks up the order).
    try:
        payment_service = PaymentService(db)
        await payment_service.charge_order(
            order_id=order.id,
            patient_id=current_user.id,
            provider_id=None,
            gross_amount=total,
        )
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "payment_failed", "message": str(e)},
        )

    # Release the prescription from issued → ordered
    prescription.status = PrescriptionStatus.ordered

    # Fan-out notification to all active pharmacists
    pharmacist_rows = await db.execute(
        select(User).where(
            User.role == UserRole.pharmacist,
            User.is_active == True,  # noqa: E712
            User.account_status == AccountStatus.active,
        )
    )
    pharmacists = pharmacist_rows.scalars().all()
    patient_name = current_user.full_name
    doctor_name = (
        prescription.doctor.full_name if prescription.doctor is not None else "doctor"
    )
    for pharmacist in pharmacists:
        db.add(
            Notification(
                user_id=pharmacist.id,
                type=NotificationType.pharmacy_order_received,
                title="New Prescription Order",
                body=(
                    f"Patient {patient_name} placed an order from "
                    f"Dr. {doctor_name}'s prescription."
                ),
                link=f"/pharmacist/orders/{order.id}",
            )
        )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "prescription_already_used"},
        )

    order = await _load_order(db, order.id)
    return _serialize_order(order)


@router.get("/orders/preview", response_model=PharmacyOrderPreviewOut)
async def preview_order(
    prescription_id: int,
    current_user: User = Depends(require_role(UserRole.patient)),
    db: AsyncSession = Depends(get_db),
):
    """Preview what an order from this prescription would cost. No side effects."""
    prescription = await _load_prescription_for_order(db, prescription_id)
    if prescription.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "not_your_prescription"},
        )
    if prescription.status != PrescriptionStatus.issued:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "prescription_already_used"},
        )

    items_out: list[OrderItemPreviewOut] = []
    total = Decimal("0.00")
    has_fallback = False
    for item in prescription.items:
        unit_price, is_fallback = _resolve_item_price(item)
        quantity = int(item.quantity or 1)
        line_total = (unit_price * quantity).quantize(Decimal("0.01"))
        total += line_total
        if is_fallback:
            has_fallback = True
        items_out.append(
            OrderItemPreviewOut(
                medicine_name=item.medicine_name,
                dosage_amount=item.dosage_amount,
                dosage_unit=item.dosage_unit,
                quantity=quantity,
                unit_price=unit_price,
                price_is_fallback=is_fallback,
            )
        )

    return PharmacyOrderPreviewOut(
        prescription_id=prescription.id,
        doctor_name=prescription.doctor.full_name if prescription.doctor else None,
        issued_at=prescription.issued_at,
        items=items_out,
        total_amount=total.quantize(Decimal("0.01")),
        has_fallback_prices=has_fallback,
    )


@router.get("/orders", response_model=list[PharmacyOrderOut])
async def list_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pharmacist: all active orders queue. Patient: own orders."""
    base_query = select(PharmacyOrder).options(
        selectinload(PharmacyOrder.items),
        selectinload(PharmacyOrder.patient),
        selectinload(PharmacyOrder.pharmacist),
        selectinload(PharmacyOrder.prescription).selectinload(Prescription.items),
        selectinload(PharmacyOrder.prescription).selectinload(Prescription.doctor),
    )

    if current_user.role == UserRole.pharmacist:
        query = base_query.where(
            PharmacyOrder.status.in_(
                (OrderStatus.received, OrderStatus.verified, OrderStatus.dispatched)
            )
        ).order_by(PharmacyOrder.created_at.asc())
    elif current_user.role == UserRole.patient:
        query = base_query.where(
            PharmacyOrder.patient_id == current_user.id
        ).order_by(PharmacyOrder.created_at.desc())
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "insufficient_permissions"},
        )

    result = await db.execute(query)
    orders = result.scalars().all()
    return [_serialize_order(o) for o in orders]


@router.get("/orders/{order_id}", response_model=PharmacyOrderOut)
async def get_order_detail(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a single pharmacy order. Accessible to owner, pharmacists, admins."""
    order = await _load_order(db, order_id)
    is_owner = current_user.id == order.patient_id
    is_pharmacist = current_user.role == UserRole.pharmacist
    is_admin = current_user.role == UserRole.admin
    if not (is_owner or is_pharmacist or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "not_authorized"},
        )
    return _serialize_order(order)


@router.patch("/orders/{order_id}/advance", response_model=PharmacyOrderOut)
async def advance_order(
    order_id: int,
    current_user: User = Depends(require_role(UserRole.pharmacist)),
    db: AsyncSession = Depends(get_db),
):
    """Advance a pharmacy order to its next stage (forward-only)."""
    order = await _load_order(db, order_id, with_payment=True)
    next_status = VALID_TRANSITIONS.get(order.status)
    if next_status is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "invalid_stage_transition",
                "current": order.status.value,
            },
        )

    # First-advance attribution
    if order.pharmacist_id is None:
        order.pharmacist_id = current_user.id
        if order.payment is not None:
            # Update payment.provider_id for earnings queries
            payment_row = await db.execute(
                select(Payment).where(Payment.id == order.payment.id)
            )
            payment = payment_row.scalar_one_or_none()
            if payment is not None:
                payment.provider_id = current_user.id
            ledger_row = await db.execute(
                select(PaymentLedger).where(
                    PaymentLedger.payment_id == order.payment.id
                )
            )
            ledger = ledger_row.scalar_one_or_none()
            if ledger is not None:
                ledger.provider_id = current_user.id

    order.status = next_status
    setattr(order, STAGE_TIMESTAMP_FIELD[next_status], datetime.now(timezone.utc))

    if next_status == OrderStatus.delivered and order.prescription is not None:
        order.prescription.status = PrescriptionStatus.dispensed

    db.add(
        Notification(
            user_id=order.patient_id,
            type=NotificationType.pharmacy_order_status_changed,
            title="Order Update",
            body=STAGE_BODY[next_status],
            link=f"/patient/pharmacy/orders/{order.id}",
        )
    )

    await db.commit()
    order = await _load_order(db, order.id)
    return _serialize_order(order)


@router.post("/orders/{order_id}/reject", response_model=PharmacyOrderOut)
async def reject_order(
    order_id: int,
    body: RejectOrderIn,
    current_user: User = Depends(require_role(UserRole.pharmacist)),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pharmacy order: refund payment, release Rx, notify patient."""
    order = await _load_order(db, order_id, with_payment=True)
    if order.status not in REJECTABLE_FROM:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "reject_not_allowed",
                "current": order.status.value,
            },
        )

    order.status = OrderStatus.rejected
    order.rejection_reason = body.reason
    order.rejected_at = datetime.now(timezone.utc)

    payment_service = PaymentService(db)
    try:
        await payment_service.refund_order(order.id)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "refund_failed", "message": str(e)},
        )

    if order.prescription is not None:
        order.prescription.status = PrescriptionStatus.issued
    order.prescription_id = None

    reason_text = body.reason if body.reason else "The pharmacist did not provide a reason."
    db.add(
        Notification(
            user_id=order.patient_id,
            type=NotificationType.pharmacy_order_rejected,
            title="Order Rejected",
            body=reason_text,
            link=f"/patient/pharmacy/orders/{order.id}",
        )
    )

    await db.commit()
    order = await _load_order(db, order.id)
    return _serialize_order(order)


# ---------------------------------------------------------------------------
# Legacy Phase 6 invoice endpoint — preserved for backwards compatibility
# ---------------------------------------------------------------------------


@router.get("/orders/{order_id}/invoice", response_model=InvoiceOut)
async def get_order_invoice(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return an itemized invoice for a pharmacy order (PAY-05)."""
    result = await db.execute(
        select(PharmacyOrder)
        .options(selectinload(PharmacyOrder.items))
        .where(PharmacyOrder.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    is_owner = current_user.id == order.patient_id
    is_admin = current_user.role == UserRole.admin
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this invoice",
        )

    payment_result = await db.execute(
        select(Payment).where(Payment.pharmacy_order_id == order_id)
    )
    payment = payment_result.scalar_one_or_none()

    items_out = [
        LegacyInvoiceItemOut(
            medicine_name=i.medicine_name,
            quantity=i.quantity,
            unit_price=i.unit_price,
            line_total=i.line_total,
        )
        for i in order.items
    ]
    subtotal = sum((i.line_total for i in order.items), Decimal("0.00"))

    return InvoiceOut(
        payment_id=payment.id if payment else 0,
        date=order.created_at,
        items=items_out,
        subtotal=subtotal,
        total=order.total_amount,
        status=payment.status.value if payment else "unknown",
        transaction_id=payment.gateway_transaction_id if payment else None,
    )

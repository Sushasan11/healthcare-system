"""Pharmacy orders router — order creation and invoice retrieval.

Phase 6 stub: minimal order + payment flow. Full pharmacist fulfillment in Phase 7.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.db import get_db
from app.models.payment import Payment
from app.models.pharmacy_order import OrderStatus, PharmacyOrder, PharmacyOrderItem
from app.models.user import User, UserRole
from app.schemas.payment import (
    InvoiceOut,
    OrderItemOut,
    PharmacyOrderCreateIn,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])


@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(
    data: PharmacyOrderCreateIn,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """Create a pharmacy order and charge the patient.

    Phase 6 stub — provider_id is set to the patient's own id as a placeholder
    since there is no pharmacist assignment yet. Earnings queries filter by
    provider_id, so this placeholder does not leak into any real provider's
    earnings. Phase 7 will add proper pharmacist routing.
    """
    if not data.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Order must contain at least one item",
        )

    order_items: list[PharmacyOrderItem] = []
    for item in data.items:
        unit_price = Decimal(str(item.unit_price))
        line_total = (unit_price * item.quantity).quantize(Decimal("0.01"))
        order_items.append(
            PharmacyOrderItem(
                medicine_name=item.medicine_name,
                quantity=item.quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    total_amount = sum((i.line_total for i in order_items), Decimal("0.00"))

    order = PharmacyOrder(
        patient_id=current_user.id,
        total_amount=total_amount,
        status=OrderStatus.pending,
    )
    db.add(order)
    await db.flush()

    for it in order_items:
        it.order_id = order.id
    db.add_all(order_items)
    await db.flush()

    try:
        payment_service = PaymentService(db)
        payment = await payment_service.charge_order(
            order_id=order.id,
            patient_id=current_user.id,
            # Phase 6 placeholder — see docstring.
            provider_id=current_user.id,
            gross_amount=total_amount,
        )
    except ValueError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Payment gateway error: {e}",
        )

    await db.commit()
    await db.refresh(payment)

    return {
        "order_id": order.id,
        "total_amount": str(total_amount),
        "payment_status": payment.status.value,
    }


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
        OrderItemOut(
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

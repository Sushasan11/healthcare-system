"""Payments router — earnings summary for providers and consultation receipts.

Endpoints:
  GET /payments/earnings                         — provider earnings (doctor/pharmacist)
  GET /payments/consultation-receipt/{appt_id}   — patient consultation receipt
"""

import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.db import get_db
from app.models.payment import Payment, PaymentLedger, TransactionType
from app.models.user import User, UserRole
from app.schemas.payment import (
    EarningsSummaryOut,
    LedgerEntryOut,
    ReceiptOut,
)

router = APIRouter(prefix="/payments", tags=["payments"])


def _compute_cutoff(period: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "this_week":
        monday = now - timedelta(days=now.weekday())
        return monday.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "this_month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return None  # all_time


@router.get("/earnings", response_model=EarningsSummaryOut)
async def get_earnings(
    period: str = Query(default="all_time"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: User = Depends(require_role("doctor", "pharmacist")),
    db: AsyncSession = Depends(get_db),
):
    """Provider earnings summary with paginated ledger entries (PAY-04)."""
    cutoff = _compute_cutoff(period)

    # Aggregate totals
    agg_query = select(
        func.coalesce(func.sum(PaymentLedger.gross_amount), 0),
        func.coalesce(func.sum(PaymentLedger.commission_amount), 0),
        func.coalesce(func.sum(PaymentLedger.net_amount), 0),
        func.count(),
    ).where(PaymentLedger.provider_id == current_user.id)
    if cutoff is not None:
        agg_query = agg_query.where(PaymentLedger.created_at >= cutoff)

    agg_result = (await db.execute(agg_query)).one()
    total_gross = Decimal(str(agg_result[0] or 0))
    total_commission = Decimal(str(agg_result[1] or 0))
    total_net = Decimal(str(agg_result[2] or 0))
    total_count = int(agg_result[3] or 0)

    # Paginated ledger entries
    page_query = (
        select(PaymentLedger)
        .options(
            selectinload(PaymentLedger.payment).selectinload(Payment.patient)
        )
        .where(PaymentLedger.provider_id == current_user.id)
    )
    if cutoff is not None:
        page_query = page_query.where(PaymentLedger.created_at >= cutoff)
    page_query = (
        page_query.order_by(PaymentLedger.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    entries_result = await db.execute(page_query)
    entries = entries_result.scalars().all()

    transactions: list[LedgerEntryOut] = []
    for entry in entries:
        payment = entry.payment
        patient_name = (
            payment.patient.full_name
            if payment is not None and payment.patient is not None
            else ""
        )
        if (
            payment is not None
            and payment.transaction_type == TransactionType.consultation_fee
        ):
            tx_type_display = "Consultation Fee"
        else:
            tx_type_display = "Order Sale"
        transactions.append(
            LedgerEntryOut(
                id=entry.id,
                created_at=entry.created_at,
                patient_name=patient_name,
                transaction_type=tx_type_display,
                gross_amount=entry.gross_amount,
                commission_amount=entry.commission_amount,
                net_amount=entry.net_amount,
            )
        )

    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1

    return EarningsSummaryOut(
        total_gross=total_gross,
        total_commission=total_commission,
        total_net=total_net,
        total_count=total_count,
        transactions=transactions,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/consultation-receipt/{appointment_id}", response_model=ReceiptOut)
async def get_consultation_receipt(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return patient-safe receipt for a consultation payment (PAY-05)."""
    payment_result = await db.execute(
        select(Payment)
        .options(selectinload(Payment.provider))
        .where(Payment.appointment_id == appointment_id)
    )
    payment = payment_result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found",
        )

    # Ownership: patient on the payment, or admin
    if not (
        current_user.id == payment.patient_id
        or current_user.role == UserRole.admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this receipt",
        )

    doctor_name = payment.provider.full_name if payment.provider else ""
    specialty = payment.provider.specialty if payment.provider else None
    status_str = (
        payment.status.value if hasattr(payment.status, "value") else str(payment.status)
    )

    return ReceiptOut(
        payment_id=payment.id,
        date=payment.created_at,
        doctor_name=doctor_name,
        specialty=specialty,
        amount=payment.gross_amount,
        status=status_str,
        transaction_id=payment.gateway_transaction_id,
    )

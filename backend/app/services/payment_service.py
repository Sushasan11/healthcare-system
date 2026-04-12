"""Payment service: gateway abstraction, commission calculation, ledger writes.

CRITICAL: This service never calls db.commit(). It only calls db.flush() to
obtain generated IDs. The caller (router) is responsible for committing so
that payment creation stays atomic with the business operation that triggered
it (appointment, order, etc).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment import Payment, PaymentLedger, PaymentStatus, TransactionType
from app.services.kv_store import KVStore


@dataclass
class GatewayResult:
    success: bool
    gateway_transaction_id: str
    error_message: str | None = None


class GatewayProtocol(Protocol):
    async def charge(
        self, amount: Decimal, currency: str, metadata: dict
    ) -> GatewayResult: ...

    async def refund(
        self, gateway_transaction_id: str, amount: Decimal
    ) -> GatewayResult: ...


class MockGateway:
    """Test/dev gateway that always succeeds."""

    async def charge(
        self, amount: Decimal, currency: str, metadata: dict
    ) -> GatewayResult:
        return GatewayResult(
            success=True,
            gateway_transaction_id=f"mock_{uuid.uuid4().hex[:12]}",
        )

    async def refund(
        self, gateway_transaction_id: str, amount: Decimal
    ) -> GatewayResult:
        return GatewayResult(
            success=True,
            gateway_transaction_id=f"mock_refund_{uuid.uuid4().hex[:12]}",
        )


class PaymentService:
    def __init__(self, db: AsyncSession, gateway: GatewayProtocol | None = None):
        self._db = db
        self._gateway: GatewayProtocol = gateway or MockGateway()

    async def _get_commission_rate(self) -> Decimal:
        """Read commission_rate from KVStore as percentage string and return fraction.

        KVStore stores e.g. "15" meaning 15%. Returns Decimal("0.15").
        """
        rate_str = await KVStore(self._db).get("commission_rate")
        if rate_str is None:
            return Decimal("0")
        return Decimal(rate_str) / Decimal("100")

    async def charge_consultation(
        self,
        appointment_id: int | None,
        patient_id: int,
        provider_id: int,
        gross_amount: Decimal,
        currency: str = "USD",
    ) -> Payment:
        commission_rate = await self._get_commission_rate()
        commission_amount = (gross_amount * commission_rate).quantize(Decimal("0.01"))
        net_amount = gross_amount - commission_amount

        result = await self._gateway.charge(
            gross_amount,
            currency,
            {"appointment_id": appointment_id, "patient_id": patient_id},
        )
        if not result.success:
            raise ValueError(f"Payment failed: {result.error_message}")

        payment = Payment(
            patient_id=patient_id,
            provider_id=provider_id,
            appointment_id=appointment_id,
            pharmacy_order_id=None,
            gross_amount=gross_amount,
            currency=currency,
            status=PaymentStatus.completed,
            transaction_type=TransactionType.consultation_fee,
            gateway_transaction_id=result.gateway_transaction_id,
        )
        self._db.add(payment)
        await self._db.flush()

        ledger = PaymentLedger(
            payment_id=payment.id,
            provider_id=provider_id,
            gross_amount=gross_amount,
            commission_rate=commission_rate,
            commission_amount=commission_amount,
            net_amount=net_amount,
        )
        self._db.add(ledger)
        # Do NOT commit — caller commits.
        return payment

    async def charge_order(
        self,
        order_id: int,
        patient_id: int,
        provider_id: int,
        gross_amount: Decimal,
        currency: str = "USD",
    ) -> Payment:
        commission_rate = await self._get_commission_rate()
        commission_amount = (gross_amount * commission_rate).quantize(Decimal("0.01"))
        net_amount = gross_amount - commission_amount

        result = await self._gateway.charge(
            gross_amount,
            currency,
            {"pharmacy_order_id": order_id, "patient_id": patient_id},
        )
        if not result.success:
            raise ValueError(f"Payment failed: {result.error_message}")

        payment = Payment(
            patient_id=patient_id,
            provider_id=provider_id,
            appointment_id=None,
            pharmacy_order_id=order_id,
            gross_amount=gross_amount,
            currency=currency,
            status=PaymentStatus.completed,
            transaction_type=TransactionType.order_sale,
            gateway_transaction_id=result.gateway_transaction_id,
        )
        self._db.add(payment)
        await self._db.flush()

        ledger = PaymentLedger(
            payment_id=payment.id,
            provider_id=provider_id,
            gross_amount=gross_amount,
            commission_rate=commission_rate,
            commission_amount=commission_amount,
            net_amount=net_amount,
        )
        self._db.add(ledger)
        return payment

    async def refund_payment(self, payment: Payment) -> Payment:
        result = await self._gateway.refund(
            payment.gateway_transaction_id or "", payment.gross_amount
        )
        if not result.success:
            raise ValueError(f"Refund failed: {result.error_message}")

        payment.status = PaymentStatus.refunded
        payment.refunded_at = datetime.now(timezone.utc)

        ledger = (
            await self._db.execute(
                select(PaymentLedger).where(PaymentLedger.payment_id == payment.id)
            )
        ).scalar_one_or_none()
        if ledger is not None:
            ledger.net_amount = Decimal("0")
            ledger.commission_amount = Decimal("0")
        return payment

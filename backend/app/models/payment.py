import enum
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    refunded = "refunded"
    failed = "failed"


class TransactionType(str, enum.Enum):
    consultation_fee = "consultation_fee"
    order_sale = "order_sale"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    provider_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    appointment_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id"), nullable=True, unique=True
    )
    pharmacy_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("pharmacy_orders.id"), nullable=True, unique=True
    )
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.pending, nullable=False
    )
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType), nullable=False
    )
    gateway_transaction_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    refunded_at: Mapped[object | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    patient: Mapped["User"] = relationship(foreign_keys=[patient_id])  # noqa: F821
    provider: Mapped["User"] = relationship(foreign_keys=[provider_id])  # noqa: F821
    ledger_entry: Mapped["PaymentLedger | None"] = relationship(
        back_populates="payment", uselist=False
    )


class PaymentLedger(Base):
    __tablename__ = "payment_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    payment_id: Mapped[int] = mapped_column(
        ForeignKey("payments.id"), unique=True, nullable=False
    )
    provider_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    payment: Mapped["Payment"] = relationship(back_populates="ledger_entry")
    provider: Mapped["User"] = relationship(foreign_keys=[provider_id])  # noqa: F821

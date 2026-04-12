import enum
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class OrderStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"


class PharmacyOrder(Base):
    __tablename__ = "pharmacy_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.pending, nullable=False
    )
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    patient: Mapped["User"] = relationship(foreign_keys=[patient_id])  # noqa: F821
    items: Mapped[list["PharmacyOrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    payment: Mapped["Payment | None"] = relationship(  # noqa: F821
        "Payment", uselist=False, viewonly=True,
        primaryjoin="PharmacyOrder.id == Payment.pharmacy_order_id",
    )


class PharmacyOrderItem(Base):
    __tablename__ = "pharmacy_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("pharmacy_orders.id"), nullable=False)
    medicine_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["PharmacyOrder"] = relationship(back_populates="items")

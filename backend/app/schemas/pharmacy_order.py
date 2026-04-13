from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class RxOrderCreateIn(BaseModel):
    """Phase 7 Rx branch — create a pharmacy order from an issued prescription."""
    prescription_id: int


class OtcOrderLineIn(BaseModel):
    """Phase 9 OTC branch line item.

    price_snapshot (D-13): client-provided expected unit price. If set and differs
    from the server's current Drug.price at checkout, decrement_stock_for_lines
    surfaces a price_changed diff in the 409 cart_stock_changed response.
    """
    drug_id: int
    quantity: int = Field(ge=1, le=10)  # D-23 quantity cap
    price_snapshot: Decimal | None = None


class OtcOrderCreateIn(BaseModel):
    """Phase 9 OTC branch — create a pharmacy order from cart line items."""
    items: list[OtcOrderLineIn] = Field(min_length=1)


# D-01: discriminated union. FastAPI resolves by payload shape
# ({prescription_id: ...} -> RxOrderCreateIn, {items: [...]} -> OtcOrderCreateIn).
PharmacyOrderCreateIn = Union[RxOrderCreateIn, OtcOrderCreateIn]


class OrderItemPreviewOut(BaseModel):
    medicine_name: str
    dosage_amount: str
    dosage_unit: str
    quantity: int
    unit_price: Decimal
    price_is_fallback: bool  # True when Drug.price missing; fallback $10.00/unit per D-13


class PharmacyOrderPreviewOut(BaseModel):
    prescription_id: int
    doctor_name: Optional[str] = None
    issued_at: datetime
    items: list[OrderItemPreviewOut]
    total_amount: Decimal
    has_fallback_prices: bool


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    medicine_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class PharmacyOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    patient_name: Optional[str] = None
    prescription_id: Optional[int] = None
    pharmacist_id: Optional[int] = None
    doctor_name: Optional[str] = None
    total_amount: Decimal
    status: str
    rejection_reason: Optional[str] = None
    created_at: datetime
    verified_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    items: list[OrderItemOut] = []


class AdvanceOrderIn(BaseModel):
    """No body — next stage is deterministic from current state (D-07)."""
    pass


class RejectOrderIn(BaseModel):
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# D-13: cart_stock_changed 409 payload
# ---------------------------------------------------------------------------


class CartStockChangedLine(BaseModel):
    drug_id: int
    requested: int
    available: int
    reason: Literal["stock_insufficient", "out_of_stock", "price_changed"]
    old_price: Decimal | None = None
    new_price: Decimal | None = None


class CartStockChangedError(BaseModel):
    error: Literal["cart_stock_changed"] = "cart_stock_changed"
    lines: list[CartStockChangedLine]

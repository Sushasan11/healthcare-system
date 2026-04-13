from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PharmacyOrderCreateIn(BaseModel):
    """Phase 7 order creation — prescription-driven. Items are resolved server-side."""
    prescription_id: int


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

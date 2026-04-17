from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    patient_id: int
    provider_id: int
    appointment_id: int | None
    pharmacy_order_id: int | None
    gross_amount: Decimal
    currency: str
    status: str
    transaction_type: str
    gateway_transaction_id: str | None
    created_at: datetime
    refunded_at: datetime | None


class LedgerEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    patient_name: str
    transaction_type: str
    gross_amount: Decimal
    commission_amount: Decimal
    net_amount: Decimal


class EarningsSummaryOut(BaseModel):
    total_gross: Decimal
    total_commission: Decimal
    total_net: Decimal
    total_count: int
    transactions: list[LedgerEntryOut]
    page: int
    page_size: int
    total_pages: int


class ReceiptOut(BaseModel):
    payment_id: int
    date: datetime
    doctor_name: str
    specialty: str | None
    amount: Decimal
    status: str
    transaction_id: str | None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    medicine_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class InvoiceOut(BaseModel):
    payment_id: int
    date: datetime
    items: list[OrderItemOut]
    subtotal: Decimal
    total: Decimal
    status: str
    transaction_id: str | None


class AdminTransactionOut(BaseModel):
    id: int
    date: datetime
    patient_name: str
    provider_name: str
    transaction_type: str
    gross_amount: Decimal
    commission_amount: Decimal
    net_amount: Decimal
    status: str


class AdminTransactionListOut(BaseModel):
    transactions: list[AdminTransactionOut]
    total_commission: Decimal
    page: int
    page_size: int
    total_pages: int
    total_count: int


class PharmacyOrderItemIn(BaseModel):
    medicine_name: str
    quantity: int
    unit_price: Decimal


class PharmacyOrderCreateIn(BaseModel):
    items: list[PharmacyOrderItemIn]

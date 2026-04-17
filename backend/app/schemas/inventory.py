"""Phase 8 PHARM-02: Pydantic schemas for pharmacist inventory management."""
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CategoryLiteral = Literal[
    "pain_relief",
    "cold_and_flu",
    "digestive",
    "vitamins_supplements",
    "first_aid",
    "skin_care",
]


class MedicineBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)
    generic_name: str | None = Field(default=None, max_length=500)
    form: str | None = Field(default=None, max_length=100)
    dosage: str | None = Field(default=None, max_length=100)
    category: CategoryLiteral
    description: str | None = None
    price: Decimal = Field(..., ge=Decimal("0"))
    stock_count: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=10, ge=0)
    rx_required: bool = False


class MedicineCreate(MedicineBase):
    pass


class MedicineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=500)
    generic_name: str | None = None
    form: str | None = None
    dosage: str | None = None
    category: CategoryLiteral | None = None
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=Decimal("0"))
    stock_count: int | None = Field(default=None, ge=0)
    low_stock_threshold: int | None = Field(default=None, ge=0)
    rx_required: bool | None = None
    archived: bool | None = None


class MedicineOut(MedicineBase):
    id: int
    archived: bool
    model_config = ConfigDict(from_attributes=True)


class StockAdjustIn(BaseModel):
    """Positive or negative stock delta. Backend enforces stock_count + delta >= 0."""
    delta: int

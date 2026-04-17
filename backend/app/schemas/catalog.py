"""Phase 9 OTC catalog schemas (D-19)."""
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.prescription import MedicineCategory


class OtcCatalogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    generic_name: str | None = None
    category: MedicineCategory
    description: str | None = None
    dosage: str | None = None
    price: Decimal
    stock_count: int
    low_stock_threshold: int


class OtcCatalogListOut(BaseModel):
    items: list[OtcCatalogOut]
    total: int
    page: int
    page_size: int


class CategoryCountOut(BaseModel):
    category: MedicineCategory
    label: str
    count: int


class CategoryCountListOut(BaseModel):
    categories: list[CategoryCountOut]

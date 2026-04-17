"""Phase 9 — public OTC catalog endpoints (D-19, D-26).

Endpoints:
  GET /pharmacy/catalog              — list OTC drugs (rx_required=False, in stock, not archived)
  GET /pharmacy/catalog/categories   — 6 MedicineCategory entries with per-category counts
  GET /pharmacy/catalog/{drug_id}    — single OTC drug detail (404 for rx/archived/oos)

No auth dependency — the OTC catalog is public by design.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.prescription import Drug, MedicineCategory
from app.schemas.catalog import (
    CategoryCountListOut,
    CategoryCountOut,
    OtcCatalogListOut,
    OtcCatalogOut,
)

router = APIRouter(prefix="/pharmacy/catalog", tags=["catalog"])


def _otc_base_filter():
    return [
        Drug.rx_required == False,  # noqa: E712
        Drug.archived == False,  # noqa: E712
        Drug.stock_count > 0,
    ]


@router.get("", response_model=OtcCatalogListOut)
async def list_catalog(
    q: str | None = None,
    category: MedicineCategory | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Drug).where(*_otc_base_filter())
    count_stmt = select(func.count(Drug.id)).where(*_otc_base_filter())
    if category is not None:
        stmt = stmt.where(Drug.category == category.value)
        count_stmt = count_stmt.where(Drug.category == category.value)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            (Drug.name.ilike(pattern)) | (Drug.generic_name.ilike(pattern))
        )
        count_stmt = count_stmt.where(
            (Drug.name.ilike(pattern)) | (Drug.generic_name.ilike(pattern))
        )
    stmt = (
        stmt.order_by(Drug.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt)).scalars().all()
    return OtcCatalogListOut(
        items=[OtcCatalogOut.model_validate(d) for d in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


# NOTE: /categories must come BEFORE /{drug_id} so FastAPI matches it correctly.
@router.get("/categories", response_model=CategoryCountListOut)
async def list_categories(db: AsyncSession = Depends(get_db)):
    out: list[CategoryCountOut] = []
    for cat in MedicineCategory:
        stmt = select(func.count(Drug.id)).where(
            *_otc_base_filter(), Drug.category == cat.value
        )
        count = (await db.execute(stmt)).scalar_one()
        out.append(
            CategoryCountOut(
                category=cat,
                label=cat.value.replace("_", " ").title(),
                count=count,
            )
        )
    return CategoryCountListOut(categories=out)


@router.get("/{drug_id}", response_model=OtcCatalogOut)
async def get_detail(drug_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Drug).where(Drug.id == drug_id, *_otc_base_filter())
    drug = (await db.execute(stmt)).scalar_one_or_none()
    if drug is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="drug_not_found_or_unavailable",
        )
    return OtcCatalogOut.model_validate(drug)

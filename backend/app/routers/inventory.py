"""Pharmacist inventory router — Phase 8 (PHARM-02).

Endpoints:
  GET    /pharmacy/inventory                      — list with q/category/status/include_archived filters
  GET    /pharmacy/inventory/{id}                 — single medicine detail
  POST   /pharmacy/inventory                      — create medicine
  PATCH  /pharmacy/inventory/{id}                 — partial update (incl. archived)
  PATCH  /pharmacy/inventory/{id}/adjust-stock    — delta-based stock change with underflow guard
  GET    /pharmacy/dashboard/low-stock-count      — {count: int} for dashboard card
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.db import get_db
from app.models.prescription import Drug, MedicineCategory
from app.models.user import User, UserRole
from app.schemas.inventory import (
    MedicineCreate,
    MedicineOut,
    MedicineUpdate,
    StockAdjustIn,
)

router = APIRouter(prefix="/pharmacy", tags=["inventory"])

_VALID_CATEGORIES = {c.value for c in MedicineCategory}
_VALID_STATUS = {"all", "in_stock", "low_stock", "out_of_stock", "archived"}


@router.get("/inventory", response_model=list[MedicineOut])
async def list_inventory(
    q: str | None = None,
    category: str | None = None,
    status: str = "all",
    include_archived: bool = False,
    current_user: User = Depends(require_role(UserRole.pharmacist)),
    db: AsyncSession = Depends(get_db),
):
    if status not in _VALID_STATUS:
        raise HTTPException(
            status_code=400, detail={"error": "invalid_status"}
        )
    if category is not None and category not in _VALID_CATEGORIES:
        raise HTTPException(
            status_code=400, detail={"error": "invalid_category"}
        )

    stmt = select(Drug)
    if q:
        stmt = stmt.where(Drug.name.ilike(f"%{q.strip()}%"))
    if category:
        stmt = stmt.where(Drug.category == category)

    if status == "low_stock":
        stmt = (
            stmt.where(Drug.archived == False)  # noqa: E712
            .where(Drug.stock_count > 0)
            .where(Drug.stock_count <= Drug.low_stock_threshold)
        )
    elif status == "out_of_stock":
        stmt = stmt.where(Drug.archived == False).where(Drug.stock_count == 0)  # noqa: E712
    elif status == "in_stock":
        stmt = stmt.where(Drug.archived == False).where(  # noqa: E712
            Drug.stock_count > Drug.low_stock_threshold
        )
    elif status == "archived":
        stmt = stmt.where(Drug.archived == True)  # noqa: E712
    else:  # status == "all"
        if not include_archived:
            stmt = stmt.where(Drug.archived == False)  # noqa: E712

    stmt = stmt.order_by(Drug.name.asc())
    rows = (await db.execute(stmt)).scalars().all()
    return [MedicineOut.model_validate(r) for r in rows]


@router.get("/dashboard/low-stock-count")
async def dashboard_low_stock_count(
    current_user: User = Depends(require_role(UserRole.pharmacist)),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(func.count(Drug.id))
        .where(Drug.archived == False)  # noqa: E712
        .where(Drug.stock_count <= Drug.low_stock_threshold)
    )
    count = (await db.execute(stmt)).scalar_one()
    return {"count": int(count)}


@router.get("/inventory/{medicine_id}", response_model=MedicineOut)
async def get_medicine(
    medicine_id: int,
    current_user: User = Depends(require_role(UserRole.pharmacist)),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Drug, medicine_id)
    if row is None:
        raise HTTPException(
            status_code=404, detail={"error": "medicine_not_found"}
        )
    return MedicineOut.model_validate(row)


@router.post(
    "/inventory",
    response_model=MedicineOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_medicine(
    payload: MedicineCreate,
    current_user: User = Depends(require_role(UserRole.pharmacist)),
    db: AsyncSession = Depends(get_db),
):
    if payload.category not in _VALID_CATEGORIES:
        raise HTTPException(
            status_code=400, detail={"error": "invalid_category"}
        )
    row = Drug(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return MedicineOut.model_validate(row)


@router.patch("/inventory/{medicine_id}", response_model=MedicineOut)
async def update_medicine(
    medicine_id: int,
    payload: MedicineUpdate,
    current_user: User = Depends(require_role(UserRole.pharmacist)),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Drug, medicine_id)
    if row is None:
        raise HTTPException(
            status_code=404, detail={"error": "medicine_not_found"}
        )
    data = payload.model_dump(exclude_unset=True)
    if "category" in data and data["category"] not in _VALID_CATEGORIES:
        raise HTTPException(
            status_code=400, detail={"error": "invalid_category"}
        )
    for k, v in data.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return MedicineOut.model_validate(row)


@router.patch("/inventory/{medicine_id}/adjust-stock", response_model=MedicineOut)
async def adjust_stock(
    medicine_id: int,
    payload: StockAdjustIn,
    current_user: User = Depends(require_role(UserRole.pharmacist)),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Drug, medicine_id)
    if row is None:
        raise HTTPException(
            status_code=404, detail={"error": "medicine_not_found"}
        )
    new_stock = row.stock_count + payload.delta
    if new_stock < 0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "stock_underflow",
                "current": row.stock_count,
                "delta": payload.delta,
            },
        )
    row.stock_count = new_stock
    await db.commit()
    await db.refresh(row)
    return MedicineOut.model_validate(row)

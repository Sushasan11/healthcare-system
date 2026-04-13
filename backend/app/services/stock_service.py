"""Stock decrement + restock helpers (D-31).

Shared by Phase 7 Rx and Phase 9 OTC order flows. Row-locks Drug rows in ascending
id order to avoid deadlocks, aggregates duplicate drug_ids, detects D-13 price drift
when an expected_price is supplied, and accumulates StockDiffs for the caller to
surface as a 409 cart_stock_changed response.

Neither function commits — the caller owns the transaction boundary.
"""
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prescription import Drug


@dataclass
class StockLineRequest:
    """Request for one drug line.

    expected_price is None for the Rx retrofit path (no client snapshot exists);
    the OTC path populates it from OtcOrderLineIn.price_snapshot so the D-13
    price-drift branch can fire.
    """
    drug_id: int
    quantity: int
    expected_price: Decimal | None = None


@dataclass
class StockDiff:
    drug_id: int
    requested: int
    available: int
    reason: str  # "stock_insufficient" | "out_of_stock" | "price_changed"
    old_price: Decimal | None = None
    new_price: Decimal | None = None


async def decrement_stock_for_lines(
    db: AsyncSession,
    lines: list[StockLineRequest],
) -> list[StockDiff]:
    """Row-lock drugs ASC by id, verify stock + price, decrement on success.

    Returns an empty list on full success. A non-empty return means the caller
    MUST roll back and emit a 409 cart_stock_changed payload — this function
    will not have committed anything itself.
    """
    diffs: list[StockDiff] = []
    if not lines:
        return diffs

    # Aggregate duplicates by drug_id. expected_price is taken from the first
    # occurrence — callers must not pass the same drug_id with conflicting
    # expected_prices.
    aggregated: dict[int, tuple[int, Decimal | None]] = {}
    for line in lines:
        if line.drug_id in aggregated:
            prev_qty, prev_price = aggregated[line.drug_id]
            aggregated[line.drug_id] = (prev_qty + line.quantity, prev_price)
        else:
            aggregated[line.drug_id] = (line.quantity, line.expected_price)

    for drug_id in sorted(aggregated.keys()):
        qty, expected_price = aggregated[drug_id]
        stmt = select(Drug).where(Drug.id == drug_id).with_for_update()
        result = await db.execute(stmt)
        drug = result.scalar_one_or_none()

        if drug is None or drug.archived:
            diffs.append(
                StockDiff(
                    drug_id=drug_id,
                    requested=qty,
                    available=0,
                    reason="out_of_stock",
                )
            )
            continue

        # D-13 price drift check (expected_price None → skipped for Rx retrofit)
        if expected_price is not None and Decimal(expected_price) != Decimal(drug.price):
            diffs.append(
                StockDiff(
                    drug_id=drug_id,
                    requested=qty,
                    available=drug.stock_count,
                    reason="price_changed",
                    old_price=Decimal(expected_price),
                    new_price=Decimal(drug.price),
                )
            )
            continue

        if drug.stock_count < qty:
            reason = "out_of_stock" if drug.stock_count == 0 else "stock_insufficient"
            diffs.append(
                StockDiff(
                    drug_id=drug_id,
                    requested=qty,
                    available=drug.stock_count,
                    reason=reason,
                )
            )
            continue

        drug.stock_count = drug.stock_count - qty

    return diffs


async def restock_for_lines(
    db: AsyncSession,
    lines: list[tuple[int, int]],
) -> None:
    """Row-lock drugs ASC by id and increment stock_count by quantity per line.

    Used by the OTC reject path (D-03). Silently skips None drug_ids and missing
    drug rows. Does not commit.
    """
    aggregated: dict[int, int] = {}
    for drug_id, qty in lines:
        if drug_id is None:
            continue
        aggregated[drug_id] = aggregated.get(drug_id, 0) + qty

    for drug_id in sorted(aggregated.keys()):
        stmt = select(Drug).where(Drug.id == drug_id).with_for_update()
        result = await db.execute(stmt)
        drug = result.scalar_one_or_none()
        if drug is None:
            continue
        drug.stock_count = drug.stock_count + aggregated[drug_id]

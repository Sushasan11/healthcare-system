"""Stock decrement + restock helpers (D-31).

Shared by Phase 7 Rx and Phase 9 OTC order flows. Bodies land in Plan 02 (Wave 1);
this module exists in Plan 01 so test stubs and callers can import the symbols.
"""
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession


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
    lines: list,  # Plan 02 finalizes type: list[StockLineRequest] carrying (drug_id, quantity, expected_price)
) -> list[StockDiff]:
    """Row-locks drugs ASC by id, verifies stock, decrements, returns empty list on success.

    Non-empty return means the caller should roll back and emit a 409 cart_stock_changed.
    Implementation lands in Plan 02 (Wave 1). Plan 02 will also accept an optional
    expected_price per line for D-13 price-drift detection (appends StockDiff with
    reason="price_changed" when expected_price is provided and differs from drug.price).
    """
    raise NotImplementedError("stock_service body lands in Plan 02")


async def restock_for_lines(
    db: AsyncSession,
    lines: list[tuple[int, int]],
) -> None:
    """Row-locks drugs ASC by id and increments stock_count by quantity per line.

    Used by OTC reject path (D-03). Implementation lands in Plan 02.
    """
    raise NotImplementedError("stock_service body lands in Plan 02")

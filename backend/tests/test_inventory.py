"""Phase 8 PHARM-02 — 11 Wave 0 acceptance test stubs for pharmacist inventory.

Each stub encodes one locked acceptance criterion from 08-CONTEXT.md.
Implementation lands in plan 08-02.
"""
import pytest

pytestmark = pytest.mark.asyncio


async def test_create_medicine_returns_201_with_all_fields():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_list_filters_by_category():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_list_status_low_stock_returns_only_at_or_below_threshold_with_stock_gt_0():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_list_status_out_of_stock_returns_only_zero_stock():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_list_excludes_archived_by_default_includes_when_flag_set():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_adjust_stock_positive_delta_increments():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_adjust_stock_negative_delta_decrements():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_adjust_stock_underflow_returns_400_stock_underflow():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_patch_medicine_rx_required_flips_flag():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_patch_medicine_archived_hides_from_default_list():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")


async def test_migration_009_round_trip():
    pytest.fail("Wave 0 stub — implementation pending in plan 08-02")

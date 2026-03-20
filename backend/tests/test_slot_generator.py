"""Unit tests for the slot generator service.

Uses a far-future date (2099-03-25) to prevent the 'skip past slots'
filter from interfering with test results.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.services.slot_generator import (
    SLOT_DURATION_MINUTES,
    generate_available_slots,
    generate_slots_for_day,
)

FUTURE_DATE = date(2099, 3, 25)  # Wednesday — far future avoids past-slot filter
UTC = ZoneInfo("UTC")


def test_generate_slots_basic_window():
    """9:00–12:00 window should produce 6 slots (every 30 min, last starts at 11:30)."""
    slots = generate_slots_for_day("09:00", "12:00", FUTURE_DATE, set(), set())
    assert len(slots) == 6
    times = [(s.hour, s.minute) for s in slots]
    assert times == [(9, 0), (9, 30), (10, 0), (10, 30), (11, 0), (11, 30)]


def test_generate_slots_excludes_blocked():
    """A blocked datetime should be excluded from the result."""
    blocked_dt = datetime(2099, 3, 25, 10, 0, tzinfo=UTC)
    slots = generate_slots_for_day("09:00", "12:00", FUTURE_DATE, {blocked_dt}, set())
    assert len(slots) == 5
    slot_times = [(s.hour, s.minute) for s in slots]
    assert (10, 0) not in slot_times


def test_generate_slots_excludes_booked():
    """A booked datetime should be excluded from the result."""
    booked_dt = datetime(2099, 3, 25, 9, 30, tzinfo=UTC)
    slots = generate_slots_for_day("09:00", "12:00", FUTURE_DATE, set(), {booked_dt})
    assert len(slots) == 5
    slot_times = [(s.hour, s.minute) for s in slots]
    assert (9, 30) not in slot_times


def test_generate_slots_zero_length_window():
    """Start == end should produce no slots."""
    slots = generate_slots_for_day("09:00", "09:00", FUTURE_DATE, set(), set())
    assert slots == []


def test_generate_slots_sub_30_min_window():
    """A window shorter than 30 minutes should produce no slots."""
    slots = generate_slots_for_day("09:00", "09:15", FUTURE_DATE, set(), set())
    assert slots == []


def test_generate_slots_returns_timezone_aware():
    """All returned datetimes should be timezone-aware (tzinfo is not None)."""
    slots = generate_slots_for_day("09:00", "10:00", FUTURE_DATE, set(), set())
    assert len(slots) > 0
    for slot in slots:
        assert slot.tzinfo is not None, f"Slot {slot} is not timezone-aware"


def test_generate_available_slots_weekly_schedule():
    """generate_available_slots should return correct slots across multiple days."""
    # Monday = 0, Wednesday = 2 in Python weekday()
    # 2099-03-24 is a Monday, 2099-03-25 is Tuesday, 2099-03-26 is Wednesday
    start = date(2099, 3, 24)  # Monday
    schedule = [
        {"day_of_week": 0, "start_time": "09:00", "end_time": "10:00", "is_active": True},  # Mon
        {"day_of_week": 2, "start_time": "14:00", "end_time": "15:30", "is_active": True},  # Wed
        {"day_of_week": 4, "start_time": "10:00", "end_time": "11:00", "is_active": False},  # Fri inactive
    ]
    slots = generate_available_slots(schedule, [], [], start, days=7)
    # Monday: 09:00, 09:30 = 2 slots
    # Wednesday: 14:00, 14:30, 15:00 = 3 slots
    # Friday: inactive → 0 slots
    assert len(slots) == 5
    # Verify slots are sorted
    assert slots == sorted(slots)
    # Verify no Friday slots
    friday = date(2099, 3, 28)
    friday_slots = [s for s in slots if s.date() == friday]
    assert friday_slots == []

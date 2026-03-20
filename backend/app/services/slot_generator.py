"""Slot generator service.

Pure functions for computing available appointment slots based on a doctor's
weekly schedule, excluding blocked and already-booked datetimes.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

SLOT_DURATION_MINUTES = 30


def generate_slots_for_day(
    work_start: str,
    work_end: str,
    target_date: date,
    blocked_datetimes: set[datetime],
    booked_datetimes: set[datetime],
    tz: ZoneInfo = ZoneInfo("UTC"),
) -> list[datetime]:
    """Return all available 30-minute slots within a work window on a given day.

    Args:
        work_start: Work window start in "HH:MM" format.
        work_end: Work window end in "HH:MM" format.
        target_date: The calendar date to generate slots for.
        blocked_datetimes: Set of datetimes explicitly blocked by the doctor.
        booked_datetimes: Set of datetimes already booked by patients.
        tz: Timezone for the generated datetimes (default UTC).

    Returns:
        Sorted list of timezone-aware datetimes for available slots.
    """
    start_h, start_m = map(int, work_start.split(":"))
    end_h, end_m = map(int, work_end.split(":"))

    slot_start = datetime(
        target_date.year, target_date.month, target_date.day,
        start_h, start_m, tzinfo=tz
    )
    window_end = datetime(
        target_date.year, target_date.month, target_date.day,
        end_h, end_m, tzinfo=tz
    )

    now = datetime.now(tz)
    slot_duration = timedelta(minutes=SLOT_DURATION_MINUTES)

    slots: list[datetime] = []
    current = slot_start

    while current + slot_duration <= window_end:
        # Skip slots in the past
        if current > now:
            if current not in blocked_datetimes and current not in booked_datetimes:
                slots.append(current)
        current += slot_duration

    return slots


def generate_available_slots(
    schedule: list[dict],
    blocks: list[datetime],
    booked: list[datetime],
    start_date: date,
    days: int = 7,
    tz: ZoneInfo = ZoneInfo("UTC"),
) -> list[datetime]:
    """Return all available slots across a date range based on a weekly schedule.

    Args:
        schedule: List of dicts with keys: day_of_week (int 0-6), start_time (str),
                  end_time (str), is_active (bool).
        blocks: List of datetimes explicitly blocked by the doctor.
        booked: List of datetimes already booked by patients.
        start_date: First day of the date range to generate slots for.
        days: Number of days to cover (default 7).
        tz: Timezone for the generated datetimes (default UTC).

    Returns:
        Sorted list of timezone-aware datetimes for all available slots.
    """
    blocked_set: set[datetime] = set(blocks)
    booked_set: set[datetime] = set(booked)

    # Index schedule by day_of_week for O(1) lookup
    schedule_by_day: dict[int, dict] = {}
    for entry in schedule:
        dow = entry["day_of_week"]
        if entry.get("is_active", True):
            schedule_by_day[dow] = entry

    all_slots: list[datetime] = []

    for offset in range(days):
        day = start_date + timedelta(days=offset)
        dow = day.weekday()  # 0=Monday, 6=Sunday

        if dow not in schedule_by_day:
            continue

        entry = schedule_by_day[dow]
        day_slots = generate_slots_for_day(
            entry["start_time"],
            entry["end_time"],
            day,
            blocked_set,
            booked_set,
            tz,
        )
        all_slots.extend(day_slots)

    return sorted(all_slots)

"""Async key-value store backed by PostgreSQL.

Drop-in replacement for the Redis operations used in auth (lockout, refresh
tokens) and appointment slot holds. Expired rows are filtered out on read
and cleaned up lazily.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.kv_store import KeyValueEntry


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_expired(expires_at: datetime) -> bool:
    """Compare expiry timestamp, handling both naive and aware datetimes."""
    now = _utcnow()
    # SQLite returns naive datetimes — treat them as UTC
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at < now


class KVStore:
    """Thin async wrapper around the kv_store table."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get(self, key: str) -> str | None:
        entry = (await self._db.execute(
            select(KeyValueEntry).where(KeyValueEntry.key == key)
        )).scalar_one_or_none()
        if entry is None:
            return None

        if entry.expires_at and _is_expired(entry.expires_at):
            await self._db.delete(entry)
            await self._db.commit()
            return None
        return entry.value

    async def set(self, key: str, value: str, *, ex: int | None = None, nx: bool = False) -> bool | None:
        """Set key to value. ex=seconds TTL, nx=only set if not exists.
        Returns True on success, None if nx and key exists."""
        expires_at = _utcnow() + timedelta(seconds=ex) if ex else None

        existing = (await self._db.execute(
            select(KeyValueEntry).where(KeyValueEntry.key == key)
        )).scalar_one_or_none()

        if existing:
            if existing.expires_at and _is_expired(existing.expires_at):
                await self._db.delete(existing)
                await self._db.flush()
                existing = None

        if existing and nx:
            return None  # Key exists and nx requested

        if existing:
            existing.value = value
            existing.expires_at = expires_at
        else:
            self._db.add(KeyValueEntry(key=key, value=value, expires_at=expires_at))

        await self._db.commit()
        return True

    async def setex(self, key: str, ttl: int, value: str) -> None:
        await self.set(key, value, ex=ttl)

    async def incr(self, key: str) -> int:
        existing = (await self._db.execute(
            select(KeyValueEntry).where(KeyValueEntry.key == key)
        )).scalar_one_or_none()

        if existing and existing.expires_at and _is_expired(existing.expires_at):
            await self._db.delete(existing)
            await self._db.flush()
            existing = None

        if existing:
            new_val = int(existing.value) + 1
            existing.value = str(new_val)
        else:
            new_val = 1
            self._db.add(KeyValueEntry(key=key, value="1"))

        await self._db.commit()
        return new_val

    async def expire(self, key: str, ttl: int) -> None:
        existing = (await self._db.execute(
            select(KeyValueEntry).where(KeyValueEntry.key == key)
        )).scalar_one_or_none()
        if existing:
            existing.expires_at = _utcnow() + timedelta(seconds=ttl)
            await self._db.commit()

    async def delete(self, key: str) -> None:
        await self._db.execute(
            delete(KeyValueEntry).where(KeyValueEntry.key == key)
        )
        await self._db.commit()

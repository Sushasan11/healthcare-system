"""Test configuration and shared fixtures.

Uses SQLite (aiosqlite) for an in-memory test database — no PostgreSQL required.
Redis is mocked via fakeredis so tests run fully offline.

The PHI_ENCRYPTION_KEY env var is set to a deterministic test key so
EncryptedString TypeDecorator works in tests.
"""

import os

import fakeredis
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Set test PHI encryption key BEFORE any app module is imported.
# Must be a 64-char hex string (32 bytes).
TEST_PHI_KEY = os.urandom(32).hex()
os.environ.setdefault("PHI_ENCRYPTION_KEY", TEST_PHI_KEY)

from app.db import Base, get_db, get_redis  # noqa: E402
from app.main import app  # noqa: E402

# Use file-based SQLite so it persists across fixture scopes during a session.
# aiosqlite driver required.
TEST_DB_URL = "sqlite+aiosqlite:///./test.db"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(autouse=True, scope="module")
async def create_test_tables():
    """Create all tables before the module's tests, drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    """Yield an AsyncSession backed by the test SQLite database."""
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def async_client(db_session):
    """AsyncClient wired to the FastAPI app with DB and Redis overrides."""
    fake_redis = fakeredis.FakeAsyncRedis(decode_responses=True)

    async def override_get_db():
        yield db_session

    async def override_get_redis():
        return fake_redis

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client

    app.dependency_overrides.clear()

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

import app.db as app_db  # noqa: E402 — must import before patching
import app.routers.ws as ws_module  # noqa: E402 — needed to patch AsyncSessionLocal ref
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
    """Create all tables before the module's tests, drop them after.

    Also patches app.db.AsyncSessionLocal → TestSessionLocal so WebSocket
    endpoints (which use AsyncSessionLocal directly) hit the test SQLite DB.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Patch the module-level AsyncSessionLocal used by WebSocket endpoints.
    # ws.py does `from app.db import AsyncSessionLocal` so we must patch
    # both the source (app_db) AND the cached name in ws_module.
    original_session_local = app_db.AsyncSessionLocal
    original_ws_session_local = ws_module.AsyncSessionLocal
    app_db.AsyncSessionLocal = TestSessionLocal
    ws_module.AsyncSessionLocal = TestSessionLocal

    yield

    # Restore originals after tests
    app_db.AsyncSessionLocal = original_session_local
    ws_module.AsyncSessionLocal = original_ws_session_local

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

    # Also patch the module-level redis_client to None so WebSocket
    # endpoints use local relay (no real Redis required for tests).
    # Must patch both app_db AND ws_module since ws.py uses `from app.db import redis_client`.
    original_redis = app_db.redis_client
    original_ws_redis = ws_module.redis_client
    app_db.redis_client = None
    ws_module.redis_client = None

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client

    app_db.redis_client = original_redis
    ws_module.redis_client = original_ws_redis
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_consultation(db_session, async_client):
    """Create a doctor, patient, appointment, and consultation for testing.
    Returns dict with user objects and consultation ID."""
    import uuid
    from app.core.security import hash_password

    # Create doctor user
    from app.models.user import User, UserRole, AccountStatus
    from app.models.appointment import Appointment, AppointmentStatus
    from app.models.consultation import Consultation, ConsultationStatus
    from datetime import datetime, timezone, timedelta

    # Use unique emails per fixture call to avoid UNIQUE constraint violations
    uid = uuid.uuid4().hex[:8]
    doctor = User(
        email=f"doc_{uid}@test.dev",
        full_name="Dr. Test",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.doctor,
        account_status=AccountStatus.active,
    )
    patient = User(
        email=f"patient_{uid}@test.dev",
        full_name="Patient Test",
        hashed_password=hash_password("TestPass1!"),
        role=UserRole.patient,
        account_status=AccountStatus.active,
    )
    db_session.add_all([doctor, patient])
    await db_session.flush()

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        slot_datetime=datetime.now(timezone.utc) + timedelta(minutes=5),
        status=AppointmentStatus.confirmed,
    )
    db_session.add(appointment)
    await db_session.flush()

    consultation = Consultation(
        appointment_id=appointment.id,
        status=ConsultationStatus.active,
    )
    db_session.add(consultation)
    await db_session.commit()
    await db_session.refresh(consultation)

    return {
        "doctor": doctor,
        "patient": patient,
        "appointment": appointment,
        "consultation": consultation,
    }

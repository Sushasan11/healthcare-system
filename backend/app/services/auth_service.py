"""Auth business logic layer.

Handles registration, authentication, session management, lockout,
email verification, and password reset. Routers are thin; all logic lives here.

Lockout strategy:
  - Redis key: lockout:{email}
  - After 5 failed attempts: raise 429
  - TTL: 900 seconds (15 minutes) — reset on each failed attempt
  - Cleared on successful login
"""

import logging

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.patient_profile import PatientProfile
from app.models.user import AccountStatus, User, UserRole
from app.schemas.auth import (
    DoctorRegisterRequest,
    PatientRegisterRequest,
    PharmacistRegisterRequest,
)
from app.services.email_service import (
    send_password_reset_email,
    send_verification_email,
)

logger = logging.getLogger(__name__)

LOCKOUT_THRESHOLD = 5
LOCKOUT_TTL = 900  # 15 minutes in seconds


# ---------------------------------------------------------------------------
# Lockout helpers
# ---------------------------------------------------------------------------


async def check_lockout(redis, email: str) -> None:
    """Raise 429 if the email has reached the lockout threshold."""
    key = f"lockout:{email}"
    count = await redis.get(key)
    if count and int(count) >= LOCKOUT_THRESHOLD:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked. Try again in 15 minutes.",
        )


async def record_failed_attempt(redis, email: str) -> None:
    """Increment failed attempt counter and set/reset TTL."""
    key = f"lockout:{email}"
    await redis.incr(key)
    await redis.expire(key, LOCKOUT_TTL)


async def clear_lockout(redis, email: str) -> None:
    """Remove lockout key on successful login."""
    await redis.delete(f"lockout:{email}")


# ---------------------------------------------------------------------------
# Refresh token helpers
# ---------------------------------------------------------------------------


async def store_refresh_token(redis, token: str, user_id: int, ttl: int) -> None:
    """Store refresh token in Redis with TTL."""
    await redis.setex(f"refresh:{token}", ttl, str(user_id))


async def revoke_refresh_token(redis, token: str) -> None:
    """Delete refresh token from Redis."""
    await redis.delete(f"refresh:{token}")


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


async def register_patient(data: PatientRegisterRequest, db: AsyncSession) -> User:
    """Create Patient user + PatientProfile, send verification email."""
    await _assert_email_unique(data.email, db)

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole.patient,
        account_status=AccountStatus.pending_verification,
        email_verified=False,
        is_active=True,
    )
    db.add(user)
    await db.flush()  # get user.id before creating profile

    profile = PatientProfile(
        user_id=user.id,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        address=data.address,
        emergency_contact=data.emergency_contact,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(user)

    await send_verification_email(data.email, user.id)
    return user


async def register_doctor(data: DoctorRegisterRequest, db: AsyncSession) -> User:
    """Create Doctor user (pending_approval), send verification email."""
    await _assert_email_unique(data.email, db)

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole.doctor,
        account_status=AccountStatus.pending_approval,
        email_verified=False,
        is_active=True,
        specialty=data.specialty,
        medical_license_number=data.medical_license_number,
        years_of_experience=data.years_of_experience,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await send_verification_email(data.email, user.id)
    return user


async def register_pharmacist(data: PharmacistRegisterRequest, db: AsyncSession) -> User:
    """Create Pharmacist user (pending_approval), send verification email."""
    await _assert_email_unique(data.email, db)

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=UserRole.pharmacist,
        account_status=AccountStatus.pending_approval,
        email_verified=False,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await send_verification_email(data.email, user.id)
    return user


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


async def authenticate(
    email: str,
    password: str,
    db: AsyncSession,
    redis,
) -> tuple[User, str, str]:
    """Authenticate user. Returns (user, access_token, refresh_token).

    - Uses DUMMY_HASH if user not found to prevent timing oracle (Pitfall 5).
    - Raises 429 if account is locked out.
    - Raises 401 with uniform message for wrong email or wrong password.
    - Clears lockout counter on success; increments on failure.
    """
    await check_lockout(redis, email)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Always run password verification (even for non-existent users) to prevent timing attacks
    candidate_hash = user.hashed_password if user else DUMMY_HASH
    password_ok = verify_password(password, candidate_hash)

    if not user or not password_ok:
        await record_failed_attempt(redis, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Successful authentication — clear lockout
    await clear_lockout(redis, email)

    access_token = create_access_token(sub=str(user.id), role=user.role)
    refresh_token = create_refresh_token(sub=str(user.id))

    # Store refresh token in Redis
    ttl = settings.REFRESH_TOKEN_EXPIRE_HOURS * 3600
    await store_refresh_token(redis, refresh_token, user.id, ttl)

    return user, access_token, refresh_token


# ---------------------------------------------------------------------------
# Email verification & password reset
# ---------------------------------------------------------------------------


async def verify_email_token(token: str, db: AsyncSession) -> User:
    """Decode email verification JWT and activate the user."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    if payload.get("type") != "email_verify":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token type",
        )

    user_id = int(payload["sub"])
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.email_verified = True
    # Patients become active; doctors/pharmacists stay pending_approval until admin approves
    if user.role == UserRole.patient:
        user.account_status = AccountStatus.active

    await db.commit()
    await db.refresh(user)
    return user


async def initiate_password_reset(email: str, db: AsyncSession) -> None:
    """Send password reset email if account exists. Always returns success (no user enumeration)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        await send_password_reset_email(email, user.id)
    # Silently succeed even if email doesn't exist


async def reset_password(token: str, new_password: str, db: AsyncSession) -> None:
    """Decode password reset JWT and update the user's password."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    if payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token type",
        )

    user_id = int(payload["sub"])
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = hash_password(new_password)
    await db.commit()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _assert_email_unique(email: str, db: AsyncSession) -> None:
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

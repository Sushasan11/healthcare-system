"""Auth business logic layer.

Handles registration, authentication, session management, lockout,
email verification, and password reset. Routers are thin; all logic lives here.

Lockout strategy:
  - DB key: lockout:{email}
  - After 5 failed attempts: raise 429
  - TTL: 900 seconds (15 minutes) — reset on each failed attempt
  - Cleared on successful login
"""

import logging
import secrets

import httpx
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
from app.services.kv_store import KVStore

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

logger = logging.getLogger(__name__)

LOCKOUT_THRESHOLD = 5
LOCKOUT_TTL = 900  # 15 minutes in seconds


# ---------------------------------------------------------------------------
# Lockout helpers
# ---------------------------------------------------------------------------


async def check_lockout(kv: KVStore, email: str) -> None:
    """Raise 429 if the email has reached the lockout threshold."""
    key = f"lockout:{email}"
    count = await kv.get(key)
    if count and int(count) >= LOCKOUT_THRESHOLD:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked. Try again in 15 minutes.",
        )


async def record_failed_attempt(kv: KVStore, email: str) -> None:
    """Increment failed attempt counter and set/reset TTL."""
    key = f"lockout:{email}"
    await kv.incr(key)
    await kv.expire(key, LOCKOUT_TTL)


async def clear_lockout(kv: KVStore, email: str) -> None:
    """Remove lockout key on successful login."""
    await kv.delete(f"lockout:{email}")


# ---------------------------------------------------------------------------
# Refresh token helpers
# ---------------------------------------------------------------------------


async def store_refresh_token(kv: KVStore, token: str, user_id: int, ttl: int) -> None:
    """Store refresh token with TTL."""
    await kv.setex(f"refresh:{token}", ttl, str(user_id))


async def revoke_refresh_token(kv: KVStore, token: str) -> None:
    """Delete refresh token."""
    await kv.delete(f"refresh:{token}")


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
) -> tuple[User, str, str]:
    """Authenticate user. Returns (user, access_token, refresh_token).

    - Uses DUMMY_HASH if user not found to prevent timing oracle (Pitfall 5).
    - Raises 429 if account is locked out.
    - Raises 401 with uniform message for wrong email or wrong password.
    - Clears lockout counter on success; increments on failure.
    """
    kv = KVStore(db)
    await check_lockout(kv, email)

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Always run password verification (even for non-existent users) to prevent timing attacks
    candidate_hash = user.hashed_password if user else DUMMY_HASH
    password_ok = verify_password(password, candidate_hash)

    if not user or not password_ok:
        await record_failed_attempt(kv, email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Successful authentication — clear lockout
    await clear_lockout(kv, email)

    access_token = create_access_token(sub=str(user.id), role=user.role)
    refresh_token = create_refresh_token(sub=str(user.id))

    # Store refresh token
    ttl = settings.REFRESH_TOKEN_EXPIRE_HOURS * 3600
    await store_refresh_token(kv, refresh_token, user.id, ttl)

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
# Google OAuth
# ---------------------------------------------------------------------------


async def google_authenticate(
    id_token: str,
    db: AsyncSession,
) -> tuple[User, str, str, bool]:
    """Verify Google ID token and login or register the user.

    Returns (user, access_token, refresh_token, is_new_user).
    """
    # Verify token with Google
    async with httpx.AsyncClient() as client:
        resp = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token})

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        )

    payload = resp.json()

    # Verify audience matches our client ID
    if payload.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token not intended for this application",
        )

    email = payload.get("email")
    if not email or payload.get("email_verified") != "true":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email not verified",
        )

    full_name = payload.get("name", email.split("@")[0])

    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    is_new = False

    if not user:
        # Auto-register as patient with a random password (OAuth-only account)
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=full_name,
            role=UserRole.patient,
            account_status=AccountStatus.active,
            email_verified=True,
            is_active=True,
        )
        db.add(user)
        await db.flush()

        profile = PatientProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(user)
        is_new = True

    access_token = create_access_token(sub=str(user.id), role=user.role)
    refresh_token = create_refresh_token(sub=str(user.id))

    # Store refresh token
    kv = KVStore(db)
    ttl = settings.REFRESH_TOKEN_EXPIRE_HOURS * 3600
    await store_refresh_token(kv, refresh_token, user.id, ttl)

    return user, access_token, refresh_token, is_new


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

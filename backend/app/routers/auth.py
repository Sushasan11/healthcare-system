"""Auth router — registration, login, session management, email verification, password reset.

Endpoints:
  POST /auth/register/patient
  POST /auth/register/doctor
  POST /auth/register/pharmacist
  POST /auth/login
  POST /auth/refresh
  POST /auth/logout
  GET  /auth/verify-email
  POST /auth/forgot-password
  POST /auth/reset-password
"""

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, decode_token
from app.db import get_db, get_redis
from app.schemas.auth import (
    DoctorRegisterRequest,
    ForgotPasswordRequest,
    LoginRequest,
    PatientRegisterRequest,
    PharmacistRegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_HOURS * 3600


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Attach the refresh token as an HttpOnly cookie."""
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # Set True in production (HTTPS only)
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


@router.post("/register/patient", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_patient(
    data: PatientRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.register_patient(data, db)
    return user


@router.post("/register/doctor", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_doctor(
    data: DoctorRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.register_doctor(data, db)
    return user


@router.post("/register/pharmacist", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_pharmacist(
    data: PharmacistRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.register_pharmacist(data, db)
    return user


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    user, access_token, refresh_token = await auth_service.authenticate(
        data.email, data.password, db, redis
    )

    # Check email verification
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox.",
        )

    # Check account status
    if user.account_status.value == "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending_approval. Your application is under review.",
        )

    if user.account_status.value == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended.",
        )

    _set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token)


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    # Validate JWT
    try:
        payload = decode_token(token)
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    # Check Redis — token must still be present (not revoked)
    stored = await redis.get(f"refresh:{token}")
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked or expired",
        )

    # Issue new access token
    user_id = payload["sub"]
    user = await db.get(__import__("app.models.user", fromlist=["User"]).User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    new_access_token = create_access_token(sub=str(user.id), role=user.role)
    return TokenResponse(access_token=new_access_token)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user=Depends(get_current_user),
    redis=Depends(get_redis),
):
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if token:
        await auth_service.revoke_refresh_token(redis, token)
    _clear_refresh_cookie(response)
    return {"detail": "Logged out"}


# ---------------------------------------------------------------------------
# Email verification & password reset
# ---------------------------------------------------------------------------


@router.get("/verify-email")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.verify_email_token(token, db)
    return {"detail": "Email verified"}


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.initiate_password_reset(data.email, db)
    return {"detail": "If that email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.reset_password(data.token, data.new_password, db)
    return {"detail": "Password updated"}

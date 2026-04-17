"""Profile router — authenticated user profile access and updates.

Endpoints:
  GET /me
  PUT /me/profile  (patients only)
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.db import get_db
from app.models.patient_profile import PatientProfile
from app.models.user import User, UserRole
from app.schemas.user import PatientProfileOut, UserOut

router = APIRouter(prefix="/me", tags=["profile"])


class PatientProfileUpdate(BaseModel):
    allergies: str | None = None
    current_medications: str | None = None
    chronic_conditions: str | None = None
    blood_type: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    date_of_birth: Any | None = None
    gender: str | None = None


class UserWithProfileOut(UserOut):
    """UserOut extended with optional patient profile data."""
    profile: PatientProfileOut | None = None


@router.get("", response_model=UserWithProfileOut)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current user. For patients, include PatientProfile data."""
    profile_data = None
    if current_user.role == UserRole.patient:
        # Eagerly load patient_profile to avoid lazy-load in async context
        result = await db.execute(
            select(User)
            .options(selectinload(User.patient_profile))
            .where(User.id == current_user.id)
        )
        user_with_profile = result.scalar_one_or_none()
        if user_with_profile and user_with_profile.patient_profile:
            profile_data = PatientProfileOut.model_validate(user_with_profile.patient_profile)

    return UserWithProfileOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        account_status=current_user.account_status,
        created_at=current_user.created_at,
        profile=profile_data,
    )


@router.put("/profile", response_model=PatientProfileOut)
async def update_profile(
    data: PatientProfileUpdate,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """Update patient profile. Only patients can call this endpoint."""
    # Eagerly load profile to avoid lazy-load in async context
    result = await db.execute(
        select(PatientProfile).where(PatientProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )

    update_fields = data.model_dump(exclude_none=True)
    for field, value in update_fields.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile

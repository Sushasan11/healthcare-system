"""Doctors router — doctor listing, profile management.

Endpoints:
  GET /doctors              — public doctor listing with filters
  GET /doctors/{doctor_id}  — public doctor detail with availability
  PUT /doctors/me/profile   — doctor updates own profile
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.db import get_db
from app.models.doctor_profile import DoctorProfile
from app.models.user import AccountStatus, User, UserRole
from app.schemas.doctor import DoctorDetailOut, DoctorListItem, DoctorProfileOut, DoctorProfileUpdate

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.get("", response_model=dict)
async def list_doctors(
    specialty: str | None = Query(default=None),
    name: str | None = Query(default=None),
    sort: str = Query(default="rating"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List active doctors with optional specialty/name filters. Public endpoint."""
    query = (
        select(User)
        .outerjoin(DoctorProfile, DoctorProfile.user_id == User.id)
        .options(selectinload(User.doctor_profile))
        .where(User.role == UserRole.doctor)
        .where(User.account_status == AccountStatus.active)
    )

    if specialty:
        query = query.where(User.specialty == specialty)
    if name:
        query = query.where(User.full_name.ilike(f"%{name}%"))

    query = query.order_by(DoctorProfile.rating.desc().nulls_last())

    # Count total
    count_query = (
        select(func.count())
        .select_from(User)
        .outerjoin(DoctorProfile, DoctorProfile.user_id == User.id)
        .where(User.role == UserRole.doctor)
        .where(User.account_status == AccountStatus.active)
    )
    if specialty:
        count_query = count_query.where(User.specialty == specialty)
    if name:
        count_query = count_query.where(User.full_name.ilike(f"%{name}%"))

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for user in users:
        item = DoctorListItem(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            specialty=user.specialty,
            years_of_experience=user.years_of_experience,
            profile=DoctorProfileOut.model_validate(user.doctor_profile) if user.doctor_profile else None,
        )
        items.append(item.model_dump())

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{doctor_id}", response_model=DoctorDetailOut)
async def get_doctor(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get doctor detail including availability. Public endpoint."""
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.doctor_profile).selectinload(DoctorProfile.availability)
        )
        .where(User.id == doctor_id)
        .where(User.role == UserRole.doctor)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found",
        )

    availability = []
    if user.doctor_profile:
        availability = user.doctor_profile.availability

    return DoctorDetailOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        specialty=user.specialty,
        years_of_experience=user.years_of_experience,
        profile=DoctorProfileOut.model_validate(user.doctor_profile) if user.doctor_profile else None,
        availability=availability,
    )


@router.put("/me/profile", response_model=DoctorProfileOut)
async def update_my_profile(
    data: DoctorProfileUpdate,
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the doctor's own profile. Doctor role only."""
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        profile = DoctorProfile(user_id=current_user.id)
        db.add(profile)
        await db.flush()

    update_fields = data.model_dump(exclude_none=True)
    for field, value in update_fields.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return DoctorProfileOut.model_validate(profile)

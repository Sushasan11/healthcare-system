"""Admin router — user management, application management, and platform settings.

All endpoints require admin role. Responses use admin schemas (no PHI).

Endpoints:
  GET  /admin/applications
  POST /admin/applications/{user_id}/approve
  POST /admin/applications/{user_id}/reject
  GET  /admin/users
  POST /admin/users/{user_id}/suspend
  POST /admin/users/{user_id}/activate
  GET  /admin/stats
  GET  /admin/settings/commission
  PUT  /admin/settings/commission
"""

import math

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_role
from app.db import get_db
from app.models.doctor_profile import DoctorProfile
from app.models.payment import Payment, PaymentLedger, TransactionType
from app.models.user import AccountStatus, User, UserRole
from app.schemas.admin import (
    AdminStatsOut,
    ApplicationAdminOut,
    CommissionIn,
    CommissionOut,
    DoctorProfileSummary,
    RejectApplicationRequest,
    UserAdminPaginatedOut,
)
from app.schemas.payment import AdminTransactionListOut, AdminTransactionOut
from app.schemas.user import UserAdminOut
from app.services.kv_store import KVStore

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_role("admin"))],
)


@router.get("/applications", response_model=list[ApplicationAdminOut])
async def list_applications(
    db: AsyncSession = Depends(get_db),
):
    """List all users with pending_approval status, including doctor profile info."""
    result = await db.execute(
        select(User)
        .where(User.account_status == AccountStatus.pending_approval)
        .options(selectinload(User.doctor_profile))
    )
    users = result.scalars().all()

    # Build ApplicationAdminOut with DoctorProfileSummary (specialty from User model)
    out = []
    for user in users:
        profile_summary = None
        if user.doctor_profile is not None:
            profile_summary = DoctorProfileSummary(
                specialty=user.specialty,
                qualifications=user.doctor_profile.qualifications,
                bio=user.doctor_profile.bio,
            )
        out.append(
            ApplicationAdminOut(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                account_status=user.account_status,
                created_at=user.created_at,
                doctor_profile=profile_summary,
            )
        )
    return out


@router.post("/applications/{user_id}/approve", response_model=UserAdminOut)
async def approve_application(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending application — sets status to active."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.account_status != AccountStatus.pending_approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not in pending_approval status",
        )
    user.account_status = AccountStatus.active
    user.is_active = True
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/applications/{user_id}/reject", response_model=UserAdminOut)
async def reject_application(
    user_id: int,
    body: RejectApplicationRequest = Body(default_factory=RejectApplicationRequest),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending application — sets status to suspended. Accepts optional rejection_reason."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.account_status != AccountStatus.pending_approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not in pending_approval status",
        )
    user.account_status = AccountStatus.suspended
    user.is_active = False
    user.rejection_reason = body.rejection_reason
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/users", response_model=UserAdminPaginatedOut)
async def list_users(
    role: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List all users with pagination and optional role filter. Returns total count."""
    # Build base query
    base_query = select(User)
    count_query = select(func.count()).select_from(User)

    if role is not None:
        base_query = base_query.where(User.role == role)
        count_query = count_query.where(User.role == role)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get paginated results
    users_result = await db.execute(
        base_query.order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    users = users_result.scalars().all()

    return UserAdminPaginatedOut(users=users, total=total)


@router.post("/users/{user_id}/suspend", response_model=UserAdminOut)
async def suspend_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Suspend a user account — sets account_status=suspended and is_active=False."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend admin accounts",
        )
    user.account_status = AccountStatus.suspended
    user.is_active = False
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/users/{user_id}/activate", response_model=UserAdminOut)
async def activate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Activate a user account — sets account_status=active and is_active=True."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify admin accounts",
        )
    user.account_status = AccountStatus.active
    user.is_active = True
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/stats", response_model=AdminStatsOut)
async def get_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get platform statistics: user counts, pending applications, commission rate."""
    # Total users
    total_result = await db.execute(select(func.count()).select_from(User))
    total_users = total_result.scalar_one()

    # By role
    role_result = await db.execute(select(User.role, func.count()).group_by(User.role))
    by_role = {str(row[0]): row[1] for row in role_result.all()}

    # Pending applications
    pending_result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(User.account_status == AccountStatus.pending_approval)
    )
    pending_applications = pending_result.scalar_one()

    # Commission rate from kv_store
    rate_str = await KVStore(db).get("commission_rate")
    commission_rate = float(rate_str) if rate_str is not None else 0.0

    return AdminStatsOut(
        total_users=total_users,
        by_role=by_role,
        pending_applications=pending_applications,
        commission_rate=commission_rate,
    )


@router.get("/settings/commission", response_model=CommissionOut)
async def get_commission(
    db: AsyncSession = Depends(get_db),
):
    """Get the current platform commission rate from kv_store."""
    rate_str = await KVStore(db).get("commission_rate")
    commission_rate = float(rate_str) if rate_str is not None else 0.0
    return CommissionOut(commission_rate=commission_rate)


@router.put("/settings/commission", response_model=CommissionOut)
async def set_commission(
    body: CommissionIn,
    db: AsyncSession = Depends(get_db),
):
    """Set the platform commission rate in kv_store."""
    await KVStore(db).set("commission_rate", str(body.commission_rate))
    return CommissionOut(commission_rate=body.commission_rate)


@router.get("/transactions", response_model=AdminTransactionListOut)
async def admin_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of all platform transactions with commission details (ADMIN-01)."""
    total_count = (
        await db.execute(select(func.count()).select_from(PaymentLedger))
    ).scalar_one()

    total_commission = (
        await db.execute(
            select(func.coalesce(func.sum(PaymentLedger.commission_amount), 0))
        )
    ).scalar_one()

    result = await db.execute(
        select(PaymentLedger)
        .options(
            selectinload(PaymentLedger.payment).selectinload(Payment.patient),
            selectinload(PaymentLedger.payment).selectinload(Payment.provider),
        )
        .order_by(PaymentLedger.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    entries = result.scalars().all()

    transactions = [
        AdminTransactionOut(
            id=entry.payment.id,
            date=entry.created_at,
            patient_name=entry.payment.patient.full_name,
            provider_name=entry.payment.provider.full_name,
            transaction_type=(
                "Consultation Fee"
                if entry.payment.transaction_type == TransactionType.consultation_fee
                else "Order Sale"
            ),
            gross_amount=entry.gross_amount,
            commission_amount=entry.commission_amount,
            net_amount=entry.net_amount,
            status=entry.payment.status.value,
        )
        for entry in entries
    ]

    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1

    return AdminTransactionListOut(
        transactions=transactions,
        total_commission=total_commission,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        total_count=total_count,
    )

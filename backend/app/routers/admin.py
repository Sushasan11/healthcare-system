"""Admin router — application management for pending doctor/pharmacist approvals.

All endpoints require admin role. Responses use UserAdminOut (no PHI).

Endpoints:
  GET  /admin/applications
  POST /admin/applications/{user_id}/approve
  POST /admin/applications/{user_id}/reject
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_role
from app.db import get_db
from app.models.user import AccountStatus, User
from app.schemas.user import UserAdminOut

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_role("admin"))],
)


@router.get("/applications", response_model=list[UserAdminOut])
async def list_applications(
    db: AsyncSession = Depends(get_db),
):
    """List all users with pending_approval status."""
    result = await db.execute(
        select(User).where(User.account_status == AccountStatus.pending_approval)
    )
    users = result.scalars().all()
    return users


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
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending application — sets status to suspended."""
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
    await db.commit()
    await db.refresh(user)
    return user

"""Consultations router — CRUD for consultations, message history, and file upload.

Endpoints:
  POST   /consultations                              — create consultation
  GET    /consultations                              — list consultations (role-filtered)
  GET    /consultations/{id}                        — get consultation detail
  GET    /consultations/{id}/messages               — get message history
  POST   /consultations/{id}/end                    — doctor ends consultation
  POST   /consultations/{id}/files                  — upload file (auth-gated)
  GET    /files/consultations/{id}/{filename}       — download file (auth-gated)
"""

import os
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.responses import FileResponse

from app.core.deps import get_current_user, require_role
from app.db import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.consultation import Consultation, ConsultationStatus, Message
from app.models.user import User, UserRole
from app.schemas.consultation import (
    ConsultationCreate,
    ConsultationOut,
    FileUploadOut,
    MessageOut,
)

router = APIRouter(prefix="/consultations", tags=["consultations"])
# Separate router for auth-gated file downloads (no /consultations prefix)
files_router = APIRouter(tags=["consultations"])

# File upload configuration
UPLOAD_DIR = Path("uploads")
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif",
    ".pdf", ".doc", ".docx",
    ".txt", ".csv", ".xlsx", ".xls",
    ".zip",
}

BLOCKED_EXTENSIONS = {
    ".exe", ".sh", ".bat", ".ps1",
    ".py", ".js", ".dll", ".msi",
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _build_consultation_out(consultation: Consultation) -> ConsultationOut:
    appointment = consultation.appointment
    doctor_name = appointment.doctor.full_name if appointment and appointment.doctor else None
    patient_name = appointment.patient.full_name if appointment and appointment.patient else None
    return ConsultationOut(
        id=consultation.id,
        appointment_id=consultation.appointment_id,
        status=consultation.status.value if hasattr(consultation.status, "value") else consultation.status,
        started_at=consultation.started_at,
        ended_at=consultation.ended_at,
        doctor_name=doctor_name,
        patient_name=patient_name,
    )


async def _get_consultation_as_participant(
    consultation_id: int,
    current_user: User,
    db: AsyncSession,
) -> Consultation:
    """Load a consultation and verify the current user is a participant."""
    result = await db.execute(
        select(Consultation)
        .options(
            selectinload(Consultation.appointment).selectinload(Appointment.doctor),
            selectinload(Consultation.appointment).selectinload(Appointment.patient),
        )
        .where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    appointment = consultation.appointment
    if current_user.id not in (appointment.patient_id, appointment.doctor_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")

    return consultation


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=ConsultationOut, status_code=status.HTTP_200_OK)
async def create_consultation(
    data: ConsultationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a consultation for a confirmed appointment. Patient or doctor roles."""
    # Load appointment with relationships
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.doctor), selectinload(Appointment.patient))
        .where(Appointment.id == data.appointment_id)
    )
    appointment = result.scalar_one_or_none()

    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appointment.status != AppointmentStatus.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment is not confirmed",
        )

    # Verify user is a participant
    if current_user.id not in (appointment.patient_id, appointment.doctor_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")

    # Check no existing consultation for this appointment
    existing = await db.execute(
        select(Consultation).where(Consultation.appointment_id == data.appointment_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Consultation already exists for this appointment",
        )

    consultation = Consultation(
        appointment_id=data.appointment_id,
        status=ConsultationStatus.active,
    )
    db.add(consultation)
    await db.commit()
    await db.refresh(consultation)

    # Reload with all relationships for response building
    result = await db.execute(
        select(Consultation)
        .options(
            selectinload(Consultation.appointment).selectinload(Appointment.doctor),
            selectinload(Consultation.appointment).selectinload(Appointment.patient),
        )
        .where(Consultation.id == consultation.id)
    )
    consultation = result.scalar_one()
    return _build_consultation_out(consultation)


@router.get("", response_model=list[ConsultationOut])
async def list_consultations(
    status: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List consultations filtered by current user's role. Optional status filter."""
    query = (
        select(Consultation)
        .options(
            selectinload(Consultation.appointment).selectinload(Appointment.doctor),
            selectinload(Consultation.appointment).selectinload(Appointment.patient),
        )
        .join(Consultation.appointment)
    )

    if current_user.role == UserRole.doctor:
        query = query.where(Appointment.doctor_id == current_user.id)
    elif current_user.role == UserRole.patient:
        query = query.where(Appointment.patient_id == current_user.id)

    if status:
        query = query.where(Consultation.status == status)

    result = await db.execute(query)
    consultations = result.scalars().all()
    return [_build_consultation_out(c) for c in consultations]


@router.get("/{consultation_id}", response_model=ConsultationOut)
async def get_consultation(
    consultation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get consultation detail. Only participants can access."""
    consultation = await _get_consultation_as_participant(consultation_id, current_user, db)
    return _build_consultation_out(consultation)


@router.get("/{consultation_id}/messages", response_model=list[MessageOut])
async def get_consultation_messages(
    consultation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get message history for a consultation. Only participants can access."""
    # Verify participation
    await _get_consultation_as_participant(consultation_id, current_user, db)

    result = await db.execute(
        select(Message)
        .where(Message.consultation_id == consultation_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        MessageOut(
            id=m.id,
            consultation_id=m.consultation_id,
            sender_id=m.sender_id,
            content=m.content,
            file_url=m.file_url,
            file_name=m.file_name,
            created_at=m.created_at,
            delivered_at=m.delivered_at,
            read_at=m.read_at,
        )
        for m in messages
    ]


@router.post("/{consultation_id}/end", response_model=ConsultationOut)
async def end_consultation(
    consultation_id: int,
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    """End a consultation. Doctor only."""
    from datetime import datetime, timezone

    consultation = await _get_consultation_as_participant(consultation_id, current_user, db)

    consultation.status = ConsultationStatus.completed
    consultation.ended_at = datetime.now(timezone.utc)

    # Also mark appointment as completed
    appointment = consultation.appointment
    appointment.status = AppointmentStatus.completed

    await db.commit()
    await db.refresh(consultation)

    # Reload with relationships for response
    result = await db.execute(
        select(Consultation)
        .options(
            selectinload(Consultation.appointment).selectinload(Appointment.doctor),
            selectinload(Consultation.appointment).selectinload(Appointment.patient),
        )
        .where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one()
    return _build_consultation_out(consultation)


@router.post("/{consultation_id}/files", response_model=FileUploadOut)
async def upload_file(
    consultation_id: int,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file to a consultation. Validates extension and size. Auth-gated."""
    # Verify participation
    await _get_consultation_as_participant(consultation_id, current_user, db)

    # Validate extension
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()

    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed: {ext}",
        )

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed: {ext}",
        )

    # Validate size by reading content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 25MB limit",
        )

    # Save file
    save_dir = UPLOAD_DIR / "consultations" / str(consultation_id)
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / filename

    async with aiofiles.open(save_path, "wb") as f:
        await f.write(content)

    url = f"/files/consultations/{consultation_id}/{filename}"
    return FileUploadOut(url=url, file_name=filename)


@files_router.get("/files/consultations/{consultation_id}/{filename}")
async def download_file(
    consultation_id: int,
    filename: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve a consultation file. Auth-gated — PHI content must not be public."""
    # Verify participation
    await _get_consultation_as_participant(consultation_id, current_user, db)

    file_path = UPLOAD_DIR / "consultations" / str(consultation_id) / filename
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(path=str(file_path), filename=filename)

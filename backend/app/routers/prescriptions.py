"""Prescriptions router — create, list, detail, PDF download.

Endpoints:
  POST   /prescriptions                 — doctor creates prescription (PRSC-01)
  GET    /prescriptions                 — list prescriptions (role-filtered) (PRSC-02)
  GET    /prescriptions/{id}            — get prescription detail (PRSC-02)
  GET    /prescriptions/{id}/pdf        — download prescription PDF (PRSC-02)
"""
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.responses import StreamingResponse

from app.core.deps import get_current_user, require_role
from app.core.hmac_utils import compute_prescription_hmac
from app.db import get_db
from app.models.appointment import Appointment
from app.models.consultation import Consultation, ConsultationStatus
from app.models.notification import Notification, NotificationType
from app.models.prescription import Prescription, PrescriptionItem, PrescriptionStatus
from app.models.user import User, UserRole
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionDetailOut,
    PrescriptionMetaOut,
    PrescriptionOut,
)
from app.services.pdf_service import generate_prescription_pdf

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])

GRACE_PERIOD_MINUTES = 30


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


async def _get_prescription_with_access(
    prescription_id: int, current_user: User, db: AsyncSession
) -> tuple[Prescription, str]:
    """Load prescription and check access. Returns (prescription, 'full'|'meta')."""
    result = await db.execute(
        select(Prescription)
        .options(
            selectinload(Prescription.items),
            selectinload(Prescription.doctor),
            selectinload(Prescription.patient),
        )
        .where(Prescription.id == prescription_id)
    )
    prescription = result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    if current_user.role == UserRole.admin:
        return prescription, "meta"
    if current_user.id not in (prescription.doctor_id, prescription.patient_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return prescription, "full"


def _is_prescribable(consultation: Consultation) -> bool:
    """Return True if the consultation allows a new prescription."""
    if consultation.status == ConsultationStatus.active:
        return True
    if consultation.status == ConsultationStatus.completed and consultation.ended_at:
        ended_utc = (
            consultation.ended_at.replace(tzinfo=timezone.utc)
            if consultation.ended_at.tzinfo is None
            else consultation.ended_at
        )
        elapsed = (datetime.now(timezone.utc) - ended_utc).total_seconds()
        return elapsed <= GRACE_PERIOD_MINUTES * 60
    return False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=PrescriptionOut, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    data: PrescriptionCreate,
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    """Create a prescription for an active consultation or within the grace period."""
    # Load consultation with appointment
    result = await db.execute(
        select(Consultation)
        .options(
            selectinload(Consultation.appointment).selectinload(Appointment.patient),
            selectinload(Consultation.appointment).selectinload(Appointment.doctor),
        )
        .where(Consultation.id == data.consultation_id)
    )
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Consultation not found")

    # Verify current user is the doctor for this consultation
    if consultation.appointment.doctor_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your consultation")

    # Check prescribable state
    if not _is_prescribable(consultation):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Consultation is not in a prescribable state",
        )

    # Auto-reopen if completed but within grace period
    if consultation.status == ConsultationStatus.completed:
        consultation.status = ConsultationStatus.active
        consultation.ended_at = None

    # Compute HMAC
    issued_at = datetime.now(timezone.utc)
    items_dicts = [
        {
            "medicine_name": i.medicine_name,
            "dosage_amount": i.dosage_amount,
            "dosage_unit": i.dosage_unit,
            "frequency": i.frequency,
            "duration": i.duration,
        }
        for i in data.items
    ]
    hmac_token = compute_prescription_hmac(
        current_user.id,
        consultation.appointment.patient_id,
        consultation.id,
        data.diagnosis,
        items_dicts,
        issued_at.isoformat(),
    )

    # Create prescription
    prescription = Prescription(
        consultation_id=consultation.id,
        doctor_id=current_user.id,
        patient_id=consultation.appointment.patient_id,
        diagnosis=data.diagnosis,
        hmac_token=hmac_token,
        issued_at=issued_at,
    )
    db.add(prescription)
    await db.flush()

    # Create prescription items
    for item in data.items:
        item_obj = PrescriptionItem(
            prescription_id=prescription.id,
            medicine_name=item.medicine_name,
            dosage_amount=item.dosage_amount,
            dosage_unit=item.dosage_unit,
            frequency=item.frequency,
            duration=item.duration,
            instructions=item.instructions,
        )
        db.add(item_obj)

    # Notify patient
    notif = Notification(
        user_id=consultation.appointment.patient_id,
        type=NotificationType.prescription_issued,
        title="New Prescription",
        body=f"Dr. {current_user.full_name} has issued a prescription for you.",
        link=f"/patient/prescriptions/{prescription.id}",
    )
    db.add(notif)

    await db.commit()
    await db.refresh(prescription)

    # Load patient for response
    patient_result = await db.execute(
        select(User).where(User.id == prescription.patient_id)
    )
    patient = patient_result.scalar_one_or_none()

    return PrescriptionOut(
        id=prescription.id,
        consultation_id=prescription.consultation_id,
        doctor_id=prescription.doctor_id,
        patient_id=prescription.patient_id,
        status=prescription.status.value,
        issued_at=prescription.issued_at,
        doctor_name=current_user.full_name,
        patient_name=patient.full_name if patient else None,
        diagnosis_snippet=prescription.diagnosis[:80] if prescription.diagnosis else None,
        item_count=len(data.items),
    )


@router.get("", response_model=list[PrescriptionOut])
async def list_prescriptions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List prescriptions filtered by the current user's role."""
    query = select(Prescription).options(
        selectinload(Prescription.items),
        selectinload(Prescription.doctor),
        selectinload(Prescription.patient),
    )

    if current_user.role == UserRole.patient:
        query = query.where(Prescription.patient_id == current_user.id)
    elif current_user.role == UserRole.doctor:
        query = query.where(Prescription.doctor_id == current_user.id)
    elif current_user.role == UserRole.admin:
        pass  # admin sees all
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    query = query.order_by(Prescription.issued_at.desc())
    result = await db.execute(query)
    prescriptions = result.scalars().all()

    return [
        PrescriptionOut(
            id=p.id,
            consultation_id=p.consultation_id,
            doctor_id=p.doctor_id,
            patient_id=p.patient_id,
            status=p.status.value,
            issued_at=p.issued_at,
            doctor_name=p.doctor.full_name if p.doctor else None,
            patient_name=p.patient.full_name if p.patient else None,
            diagnosis_snippet=p.diagnosis[:80] if p.diagnosis else None,
            item_count=len(p.items),
        )
        for p in prescriptions
    ]


@router.get("/{prescription_id}", response_model=PrescriptionDetailOut | PrescriptionMetaOut)
async def get_prescription(
    prescription_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get prescription detail. Admins get metadata only; participants get full detail."""
    prescription, access_level = await _get_prescription_with_access(
        prescription_id, current_user, db
    )

    if access_level == "meta":
        return PrescriptionMetaOut(
            id=prescription.id,
            consultation_id=prescription.consultation_id,
            doctor_id=prescription.doctor_id,
            patient_id=prescription.patient_id,
            status=prescription.status.value,
            issued_at=prescription.issued_at,
            doctor_name=prescription.doctor.full_name if prescription.doctor else None,
            patient_name=prescription.patient.full_name if prescription.patient else None,
            item_count=len(prescription.items),
        )

    # Full detail for doctor/patient
    return PrescriptionDetailOut(
        id=prescription.id,
        consultation_id=prescription.consultation_id,
        doctor_id=prescription.doctor_id,
        patient_id=prescription.patient_id,
        diagnosis=prescription.diagnosis,
        status=prescription.status.value,
        issued_at=prescription.issued_at,
        doctor_name=prescription.doctor.full_name if prescription.doctor else None,
        doctor_specialty=getattr(prescription.doctor, "specialty", None),
        doctor_license=getattr(prescription.doctor, "medical_license_number", None),
        patient_name=prescription.patient.full_name if prescription.patient else None,
        items=[
            {
                "id": item.id,
                "medicine_name": item.medicine_name,
                "dosage_amount": item.dosage_amount,
                "dosage_unit": item.dosage_unit,
                "frequency": item.frequency,
                "duration": item.duration,
                "instructions": item.instructions,
            }
            for item in prescription.items
        ],
    )


@router.get("/{prescription_id}/pdf")
async def download_prescription_pdf(
    prescription_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download prescription as PDF. Participants only — admin is blocked."""
    prescription, access_level = await _get_prescription_with_access(
        prescription_id, current_user, db
    )

    if access_level == "meta":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "PDF download not available for admin"
        )

    data = {
        "id": prescription.id,
        "issued_at": prescription.issued_at.strftime("%d %b %Y"),
        "status": prescription.status.value.capitalize(),
        "doctor_name": prescription.doctor.full_name if prescription.doctor else "",
        "doctor_specialty": getattr(prescription.doctor, "specialty", None) or "",
        "doctor_license": getattr(prescription.doctor, "medical_license_number", None) or "",
        "patient_name": prescription.patient.full_name if prescription.patient else "",
        "diagnosis": prescription.diagnosis,
        "items": [
            {
                "medicine_name": item.medicine_name,
                "dosage_amount": item.dosage_amount,
                "dosage_unit": item.dosage_unit,
                "frequency": item.frequency,
                "duration": item.duration,
                "instructions": item.instructions,
            }
            for item in prescription.items
        ],
    }

    pdf_bytes = generate_prescription_pdf(data)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=prescription_{prescription.id}.pdf"
        },
    )

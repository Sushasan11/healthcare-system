from datetime import datetime
from pydantic import BaseModel, field_validator


class PrescriptionItemCreate(BaseModel):
    medicine_name: str
    dosage_amount: str
    dosage_unit: str
    frequency: str
    duration: str
    instructions: str | None = None


class PrescriptionCreate(BaseModel):
    consultation_id: int
    diagnosis: str
    items: list[PrescriptionItemCreate]

    @field_validator("diagnosis")
    @classmethod
    def diagnosis_min_length(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("Diagnosis must be at least 10 characters")
        return v.strip()

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v: list) -> list:
        if len(v) == 0:
            raise ValueError("At least one medicine item is required")
        return v


class PrescriptionItemOut(BaseModel):
    id: int
    medicine_name: str
    dosage_amount: str
    dosage_unit: str
    frequency: str
    duration: str
    instructions: str | None = None
    model_config = {"from_attributes": True}


class PrescriptionOut(BaseModel):
    """List view — includes diagnosis snippet and item count, not full items."""

    id: int
    consultation_id: int
    doctor_id: int
    patient_id: int
    status: str
    issued_at: datetime
    doctor_name: str | None = None
    patient_name: str | None = None
    diagnosis_snippet: str | None = None
    item_count: int = 0
    model_config = {"from_attributes": True}


class PrescriptionDetailOut(BaseModel):
    """Full detail — includes all items, full diagnosis, doctor info. For doctor/patient only."""

    id: int
    consultation_id: int
    doctor_id: int
    patient_id: int
    diagnosis: str
    status: str
    issued_at: datetime
    doctor_name: str | None = None
    doctor_specialty: str | None = None
    doctor_license: str | None = None
    patient_name: str | None = None
    items: list[PrescriptionItemOut] = []
    model_config = {"from_attributes": True}


class PrescriptionMetaOut(BaseModel):
    """Metadata only — for admin. No diagnosis text, no items."""

    id: int
    consultation_id: int
    doctor_id: int
    patient_id: int
    status: str
    issued_at: datetime
    doctor_name: str | None = None
    patient_name: str | None = None
    item_count: int = 0
    model_config = {"from_attributes": True}


class DrugOut(BaseModel):
    id: int
    name: str
    generic_name: str | None = None
    form: str | None = None
    model_config = {"from_attributes": True}

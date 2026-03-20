from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SlotOut(BaseModel):
    slot_datetime: datetime
    is_available: bool


class SlotHoldRequest(BaseModel):
    doctor_id: int
    slot_datetime: datetime


class SlotHoldResponse(BaseModel):
    held_until: datetime


class AppointmentCreate(BaseModel):
    doctor_id: int
    slot_datetime: datetime
    reason_for_visit: str | None = None


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    doctor_id: int
    slot_datetime: datetime
    status: str
    reason_for_visit: str | None
    created_at: datetime
    doctor_name: str | None = None
    patient_name: str | None = None

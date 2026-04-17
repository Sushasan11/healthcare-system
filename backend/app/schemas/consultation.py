from datetime import datetime
from pydantic import BaseModel
from typing import Literal


# --- REST schemas ---
class ConsultationCreate(BaseModel):
    appointment_id: int


class ConsultationOut(BaseModel):
    id: int
    appointment_id: int
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    doctor_name: str | None = None
    patient_name: str | None = None
    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: int
    consultation_id: int
    sender_id: int
    content: str | None = None
    file_url: str | None = None
    file_name: str | None = None
    created_at: datetime
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    model_config = {"from_attributes": True}


class FileUploadOut(BaseModel):
    url: str
    file_name: str


# --- WebSocket envelope types (discriminated union on "type" field) ---
# These are documented as Python dicts for the server-side handler.
# Frontend TypeScript equivalents will be created in Plan 03.

WS_MESSAGE_TYPES = Literal[
    "chat_message",
    "message_delivered",
    "message_read",
    "typing_start",
    "typing_stop",
    "presence",
    "call_offer",
    "call_answer",
    "ice_candidate",
    "call_initiated",
    "call_accepted",
    "call_declined",
    "call_ended",
    "consultation_ended",
    "error",
]

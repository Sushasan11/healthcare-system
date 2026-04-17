from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    account_status: str
    created_at: datetime


class UserAdminOut(BaseModel):
    """Safe schema for admin use — explicitly excludes all PHI fields.

    Admin can see: name, email, role, account status, registration date.
    NO phone, NO address, NO medical data.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    account_status: str
    created_at: datetime


class PatientProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date_of_birth: object | None = None
    gender: str | None = None
    blood_type: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    allergies: str | None = None
    current_medications: str | None = None
    chronic_conditions: str | None = None

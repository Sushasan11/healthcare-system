from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserAdminPaginatedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    users: list  # list of UserAdminOut dicts
    total: int


class DoctorProfileSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    specialty: str | None = None
    qualifications: str | None = None
    bio: str | None = None


class ApplicationAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str
    role: str
    account_status: str
    created_at: datetime
    doctor_profile: DoctorProfileSummary | None = None


class RejectApplicationRequest(BaseModel):
    rejection_reason: str | None = None


class AdminStatsOut(BaseModel):
    total_users: int
    by_role: dict[str, int]
    pending_applications: int
    commission_rate: float


class CommissionIn(BaseModel):
    commission_rate: float


class CommissionOut(BaseModel):
    commission_rate: float

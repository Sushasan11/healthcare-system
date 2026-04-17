from pydantic import BaseModel, ConfigDict, field_validator


class DoctorAvailabilityIn(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    is_active: bool = True

    @field_validator("day_of_week")
    @classmethod
    def validate_day_of_week(cls, v: int) -> int:
        if not (0 <= v <= 6):
            raise ValueError("day_of_week must be between 0 (Mon) and 6 (Sun)")
        return v

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        import re
        if not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError("Time must be in HH:MM format")
        return v


class DoctorAvailabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    day_of_week: int
    start_time: str
    end_time: str
    is_active: bool


class DoctorProfileUpdate(BaseModel):
    bio: str | None = None
    qualifications: str | None = None
    consultation_fee: float | None = None
    avatar_url: str | None = None


class DoctorProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    bio: str | None
    qualifications: str | None
    consultation_fee: float | None
    avatar_url: str | None
    rating: float | None
    review_count: int


class DoctorListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    specialty: str | None
    years_of_experience: int | None
    profile: DoctorProfileOut | None = None


class DoctorDetailOut(DoctorListItem):
    availability: list[DoctorAvailabilityOut] = []

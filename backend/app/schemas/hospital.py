from datetime import date, time, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class HospitalVisitCreateRequest(BaseModel):
    senior_id: UUID
    hospital_name: str
    visit_date: date
    visit_time: time
    memo: Optional[str] = None
    is_active: bool = True


class HospitalVisitUpdateRequest(BaseModel):
    hospital_name: Optional[str] = None
    visit_date: Optional[date] = None
    visit_time: Optional[time] = None
    memo: Optional[str] = None
    is_active: Optional[bool] = None


class HospitalVisitResponse(BaseModel):
    visit_id: UUID
    senior_id: UUID
    guardian_id: UUID
    hospital_name: str
    visit_date: date
    visit_time: time
    memo: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

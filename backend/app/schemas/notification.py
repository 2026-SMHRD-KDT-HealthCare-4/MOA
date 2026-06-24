"""
복약(MEDICATION, MEDICATION_CHECK) / 알림(NOTIFICATION) 관련 요청·응답 스키마
"""

from datetime import date, datetime, time
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


# ---------- 복약정보 (MEDICATION) ----------

class MedicationCreateRequest(BaseModel):
    senior_id: UUID
    guardian_id: UUID  # 등록 주체(보호자)
    medicine_name: str
    intake_time: time
    start_date: date
    end_date: Optional[date] = None  # None이면 무기한
    is_active: bool = True


class MedicationUpdateRequest(BaseModel):
    medicine_name: Optional[str] = None
    intake_time: Optional[time] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class MedicationResponse(BaseModel):
    medication_id: UUID
    senior_id: UUID
    guardian_id: UUID
    medicine_name: str
    intake_time: time
    start_date: date
    end_date: Optional[date]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- 복약 체크리스트 (MEDICATION_CHECK) ----------

class MedicationCheckRequest(BaseModel):
    medication_id: UUID
    senior_id: UUID
    check_date: Optional[date] = None  # 미지정 시 오늘
    is_completed: bool = True


class MedicationCheckResponse(BaseModel):
    check_id: UUID
    medication_id: UUID
    senior_id: UUID
    check_date: date
    is_completed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- 알림 (NOTIFICATION) ----------

NotificationTypeLiteral = Literal["RISK", "MEDICATION", "HOSPITAL", "INACTIVE"]
NotificationStatusLiteral = Literal["SENT", "FAILED", "READ"]


class NotificationCreateRequest(BaseModel):
    guardian_id: UUID
    senior_id: UUID
    notification_type: NotificationTypeLiteral
    prediction_id: Optional[UUID] = None   # RISK일 때만
    medication_id: Optional[UUID] = None    # MEDICATION일 때만
    status: NotificationStatusLiteral = "SENT"


class NotificationResponse(BaseModel):
    notification_id: UUID
    guardian_id: UUID
    senior_id: UUID
    notification_type: NotificationTypeLiteral
    prediction_id: Optional[UUID]
    medication_id: Optional[UUID]
    status: NotificationStatusLiteral
    sent_at: datetime

    class Config:
        from_attributes = True


MedicationReminderStatusLiteral = Literal["PENDING", "REMINDER_SCHEDULED", "COMPLETED"]


class MedicationReminderReplyRequest(BaseModel):
    answer: str


class MedicationReminderResponse(BaseModel):
    reminder_id: UUID
    medication_id: UUID
    medicine_name: str
    scheduled_for: datetime
    status: MedicationReminderStatusLiteral
    reminder_count: int
    retry_at: Optional[datetime]
    completed_at: Optional[datetime]
    needs_attention: bool


class MedicationReminderReplyResponse(MedicationReminderResponse):
    reply: str

"""
인증/회원가입 관련 요청 및 응답 스키마
"""

from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ---------- 공통 ----------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponseData(BaseModel):
    access_token: str
    refresh_token: str
    role: Literal["guardian", "senior"]
    name: str


# ---------- 보호자 ----------

class GuardianRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    birth_date: date
    gender: Optional[Literal["M", "F"]] = None
    phone: str
    biometric_consent_yn: bool = False


class GuardianResponse(BaseModel):
    guardian_id: UUID
    email: EmailStr
    name: str
    birth_date: date
    gender: Optional[str]
    phone: str
    biometric_consent_yn: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- 고령층 (초대코드 기반 가입) ----------

class SeniorRegisterRequest(BaseModel):
    invite_token: str  # 'XXX-XXX' 형태의 6자리(+하이픈) 초대 코드. 예: MOA-DEV
    email: EmailStr
    password: str = Field(min_length=8)
    name: str
    birth_date: date
    gender: Optional[Literal["M", "F"]] = None
    phone: str
    smoking_yn: Optional[bool] = None
    bmi: Optional[float] = None
    medical_history: Optional[str] = None
    biometric_consent_yn: bool = False


class SeniorResponse(BaseModel):
    senior_id: UUID
    email: EmailStr
    name: str
    birth_date: date
    gender: Optional[str]
    phone: str
    biometric_consent_yn: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- 초대코드 ----------

class InviteCreateResponse(BaseModel):
    token: str  # 'XXX-XXX' 형태의 6자리(+하이픈) 초대 코드. 예: MOA-DEV
    expired_at: datetime


class InviteVerifyResponse(BaseModel):
    valid: bool
    reason: Optional[Literal["EXPIRED", "USED", "NOT_FOUND"]] = None
    guardian_name: Optional[str] = None


class InviteListItemResponse(BaseModel):
    """보호자가 발급한 초대 토큰 1건. (B-3: '연결 대기 카드'는 is_used=False 이면서
    아직 만료되지 않은 항목을 기준으로 FE에서 표시한다.)"""
    token: str
    created_at: datetime
    expired_at: datetime
    is_used: bool

    class Config:
        from_attributes = True


# ---------- 보호자-고령층 연동 ----------

class GuardianSeniorResponse(BaseModel):
    link_id: UUID
    guardian_id: UUID
    senior_id: UUID
    senior_name: Optional[str] = None
    link_status: Literal["PENDING", "ACTIVE", "REVOKED"]
    linked_at: Optional[datetime]

    class Config:
        from_attributes = True


class LinkStatusUpdateRequest(BaseModel):
    link_status: Literal["ACTIVE", "REVOKED"]


# ---------- /auth/me ----------

class MeResponse(BaseModel):
    role: Literal["guardian", "senior"]
    name: str
    user_id: UUID

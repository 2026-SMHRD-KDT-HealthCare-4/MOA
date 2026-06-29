"""
인증/회원가입 관련 요청 및 응답 스키마
"""

from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# ---------- 공통 ----------

class MeResponse(BaseModel):
    role: Literal["guardian", "senior"]
    name: str
    user_id: UUID
    fcm_token: Optional[str] = None


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


# ---------- 고령층 (초대링크 기반 가입) ----------

class SeniorRegisterRequest(BaseModel):
    invite_token: str = Field(min_length=7, max_length=7)
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


class SeniorClaimRequest(BaseModel):
    invite_token: str = Field(min_length=7, max_length=7)
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


# ---------- 초대링크 ----------

class InviteCreateRequest(BaseModel):
    senior_name: Optional[str] = None  # 보호자가 부르는 호칭 ("엄마") — 생략 가능


class InviteCreateResponse(BaseModel):
    token: str
    senior_name: Optional[str] = None
    expired_at: datetime


class InviteVerifyResponse(BaseModel):
    valid: bool
    reason: Optional[Literal["EXPIRED", "USED", "NOT_FOUND"]] = None
    guardian_name: Optional[str] = None


class InviteListItemResponse(BaseModel):
    token: str
    senior_name: Optional[str] = None
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


# ---------- 고령층 재연결 ----------

class ReconnectCodeResponse(BaseModel):
    code: str
    expired_at: datetime


class ReconnectRequest(BaseModel):
    code: str


class ReconnectResponse(BaseModel):
    access_token: str
    refresh_token: str
    role: str
    name: str


# ---------- 공동보호자 ----------

class FamilyGroupResponse(BaseModel):
    family_group_id: UUID
    name: str
    created_by_guardian_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GuardianMemberResponse(BaseModel):
    guardian_member_id: UUID
    family_group_id: UUID
    guardian_id: Optional[UUID] = None
    guardian_name: str
    member_role: str
    status: str
    invited_by_guardian_id: Optional[UUID] = None
    invite_code: Optional[str] = None
    invite_expires_at: Optional[datetime] = None
    joined_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InviteMemberRequest(BaseModel):
    guardian_name: str


class AcceptMemberRequest(BaseModel):
    invite_code: str


class AcceptMemberResponse(BaseModel):
    family_group: FamilyGroupResponse
    guardian_member: GuardianMemberResponse


class FamilyStateResponse(BaseModel):
    family_group: FamilyGroupResponse
    guardian_members: list[GuardianMemberResponse]
    links: list[GuardianSeniorResponse]


# ---------- FCM 토큰 등록 ----------

class FCMTokenRegisterRequest(BaseModel):
    fcm_token: Optional[str] = None


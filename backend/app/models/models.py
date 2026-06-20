"""
SQLAlchemy ORM 모델
※ 인증은 Supabase Auth(auth.users)가 전담하므로, 여기서는 password 컬럼을 두지 않는다.
   GUARDIAN.guardian_id / SENIOR.senior_id 는 Supabase auth.users.id(UUID)와 동일한 값을 사용한다.
"""

import enum
import random
import string
import uuid
from datetime import datetime


_INVITE_CHARS = string.ascii_uppercase + string.digits


def _generate_invite_code() -> str:
    """XXX-XXX 형식의 초대 코드를 생성한다. (A-Z, 0-9 각 3자리씩)"""
    part = lambda: "".join(random.choices(_INVITE_CHARS, k=3))
    return f"{part()}-{part()}"


from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base

# PostgreSQL에서는 JSONB, 그 외(테스트용 SQLite 등)에서는 JSON으로 동작하도록 variant 처리
JSONB_OR_JSON = JSONB().with_variant(JSON(), "sqlite")


class LinkStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


class Guardian(Base):
    """회원_보호자 (GUARDIAN) — 요구사항 1, 2번"""
    __tablename__ = "guardian"

    guardian_id = Column(UUID(as_uuid=True), primary_key=True)  # Supabase auth.users.id
    email = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(50), nullable=False)
    birth_date = Column(DateTime, nullable=False)
    gender = Column(String(1), nullable=True)
    phone = Column(String(20), nullable=False)
    fcm_token = Column(String(255), nullable=True)

    biometric_consent_yn = Column(Boolean, nullable=False, default=False)
    consent_at = Column(DateTime, nullable=True)

    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("gender IN ('M', 'F')", name="ck_guardian_gender"),
    )

    invites = relationship("Invite", back_populates="guardian")
    links = relationship("GuardianSenior", back_populates="guardian")


class Senior(Base):
    """회원_고령층 (SENIOR) — 요구사항 1, 2번"""
    __tablename__ = "senior"

    senior_id = Column(UUID(as_uuid=True), primary_key=True)  # Supabase auth.users.id
    email = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(50), nullable=False)
    birth_date = Column(DateTime, nullable=False)
    gender = Column(String(1), nullable=True)
    phone = Column(String(20), nullable=False)
    fcm_token = Column(String(255), nullable=True)

    smoking_yn = Column(Boolean, nullable=True)
    bmi = Column(Numeric(5, 2), nullable=True)  # 당뇨 모델 입력값
    medical_history = Column(String, nullable=True)

    biometric_consent_yn = Column(Boolean, nullable=False, default=False)
    consent_at = Column(DateTime, nullable=True)

    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("gender IN ('M', 'F')", name="ck_senior_gender"),
    )

    links = relationship("GuardianSenior", back_populates="senior")
    script_records = relationship("ScriptRecord", back_populates="senior")
    voice_features = relationship("VoiceFeature", back_populates="senior")
    risk_predictions = relationship("RiskPrediction", back_populates="senior")


class GuardianSenior(Base):
    """보호자_고령층 (GUARDIAN_SENIOR) — 요구사항 4번, 다대다 연동"""
    __tablename__ = "guardian_senior"

    link_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    guardian_id = Column(UUID(as_uuid=True), ForeignKey("guardian.guardian_id"), nullable=False)
    senior_id = Column(UUID(as_uuid=True), ForeignKey("senior.senior_id"), nullable=False)
    link_status = Column(String(10), nullable=False, default=LinkStatus.PENDING.value)
    linked_at = Column(DateTime, nullable=True)  # ACTIVE 전환 시점

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "link_status IN ('PENDING','ACTIVE','REVOKED')", name="ck_guardian_senior_status"
        ),
        UniqueConstraint("guardian_id", "senior_id", name="uq_guardian_senior"),
    )

    guardian = relationship("Guardian", back_populates="links")
    senior = relationship("Senior", back_populates="links")


class Invite(Base):
    """초대링크 (INVITE) — 요구사항 3, 17번"""
    __tablename__ = "invite"

    token = Column(String(7), primary_key=True, default=_generate_invite_code)
    guardian_id = Column(UUID(as_uuid=True), ForeignKey("guardian.guardian_id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expired_at = Column(DateTime, nullable=False)  # 생성 + 72시간
    is_used = Column(Boolean, nullable=False, default=False)

    guardian = relationship("Guardian", back_populates="invites")


class CollectType(str, enum.Enum):
    SCRIPT = "SCRIPT"
    CHATBOT = "CHATBOT"


class RiskLevel(str, enum.Enum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    AMBER = "AMBER"


class Script(Base):
    """지정문구 (SCRIPT) — 요구사항 5번. 고령층이 매일 낭독하는 문구 원본."""
    __tablename__ = "script"

    script_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content = Column(String(500), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    records = relationship("ScriptRecord", back_populates="script")


class ScriptRecord(Base):
    """지정문구_녹음_기록 (SCRIPT_RECORD) — 요구사항 5번. 원본 음성은 저장하지 않음."""
    __tablename__ = "script_record"

    record_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    senior_id = Column(UUID(as_uuid=True), ForeignKey("senior.senior_id"), nullable=False)
    script_id = Column(UUID(as_uuid=True), ForeignKey("script.script_id"), nullable=False)
    measured_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    senior = relationship("Senior", back_populates="script_records")
    script = relationship("Script", back_populates="records")


class VoiceFeature(Base):
    """음성분석결과 (VOICE_FEATURE) — 요구사항 7, 8번.
    지정문구 낭독 / 챗봇 대화 두 경로에서 추출된 음향 바이오마커 특징 벡터를 통합 저장.
    원시 음성(WAV)은 어떠한 테이블에도 저장하지 않는다 (ZDR 원칙).
    """
    __tablename__ = "voice_feature"

    feature_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    senior_id = Column(UUID(as_uuid=True), ForeignKey("senior.senior_id"), nullable=False)
    collect_type = Column(String(10), nullable=False)
    voice_features = Column(JSONB_OR_JSON, nullable=False)  # F0, Jitter, Shimmer, MPT, HNR, VSA 등
    measured_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("collect_type IN ('SCRIPT','CHATBOT')", name="ck_voice_feature_collect_type"),
    )

    senior = relationship("Senior", back_populates="voice_features")


class RiskPrediction(Base):
    """질환별_위험도_예측결과 (RISK_PREDICTION) — 요구사항 9번.
    음성분석결과를 입력으로 AI 모델이 추론한 4개 질환(파킨슨/치매/우울/당뇨)의
    위험도(확률값)와 등급을 컬럼 단위로 저장한다.
    """
    __tablename__ = "risk_prediction"

    prediction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    senior_id = Column(UUID(as_uuid=True), ForeignKey("senior.senior_id"), nullable=False)

    parkinson_score = Column(Numeric(4, 3), nullable=False)
    dementia_score = Column(Numeric(4, 3), nullable=False)
    depression_score = Column(Numeric(4, 3), nullable=False)
    diabetes_score = Column(Numeric(4, 3), nullable=False)

    parkinson_level = Column(String(10), nullable=False)
    dementia_level = Column(String(10), nullable=False)
    depression_level = Column(String(10), nullable=False)
    diabetes_level = Column(String(10), nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint("parkinson_score BETWEEN 0 AND 1", name="ck_risk_parkinson_score"),
        CheckConstraint("dementia_score BETWEEN 0 AND 1", name="ck_risk_dementia_score"),
        CheckConstraint("depression_score BETWEEN 0 AND 1", name="ck_risk_depression_score"),
        CheckConstraint("diabetes_score BETWEEN 0 AND 1", name="ck_risk_diabetes_score"),
        CheckConstraint("parkinson_level IN ('GREEN','YELLOW','AMBER')", name="ck_risk_parkinson_level"),
        CheckConstraint("dementia_level IN ('GREEN','YELLOW','AMBER')", name="ck_risk_dementia_level"),
        CheckConstraint("depression_level IN ('GREEN','YELLOW','AMBER')", name="ck_risk_depression_level"),
        CheckConstraint("diabetes_level IN ('GREEN','YELLOW','AMBER')", name="ck_risk_diabetes_level"),
    )

    senior = relationship("Senior", back_populates="risk_predictions")


class ChatSession(Base):
    """챗봇_대화_세션 (CHAT_SESSION) — 요구사항 6, 13, 14번.

    AI 챗봇 안부 대화 세션. messages(JSONB)에 [{"user": 0|1, "content": str, "time": str}, ...]
    형태로 발화자/발화내용/발화시각을 함께 기록한다. (user=0: 고령층, user=1: 봇)

    설계서상 "물리적으로 분리된 chatbot_db" 요구가 있으나, 현재는 동일 DB에 테이블만
    생성하고 애플리케이션 레이어에서 VOICE_FEATURE와의 JOIN을 금지하는 방식(논리적 분리)으로
    진행한다. senior_id에 FK 제약을 걸지 않은 것도 이 설계서 SQL 그대로를 따른 것으로,
    추후 실제로 물리 DB를 분리할 때 FK 제약이 없어야 그대로 이전이 가능하다.

    ⚠️ JOIN 금지 규칙: 이 테이블과 VOICE_FEATURE / RISK_PREDICTION 을 senior_id 기준으로
    직접 JOIN하는 쿼리를 작성하지 않는다. 두 데이터가 필요하면 각각 별도 쿼리로 조회한 뒤
    애플리케이션 코드에서 병합한다.
    """
    __tablename__ = "chat_session"

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    senior_id = Column(UUID(as_uuid=True), nullable=False)  # 의도적으로 FK 미설정 (물리 분리 대비)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    messages = Column(JSONB_OR_JSON, nullable=False, default=list)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class NotificationType(str, enum.Enum):
    RISK = "RISK"             # 이상 징후 알림
    MEDICATION = "MEDICATION" # 복약 리마인더
    HOSPITAL = "HOSPITAL"     # 병원 방문 리마인더
    INACTIVE = "INACTIVE"     # 미접속 리마인더


class NotificationStatus(str, enum.Enum):
    SENT = "SENT"       # 전송완료
    FAILED = "FAILED"   # 전송실패
    READ = "READ"       # 보호자 확인


class Medication(Base):
    """복약정보 (MEDICATION) — 요구사항 12번.
    보호자가 등록한 고령층의 복약 일정을 관리한다.
    """
    __tablename__ = "medication"

    medication_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    senior_id = Column(UUID(as_uuid=True), ForeignKey("senior.senior_id"), nullable=False)
    guardian_id = Column(UUID(as_uuid=True), ForeignKey("guardian.guardian_id"), nullable=False)  # 등록한 보호자
    medicine_name = Column(String(100), nullable=False)
    intake_time = Column(Time, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # NULL이면 무기한
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    senior = relationship("Senior", backref="medications")
    guardian = relationship("Guardian", backref="medications")
    checks = relationship("MedicationCheck", back_populates="medication")


class MedicationCheck(Base):
    """복약 체크리스트 (MEDICATION_CHECK) — 요구사항 12번.
    고령층의 일별 복약 이행 여부를 기록한다.
    """
    __tablename__ = "medication_check"

    check_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("medication.medication_id"), nullable=False)
    senior_id = Column(UUID(as_uuid=True), ForeignKey("senior.senior_id"), nullable=False)
    check_date = Column(Date, nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("medication_id", "check_date", name="uq_medication_check_date"),
    )

    medication = relationship("Medication", back_populates="checks")
    senior = relationship("Senior", backref="medication_checks")


class Notification(Base):
    """알림 (NOTIFICATION) — 요구사항 10, 11번.
    이상 징후 알림(RISK)과 생활 알림(복약/병원방문/미접속)을 하나의 테이블에서 통합 관리한다.

    - prediction_id: notification_type이 RISK일 때만 값이 존재 (RISK_PREDICTION 참조)
    - medication_id: notification_type이 MEDICATION일 때만 값이 존재 (MEDICATION 참조)
    - status: FCM 푸시 전송 실패 시 SMS Fallback이 적용되는 점을 고려해
              SENT/FAILED/READ로 구분 저장한다. (요구사항 11번)
    """
    __tablename__ = "notification"

    notification_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    guardian_id = Column(UUID(as_uuid=True), ForeignKey("guardian.guardian_id"), nullable=False)
    senior_id = Column(UUID(as_uuid=True), ForeignKey("senior.senior_id"), nullable=False)

    prediction_id = Column(UUID(as_uuid=True), ForeignKey("risk_prediction.prediction_id"), nullable=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("medication.medication_id"), nullable=True)

    notification_type = Column(String(15), nullable=False)
    status = Column(String(10), nullable=False)
    sent_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('RISK','MEDICATION','HOSPITAL','INACTIVE')",
            name="ck_notification_type",
        ),
        CheckConstraint(
            "status IN ('SENT','FAILED','READ')", name="ck_notification_status"
        ),
    )

    guardian = relationship("Guardian", backref="notifications")
    senior = relationship("Senior", backref="notifications")


class MonthlyReport(Base):
    """월간리포트 (MONTHLY_REPORT) — 요구사항 15, 16번.

    고령층별 월간 건강 리포트 PDF의 메타데이터만 저장한다.
    측정횟수·챗봇대화횟수·이상징후 발생횟수·질환별 평균위험도 등 통계값은 이 테이블에
    저장하지 않고, 조회 시점에 VOICE_FEATURE / RISK_PREDICTION 등 원본 테이블에서 집계한다.
    (원본 데이터와 리포트 간 불일치 방지)

    report_month 는 'YYYY-MM' 형식 문자열이며, (senior_id, report_month) 조합에 UNIQUE 제약을
    걸어 동일 월 리포트의 중복 생성을 방지한다.
    """
    __tablename__ = "monthly_report"

    report_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    senior_id = Column(UUID(as_uuid=True), ForeignKey("senior.senior_id"), nullable=False)
    report_month = Column(String(7), nullable=False)  # 'YYYY-MM'
    pdf_url = Column(String(500), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("senior_id", "report_month", name="uq_monthly_report_senior_month"),
    )

    senior = relationship("Senior", backref="monthly_reports")

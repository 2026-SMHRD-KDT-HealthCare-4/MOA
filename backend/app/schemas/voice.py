"""
음성 수집 / 분석 / 질환 위험도 예측 관련 요청·응답 스키마
"""

from datetime import datetime
from typing import Any, Dict, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------- 지정문구 (SCRIPT) ----------

class ScriptResponse(BaseModel):
    script_id: UUID
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- 지정문구 녹음 기록 (SCRIPT_RECORD) ----------

class ScriptRecordCreateRequest(BaseModel):
    senior_id: Optional[UUID] = None  # 토큰 세션 기반 자동 매핑하므로 생략 가능
    script_id: UUID
    measured_at: Optional[datetime] = None  # 미지정 시 서버 현재시각 사용


class ScriptRecordResponse(BaseModel):
    record_id: UUID
    senior_id: UUID
    script_id: UUID
    measured_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- 음성분석결과 (VOICE_FEATURE) ----------

class VoiceFeatureResponse(BaseModel):
    feature_id: UUID
    senior_id: UUID
    collect_type: Literal["SCRIPT", "CHATBOT"]
    voice_features: Dict[str, Any]
    measured_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyzeResponseData(BaseModel):
    feature_id: UUID
    features: Dict[str, float]
    risk_prediction: Optional["RiskPredictionResponse"] = None
    sample_type: Optional[Literal["free_speech_intro", "sustained_vowel", "normal_chat"]] = None
    sample_status: Optional[Literal["ok", "too_short", "failed"]] = None
    # 녹음 직후 피드백용 — 캘린더/리포트와 동일한 단일 소스(weather_status)로 산출한 날씨.
    status: Optional[Literal["sunny", "cloudy", "rainy"]] = None
    # 직전 기록 대비: 첫 기록 first / 같은 상태 similar / 달라짐 changed.
    comparison: Optional[Literal["first", "similar", "changed"]] = None


# ---------- 질환별 위험도 예측결과 (RISK_PREDICTION) ----------

RiskLevelLiteral = Literal["GREEN", "YELLOW", "AMBER"]


class RiskPredictionResponse(BaseModel):
    prediction_id: UUID
    senior_id: UUID
    parkinson_score: float = Field(ge=0, le=1)
    dementia_score: float = Field(ge=0, le=1)
    depression_score: float = Field(
        ge=0,
        le=1,
        description="레거시 호환 필드. 우울은 분석 대상에서 제외되어 항상 0입니다.",
    )
    diabetes_score: float = Field(ge=0, le=1)
    parkinson_level: RiskLevelLiteral
    dementia_level: RiskLevelLiteral
    depression_level: RiskLevelLiteral = Field(
        description="레거시 호환 필드. 우울은 분석 대상에서 제외되어 항상 GREEN입니다.",
    )
    diabetes_level: RiskLevelLiteral
    created_at: datetime

    class Config:
        from_attributes = True


AnalyzeResponseData.model_rebuild()

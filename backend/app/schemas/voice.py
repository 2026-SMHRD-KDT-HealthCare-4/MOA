"""
음성 수집 / 분석 / 질환 위험도 예측 관련 요청·응답 스키마
"""

from datetime import datetime
from typing import Dict, Literal, Optional
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
    voice_features: Dict[str, float]
    measured_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyzeResponseData(BaseModel):
    feature_id: UUID
    features: Dict[str, float]
    risk_prediction: Optional["RiskPredictionResponse"] = None


# ---------- 질환별 위험도 예측결과 (RISK_PREDICTION) ----------

RiskLevelLiteral = Literal["GREEN", "YELLOW", "AMBER"]


class RiskPredictionResponse(BaseModel):
    prediction_id: UUID
    senior_id: UUID
    parkinson_score: float = Field(ge=0, le=1)
    dementia_score: float = Field(ge=0, le=1)
    depression_score: float = Field(ge=0, le=1)
    diabetes_score: float = Field(ge=0, le=1)
    parkinson_level: RiskLevelLiteral
    dementia_level: RiskLevelLiteral
    depression_level: RiskLevelLiteral
    diabetes_level: RiskLevelLiteral
    created_at: datetime

    class Config:
        from_attributes = True


AnalyzeResponseData.model_rebuild()

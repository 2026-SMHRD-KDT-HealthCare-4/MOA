"""
월간리포트(MONTHLY_REPORT) 관련 요청·응답 스키마
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MonthlyReportCreateRequest(BaseModel):
    senior_id: UUID
    report_month: str = Field(pattern=r"^\d{4}-\d{2}$", description="'YYYY-MM' 형식")
    pdf_url: str


class MonthlyReportResponse(BaseModel):
    report_id: UUID
    senior_id: UUID
    report_month: str
    pdf_url: str
    created_at: datetime

    class Config:
        from_attributes = True


class AvgRisk(BaseModel):
    parkinson: Optional[float] = None
    dementia: Optional[float] = None
    depression: Optional[float] = None
    diabetes: Optional[float] = None


class MonthlyReportStats(BaseModel):
    measurement_count: int
    chat_session_count: int
    risk_alert_count: int
    participated_days: int
    total_days: int
    avg_risk: AvgRisk


class MonthlyReportDetailResponse(BaseModel):
    """리포트 메타데이터 + 조회 시점 집계 통계를 함께 반환."""
    report: Optional[MonthlyReportResponse] = None  # PDF가 아직 생성 안 됐으면 None
    report_month: str
    senior_id: UUID
    stats: MonthlyReportStats

"""
월간리포트 라우터 — 요구사항 15, 16번

- POST /report          : 생성된 PDF의 메타데이터(pdf_url) 저장. (senior_id, report_month) 중복 방지.
- GET  /report/stats    : 해당 월 통계를 원본 테이블에서 조회 시점에 집계해 반환.
                          (DB에 통계를 저장하지 않으므로 PDF 생성 전에도 통계 미리보기 가능)
- GET  /report/{senior} : 고령층의 저장된 월간리포트 목록.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user_id, verify_senior_access
from app.models.models import MonthlyReport, RiskPrediction
from app.schemas.report import (
    MonthlyReportCreateRequest,
    MonthlyReportDetailResponse,
    MonthlyReportResponse,
)
from app.services.monthly_stats import aggregate_monthly_stats

router = APIRouter(prefix="/report", tags=["report"])


def _status_from_prediction(prediction: RiskPrediction) -> str:
    """Map internal risk levels to the app's non-diagnostic weather metaphor."""
    levels = {
        prediction.parkinson_level,
        prediction.dementia_level,
        prediction.depression_level,
        prediction.diabetes_level,
    }
    if "AMBER" in levels:
        return "rainy"
    if "YELLOW" in levels:
        return "cloudy"
    return "sunny"


@router.post("", response_model=MonthlyReportResponse)
def create_report(
    req: MonthlyReportCreateRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """생성된 월간 리포트 PDF의 메타데이터를 저장한다. 동일 월 중복 생성은 막는다.

    NOTE: 본래 리포트 생성은 시스템 배치(스케줄러)가 수행하는 성격이 강하다. 현재는
    본인 또는 연동 보호자가 호출할 수 있도록 접근 권한만 검증한다. 배치 전환 시
    내부 서비스 인증으로 바꾸는 것을 권장한다.
    """
    verify_senior_access(user_id, req.senior_id, db)

    existing = (
        db.query(MonthlyReport)
        .filter(
            MonthlyReport.senior_id == req.senior_id,
            MonthlyReport.report_month == req.report_month,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"{req.report_month} 리포트가 이미 존재합니다.",
        )

    report = MonthlyReport(
        senior_id=req.senior_id,
        report_month=req.report_month,
        pdf_url=req.pdf_url,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/stats", response_model=MonthlyReportDetailResponse)
def get_report_stats(
    senior_id: UUID,
    report_month: str,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """해당 고령층의 해당 월 통계를 조회 시점에 집계해 반환한다. 본인 또는 연동 보호자만.

    저장된 PDF 메타데이터가 있으면 함께 반환하고, 없으면 report=None으로 통계만 반환한다.
    """
    verify_senior_access(user_id, senior_id, db)

    stats = aggregate_monthly_stats(db, senior_id, report_month)

    report = (
        db.query(MonthlyReport)
        .filter(
            MonthlyReport.senior_id == senior_id,
            MonthlyReport.report_month == report_month,
        )
        .first()
    )

    return MonthlyReportDetailResponse(
        report=report,
        report_month=report_month,
        senior_id=senior_id,
        stats=stats,
    )


@router.get("/{senior_id}", response_model=list[MonthlyReportResponse])
def list_reports(
    senior_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """고령층의 저장된 월간리포트 목록 (최근월 순). 본인 또는 연동 보호자만."""
    verify_senior_access(user_id, senior_id, db)
    return (
        db.query(MonthlyReport)
        .filter(MonthlyReport.senior_id == senior_id)
        .order_by(MonthlyReport.report_month.desc())
        .all()
    )


@router.get("/trend/{senior_id}")
def get_trend_data(
    senior_id: UUID,
    limit: int = 7,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Return a guardian-safe recent trend without exposing medical scores or diagnoses."""
    verify_senior_access(user_id, senior_id, db)
    limit = max(1, min(limit, 31))
    predictions = (
        db.query(RiskPrediction)
        .filter(RiskPrediction.senior_id == senior_id)
        .order_by(RiskPrediction.created_at.desc())
        .limit(limit)
        .all()
    )
    predictions.reverse()
    return {
        "status": "success",
        "data": [
            {
                "date": prediction.created_at.date().isoformat(),
                "status": _status_from_prediction(prediction),
                "recorded_at": prediction.created_at.isoformat(),
            }
            for prediction in predictions
        ],
    }

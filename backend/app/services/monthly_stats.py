"""
월간 리포트 통계 집계 서비스 — 요구사항 15번

월간리포트의 통계값(측정횟수, 챗봇대화횟수, 이상징후 발생횟수, 질환별 평균위험도)은
DB에 저장하지 않고, 조회 시점에 원본 테이블에서 직접 집계한다. 이렇게 하면 원본
데이터가 변경되어도 항상 최신 통계가 산출되어 원본-리포트 간 불일치가 발생하지 않는다.

⚠️ 요구사항 14번(음성 수치 ↔ 대화 텍스트 분리)에 따라, 각 데이터는 senior_id 기준으로
   별도 쿼리로 집계한 뒤 파이썬 dict로 병합한다. VOICE_FEATURE 와 CHAT_SESSION 을
   직접 JOIN하지 않는다.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import (
    ChatSession,
    Notification,
    RiskPrediction,
    VoiceFeature,
)


def _month_range(report_month: str) -> tuple[datetime, datetime]:
    """'YYYY-MM' -> 해당 월의 시작/다음 달 시작 datetime (반열린 구간 [start, end))."""
    year, month = map(int, report_month.split("-"))
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)
    return start, end


def aggregate_monthly_stats(db: Session, senior_id: UUID, report_month: str) -> dict:
    """해당 고령층의 해당 월 통계를 원본 테이블에서 집계해 dict로 반환한다."""
    start, end = _month_range(report_month)

    # 1. 음성 측정 횟수 (VOICE_FEATURE)
    measurement_count = (
        db.query(func.count(VoiceFeature.feature_id))
        .filter(
            VoiceFeature.senior_id == senior_id,
            VoiceFeature.measured_at >= start,
            VoiceFeature.measured_at < end,
        )
        .scalar()
    ) or 0

    # 2. 챗봇 대화 세션 수 (CHAT_SESSION) — 음성과 별도 쿼리(JOIN 금지)
    chat_session_count = (
        db.query(func.count(ChatSession.session_id))
        .filter(
            ChatSession.senior_id == senior_id,
            ChatSession.started_at >= start,
            ChatSession.started_at < end,
        )
        .scalar()
    ) or 0

    # 3. 이상 징후(RISK) 알림 발생 횟수 (NOTIFICATION)
    risk_alert_count = (
        db.query(func.count(Notification.notification_id))
        .filter(
            Notification.senior_id == senior_id,
            Notification.notification_type == "RISK",
            Notification.sent_at >= start,
            Notification.sent_at < end,
        )
        .scalar()
    ) or 0

    # 4. 질환별 평균 위험도 (RISK_PREDICTION)
    avg_row = (
        db.query(
            func.avg(RiskPrediction.parkinson_score),
            func.avg(RiskPrediction.dementia_score),
            func.avg(RiskPrediction.depression_score),
            func.avg(RiskPrediction.diabetes_score),
        )
        .filter(
            RiskPrediction.senior_id == senior_id,
            RiskPrediction.created_at >= start,
            RiskPrediction.created_at < end,
        )
        .first()
    )

    def _round(v):
        return round(float(v), 3) if v is not None else None

    avg_risk = {
        "parkinson": _round(avg_row[0]) if avg_row else None,
        "dementia": _round(avg_row[1]) if avg_row else None,
        "depression": _round(avg_row[2]) if avg_row else None,
        "diabetes": _round(avg_row[3]) if avg_row else None,
    }

    return {
        "measurement_count": measurement_count,
        "chat_session_count": chat_session_count,
        "risk_alert_count": risk_alert_count,
        "avg_risk": avg_risk,
    }

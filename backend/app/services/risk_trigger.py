"""
위험도 기반 자동 알림 트리거 판정 — AMBER 즉시 / YELLOW 누적

정책
- AMBER: 4개 질환(파킨슨/치매/우울/당뇨) 중 하나라도 AMBER 등급이면 즉시 알림 대상.
- YELLOW 누적(질환 통합, 날짜 기준):
    하루 "대표 등급"이 YELLOW 이상인 날이
      (a) 연속 3일 이상  또는
      (b) 최근 7일 중 4일 이상
    이면 알림 대상.
  · 하루 대표 등급 = 그날 측정된 RISK_PREDICTION 중 가장 높은 등급
    (AMBER > YELLOW > GREEN). 4개 질환 통합이므로, 한 행에서 질환 하나라도
    YELLOW면 그 행은 YELLOW, 하나라도 AMBER면 그 행은 AMBER로 본다.

  · "YELLOW 이상"으로 집계하는 이유: AMBER인 날도 '경고성 상태가 지속됐다'는
    누적 패턴의 일부로 포함하는 것이 자연스럽기 때문이다. (AMBER 단독 알림과는 별개 트랙)

반환: 트리거 여부와 사유. analyze 라우터가 이 결과로 알림 생성 여부를 결정한다.
"""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.models import RiskPrediction

# 등급 우선순위 (높을수록 위험)
_LEVEL_RANK = {"GREEN": 0, "YELLOW": 1, "AMBER": 2}

YELLOW_CONSECUTIVE_DAYS = 3      # 연속 N일
YELLOW_WINDOW_DAYS = 7           # 최근 N일 중
YELLOW_WINDOW_THRESHOLD = 4      # M일 이상


def _row_level(pred: RiskPrediction) -> str:
    """한 RISK_PREDICTION 행에서 4개 질환 중 가장 높은 등급을 반환."""
    levels = [
        pred.parkinson_level,
        pred.dementia_level,
        pred.depression_level,
        pred.diabetes_level,
    ]
    return max(levels, key=lambda lv: _LEVEL_RANK.get(lv, 0))


def check_amber(pred: RiskPrediction) -> bool:
    """이번 예측 결과에 AMBER 질환이 하나라도 있는지."""
    return _row_level(pred) == "AMBER"


def _daily_top_levels(db: Session, senior_id: UUID, since: date) -> dict[date, str]:
    """since 이후의 예측을 날짜별로 묶어, 각 날짜의 대표(최고) 등급을 반환."""
    rows = (
        db.query(RiskPrediction)
        .filter(
            RiskPrediction.senior_id == senior_id,
            RiskPrediction.created_at >= datetime.combine(since, datetime.min.time()),
        )
        .all()
    )

    by_day: dict[date, str] = {}
    for r in rows:
        d = r.created_at.date()
        lv = _row_level(r)
        if d not in by_day or _LEVEL_RANK[lv] > _LEVEL_RANK[by_day[d]]:
            by_day[d] = lv
    return by_day


def check_yellow_accumulation(db: Session, senior_id: UUID, today: date | None = None) -> bool:
    """YELLOW 이상 날의 누적 패턴이 트리거 조건을 충족하는지 판정.

    조건: 최근 7일 중 YELLOW 이상인 날이 4일 이상  또는  연속 3일 이상.
    """
    if today is None:
        today = datetime.utcnow().date()

    window_start = today - timedelta(days=YELLOW_WINDOW_DAYS - 1)
    by_day = _daily_top_levels(db, senior_id, window_start)

    # YELLOW 이상인 날짜 집합
    flagged_days = {
        d for d, lv in by_day.items() if _LEVEL_RANK[lv] >= _LEVEL_RANK["YELLOW"]
    }

    # (b) 최근 7일 중 4일 이상
    if len(flagged_days) >= YELLOW_WINDOW_THRESHOLD:
        return True

    # (a) 연속 3일 이상 — today부터 거꾸로 훑으며 최장 연속 길이 확인
    max_streak = 0
    streak = 0
    for offset in range(YELLOW_WINDOW_DAYS):
        d = today - timedelta(days=offset)
        if d in flagged_days:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0

    return max_streak >= YELLOW_CONSECUTIVE_DAYS


def evaluate_risk_trigger(
    db: Session, senior_id: UUID, pred: RiskPrediction
) -> dict:
    """이번 예측 결과를 바탕으로 알림 트리거 여부를 종합 판정한다.

    반환 예: {"should_notify": True, "reason": "AMBER"} 또는
            {"should_notify": True, "reason": "YELLOW_ACCUMULATION"} 또는
            {"should_notify": False, "reason": None}
    """
    if check_amber(pred):
        return {"should_notify": True, "reason": "AMBER"}

    if check_yellow_accumulation(db, senior_id):
        return {"should_notify": True, "reason": "YELLOW_ACCUMULATION"}

    return {"should_notify": False, "reason": None}

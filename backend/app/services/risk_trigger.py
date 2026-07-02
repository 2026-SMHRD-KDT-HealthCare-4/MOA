"""
위험도 기반 자동 알림 트리거 판정 — AMBER 즉시 / YELLOW 누적

정책
- AMBER: 3개 질환(파킨슨/치매/당뇨) 중 하나라도 AMBER 등급이면 즉시 알림 대상.
- YELLOW 누적(질환 통합, 날짜 기준):
    하루 "대표 등급"이 YELLOW 이상인 날이
      (a) 연속 3일 이상  또는
      (b) 최근 7일 중 4일 이상
    이면 알림 대상.
  · 하루 대표 등급 = 그날 측정된 RISK_PREDICTION 중 가장 높은 등급
    (AMBER > YELLOW > GREEN). 3개 질환 통합이므로, 한 행에서 질환 하나라도
    YELLOW면 그 행은 YELLOW, 하나라도 AMBER면 그 행은 AMBER로 본다.

  · "YELLOW 이상"으로 집계하는 이유: AMBER인 날도 '경고성 상태가 지속됐다'는
    누적 패턴의 일부로 포함하는 것이 자연스럽기 때문이다. (AMBER 단독 알림과는 별개 트랙)

반환: 트리거 여부와 사유. analyze 라우터가 이 결과로 알림 생성 여부를 결정한다.
"""

from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.models import RiskPrediction

# ─────────────────────────────────────────────────────────────────────────────
# 챗봇 발화 긴급 분류 — 룰 기반 (키워드 매칭)
# ZDR 원칙: 발화 원문은 여기서 저장하거나 반환하지 않는다.
# 키워드 목록은 상수로 분리해 쉽게 추가·수정 가능하도록 한다.
# ─────────────────────────────────────────────────────────────────────────────

# 자살·자해 위험 키워드
SUICIDE_KEYWORDS: list[str] = [
    "죽고 싶어", "살기 싫어", "사라지고 싶어", "그만 살고 싶어",
    "죽고싶어", "살기싫어", "사라지고싶어", "그만살고싶어",
    "이 세상에서 사라지고", "스스로 목숨", "자해하고 싶어",
]

# 신체 응급 키워드
MEDICAL_EMERGENCY_KEYWORDS: list[str] = [
    "쓰러질 것 같아", "가슴이 답답해", "숨이 안 쉬어져", "심하게 어지러워",
    "쓰러질것같아", "가슴이답답해", "숨이안쉬어져",
    "가슴이 아파", "가슴 통증", "숨을 못 쉬겠어", "쓰러졌어",
]

# 일반 불편 키워드 (자동 긴급 알림 없음, 봇 응답 분기에만 활용)
GENERAL_DISCOMFORT_KEYWORDS: list[str] = [
    "아파", "불편하다", "어지럽다", "힘들다",
    "아프다", "몸이 안 좋아", "기운이 없어", "피곤해",
]

# 백엔드 고정 안전 문구 — LLM 응답 대신 사용
SAFETY_REPLY: dict[str, str] = {
    "SUICIDE_RISK": (
        "지금 많이 힘드신 것 같아요. 혼자 계시지 말고 가까운 가족이나 119에 바로 도움을 요청해 주세요. "
        "모아는 의료 진단이나 긴급 구조를 대신할 수 없어요."
    ),
    "MEDICAL_EMERGENCY": (
        "지금은 바로 주변에 도움을 요청해 주세요. 증상이 심하거나 숨쉬기 어렵다면 119에 연락하는 것이 좋아요. "
        "모아의 안내는 의료 진단을 대신하지 않아요."
    ),
    "GENERAL_DISCOMFORT": (
        "몸이 불편하셨군요. 무리하지 말고 쉬어 주세요. "
        "불편함이 계속되거나 심해지면 의료진 또는 가족에게 알려주세요."
    ),
}


def classify_chat_urgency(message: str) -> tuple[str | None, str | None]:
    """발화 텍스트를 긴급도 등급으로 분류한다.

    Returns:
        (level, rule_id)
        - level: "SUICIDE_RISK" | "MEDICAL_EMERGENCY" | "GENERAL_DISCOMFORT" | None
        - rule_id: 매칭된 키워드 상수 (감사 로그용, 발화 원문이 아님)

    우선순위: SUICIDE_RISK > MEDICAL_EMERGENCY > GENERAL_DISCOMFORT.
    """
    text = message.lower()

    for kw in SUICIDE_KEYWORDS:
        if kw.lower() in text:
            return "SUICIDE_RISK", kw

    for kw in MEDICAL_EMERGENCY_KEYWORDS:
        if kw.lower() in text:
            return "MEDICAL_EMERGENCY", kw

    for kw in GENERAL_DISCOMFORT_KEYWORDS:
        if kw.lower() in text:
            return "GENERAL_DISCOMFORT", kw

    return None, None

# 등급 우선순위 (높을수록 위험)
_LEVEL_RANK = {"GREEN": 0, "YELLOW": 1, "AMBER": 2}

YELLOW_CONSECUTIVE_DAYS = 3      # 연속 N일
YELLOW_WINDOW_DAYS = 7           # 최근 N일 중
YELLOW_WINDOW_THRESHOLD = 4      # M일 이상


def _row_level(pred: RiskPrediction) -> str:
    """한 RISK_PREDICTION 행에서 분석 대상 3개 질환 중 가장 높은 등급을 반환."""
    levels = [
        pred.parkinson_level,
        pred.dementia_level,
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


AMBER_CONSECUTIVE_DAYS = 3      # 연속 N일
AMBER_WINDOW_DAYS = 7           # 최근 N일 중
AMBER_WINDOW_THRESHOLD = 4      # M일 이상


def check_amber_accumulation(db: Session, senior_id: UUID, today: date | None = None) -> bool:
    """AMBER 날의 누적 패턴이 트리거 조건을 충족하는지 판정.

    조건: 최근 7일 중 AMBER인 날이 4일 이상  또는  연속 3일 이상.
    """
    if today is None:
        today = datetime.utcnow().date()

    window_start = today - timedelta(days=AMBER_WINDOW_DAYS - 1)
    by_day = _daily_top_levels(db, senior_id, window_start)

    # AMBER인 날짜 집합
    flagged_days = {
        d for d, lv in by_day.items() if lv == "AMBER"
    }

    # (b) 최근 7일 중 4일 이상
    if len(flagged_days) >= AMBER_WINDOW_THRESHOLD:
        return True

    # (a) 연속 3일 이상 — today부터 거꾸로 훑으며 최장 연속 길이 확인
    max_streak = 0
    streak = 0
    for offset in range(AMBER_WINDOW_DAYS):
        d = today - timedelta(days=offset)
        if d in flagged_days:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0

    return max_streak >= AMBER_CONSECUTIVE_DAYS


def evaluate_risk_trigger(
    db: Session, senior_id: UUID, pred: RiskPrediction
) -> dict:
    """이번 예측 결과를 바탕으로 알림 트리거 여부를 종합 판정한다.

    반환 예: {"should_notify": True, "reason": "AMBER_ACCUMULATION"} 또는
            {"should_notify": True, "reason": "AMBER"} 또는
            {"should_notify": True, "reason": "YELLOW_ACCUMULATION"} 또는
            {"should_notify": False, "reason": None}
    """
    if check_amber_accumulation(db, senior_id):
        return {"should_notify": True, "reason": "AMBER_ACCUMULATION"}

    if check_amber(pred):
        return {"should_notify": True, "reason": "AMBER"}

    if check_yellow_accumulation(db, senior_id):
        return {"should_notify": True, "reason": "YELLOW_ACCUMULATION"}

    return {"should_notify": False, "reason": None}


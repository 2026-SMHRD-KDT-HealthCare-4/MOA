"""
음성 영역별 관찰 분석 — 보호자 리포트 '이번 달 주목할 변화' 카드용.

원시 음향 피처(voice_feature.voice_features JSONB)를 월 단위로 집계해
직접사용자에게 노출 가능한 '영역별 관찰'로 요약한다.

안전 규칙:
- 질환명/점수 비노출. '감지/변화/패턴/참고용' 표현만 사용, 경보는 앰버 단독(레드 금지).
- risk_prediction(질환 점수)은 사용하지 않는다 — 여기서는 원시 음향 피처만 쓴다.

방법:
- 기준선(baseline) 대비 이번 달 평균의 상대 변화율을 본다.
  이전 이력이 충분하면 '이전 달들'을, 부족하면 '이번 달 전반부'를 기준선으로 삼는다.
- 상대 변화가 임계값(_REL_THRESHOLD) 이상이고 '나빠지는 방향'이면 caution(변화 감지).
"""

from __future__ import annotations

from statistics import mean
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.models import VoiceFeature
from app.services.monthly_stats import _month_range

# 기준선 대비 15% 이상 변하면 '변화 감지'로 본다(임계값은 ML/분석 팀과 조정 가능).
_REL_THRESHOLD = 0.15

# 관찰 영역 정의: (라벨, 피처키, 방향)
#   'down' = 값이 작아지는 게 변화 감지(예: 발화 속도 느려짐)
#   'up'   = 값이 커지는 게 변화 감지(예: 쉼 늘어남, 떨림 늘어남)
_AREAS: list[tuple[str, str, str]] = [
    ("발화 속도", "speech_rate", "down"),
    ("호흡 패턴", "pause_ratio", "up"),
    ("목소리 안정성", "jitter_rap", "up"),
]

_TEXT: dict[str, dict[str, str]] = {
    "발화 속도": {"normal": "평소와 비슷한 속도예요", "caution": "평소보다 느려지는 경향이 있어요"},
    "호흡 패턴": {"normal": "안정적이에요", "caution": "쉼이 길어지는 경향이 보여요"},
    "목소리 안정성": {"normal": "안정적이에요", "caution": "떨림이 늘어나는 경향이 있어요"},
}


def _mean_of(rows: list[VoiceFeature], key: str) -> float | None:
    """rows 의 voice_features[key] 중 유효한 양수 값들의 평균. 없으면 None."""
    vals: list[float] = []
    for r in rows:
        feats = r.voice_features
        if not isinstance(feats, dict):
            continue
        v = feats.get(key)
        if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0:
            vals.append(float(v))
    return mean(vals) if vals else None


def analyze_voice_patterns(db: Session, senior_id: UUID, report_month: str) -> list[dict]:
    """해당 월의 음성 영역별 관찰 목록을 반환한다. 데이터가 부족하면 빈 리스트."""
    start, end = _month_range(report_month)

    month_rows = (
        db.query(VoiceFeature)
        .filter(
            VoiceFeature.senior_id == senior_id,
            VoiceFeature.measured_at >= start,
            VoiceFeature.measured_at < end,
        )
        .order_by(VoiceFeature.measured_at.asc())
        .all()
    )
    if not month_rows:
        return []  # 이번 달 측정 없음 → 화면은 '준비 중' 빈 상태 유지

    history_rows = (
        db.query(VoiceFeature)
        .filter(
            VoiceFeature.senior_id == senior_id,
            VoiceFeature.measured_at < start,
        )
        .order_by(VoiceFeature.measured_at.asc())
        .all()
    )

    # 기준선 선택: 이전 이력이 충분하면 그걸, 아니면 이번 달 전반부 vs 후반부로 추세를 본다.
    if len(history_rows) >= 3:
        base_rows, cur_rows = history_rows, month_rows
    else:
        mid = len(month_rows) // 2
        base_rows, cur_rows = month_rows[:mid], month_rows[mid:]
        if len(base_rows) < 2 or len(cur_rows) < 2:
            return []  # 비교할 만큼 데이터가 없음

    patterns: list[dict] = []
    for label, key, direction in _AREAS:
        base = _mean_of(base_rows, key)
        cur = _mean_of(cur_rows, key)
        if base is None or cur is None:
            continue  # 이 영역은 유효 데이터 부족 → 생략
        change = (cur - base) / base
        caution = change <= -_REL_THRESHOLD if direction == "down" else change >= _REL_THRESHOLD
        status = "caution" if caution else "normal"
        patterns.append({"area": label, "status": status, "text": _TEXT[label][status]})

    return patterns

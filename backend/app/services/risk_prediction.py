"""
질환별 위험도 추론 서비스

⚠️ ML팀 모델 연동 전까지 사용하는 임시(더미) 구현입니다.
   voice_features(dict)를 입력으로 받아 3개 질환의 (score, level) 딕셔너리를 반환하는
   동일한 시그니처(predict_risk)를 ML팀 실제 모델로 그대로 교체하면 됩니다.

   교체 시 체크리스트:
   1) 입력: voice_features: dict[str, float]  (VOICE_FEATURE.voice_features 와 동일 포맷)
   2) 출력: {"parkinson": {"score": float(0~1), "level": "GREEN|YELLOW|AMBER"}, ...}
   3) score -> level 변환 기준(현재 더미 임계값)도 ML팀과 합의된 기준으로 교체 필요
"""

import hashlib
import random


RISK_KEYS = ["parkinson", "dementia", "diabetes"]


def _score_to_level(score: float) -> str:
    if score < 0.3:
        return "GREEN"
    if score < 0.7:
        return "YELLOW"
    return "AMBER"


def predict_risk(voice_features: dict) -> dict:
    """
    더미 추론: voice_features 내용을 시드로 사용해 매번 같은 입력엔 같은 결과가 나오도록 하되,
    실제 추론처럼 보이는 0~1 사이 난수를 생성한다. (테스트 재현성 확보용)
    """
    seed_src = str(sorted(voice_features.items())) if voice_features else "empty"
    seed = int(hashlib.md5(seed_src.encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)

    result = {}
    for key in RISK_KEYS:
        score = round(rng.uniform(0.0, 1.0), 3)
        result[key] = {"score": score, "level": _score_to_level(score)}
    return result

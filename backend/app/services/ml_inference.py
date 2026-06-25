"""
ML 추론 다리(bridge) — 백엔드와 ML팀 통합 엔진(ml/inference/total_engine.py)을 연결한다.

설계
- ML팀의 MOAInferenceEngine.predict_all(features, user_info) 을 호출한다.
- 엔진은 모델 로딩이 무거우므로 프로세스당 1회만 생성해 재사용한다(_get_engine 캐싱).
- 입력 features 형식: {'acoustic': dict, 'wav_paths': {...}, 'raw_features': {...}, 'diabetes_wav': str}
  · acoustic     : extract_all_acoustic_features(wav) 가 준 음향지표 dict (파킨슨용)
  · wav_paths    : 과제별 WAV 경로 (치매용). 엔진이 경로에서 HuBERT-PCA를 내부 추출한다.
  · raw_features : 과제별 음향지표 dict (치매용). 음향+HuBERT를 엔진이 합친다.
  · diabetes_wav : WAV 경로 (당뇨용). 엔진이 경로에서 BYOL-S 임베딩을 내부 추출한다.
- 출력은 명세서 형식: data.risk_score.{score_pkn, score_dem, score_dm, score_dep, overall_risk_level}

현재 범위: 파킨슨 + 치매(CTD 고정) + 당뇨 추론. 우울은 모델 없음(항상 0).
치매 task는 ML팀 권장대로 CTD 고정(낭독 1개 기준). 한국어 정확도 한계는 발표에서 명시.

ZDR: WAV는 임시파일로만 쓰고 추출 직후 즉시 삭제한다.
"""

import os
import sys
import tempfile

# 이 파일: <MOA>/backend/app/services/ml_inference.py
# ml 폴더는 backend 의 형제(= <MOA>/ml). 따라서 backend 에서 한 단계 더 위로 올라가야 한다.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # <MOA>/backend
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)  # <MOA>
_ML_DIR = os.path.join(_PROJECT_ROOT, "ml")
_ML_INFERENCE_DIR = os.path.join(_ML_DIR, "inference")
_ML_MODELS_DIR = os.path.join(_ML_DIR, "models")  # 실제 모델 위치: ml/models/<질환>/

if _ML_INFERENCE_DIR not in sys.path:
    sys.path.insert(0, _ML_INFERENCE_DIR)

# total_engine 내부가 'from inference.hubert_extraction import ...' 처럼
# inference 를 패키지로 import 하므로, 그 부모인 ml 폴더도 경로에 둔다.
# 단, ml 폴더에는 main.py 가 있어 backend/main.py 와 이름이 충돌한다.
# 그래서 맨 앞(insert 0)이 아니라 맨 뒤(append)에 추가해, uvicorn 이 실행하는
# backend/main.py 가 항상 우선되도록 한다.
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)

# ML팀 모듈 import (sys.path 설정 후)
import feature_extraction as _fe  # noqa: E402
import total_engine as _te  # noqa: E402
from total_engine import MOAInferenceEngine  # noqa: E402


# --- 엔진 싱글톤 (모델 로딩 1회) ---
_engine = None


def _get_engine() -> MOAInferenceEngine:
    global _engine
    if _engine is None:
        engine = MOAInferenceEngine.__new__(MOAInferenceEngine)
        # ML팀 코드는 모델을 ml/<질환>/ 에서 찾지만, 실제 파일은 ml/models/<질환>/ 에 있다.
        # 담당자 코드를 수정하지 않고, 엔진의 모델 루트를 models/ 로 교정한 뒤 로딩한다.
        engine.ml_root = _ML_MODELS_DIR
        engine.models = {
            "dementia": {},
            "diabetes": {"male": {}, "female": {}},
            "parkinson": {},
        }
        engine.load_all_models()
        _engine = engine
    return _engine


def _score_to_level(score: float) -> str:
    """단일 질환 score를 등급으로. 엔진의 overall 기준과 동일(0.7/0.4)."""
    if score >= 0.7:
        return "AMBER"
    if score >= 0.4:
        return "YELLOW"
    return "GREEN"


def predict_risk_from_wav(audio_bytes: bytes, user_info: dict) -> dict:
    """음성 바이트 + 사용자정보 → 4개 질환 위험도(우리 DB 형식).

    반환:
      {
        "parkinson": {"score": float, "level": "GREEN|YELLOW|AMBER"},
        "dementia":  {...}, "depression": {...}, "diabetes": {...},
      }

    user_info: {"gender": "M"|"F", "age": int, "bmi": float}
    """
    tmp_path = None
    try:
        # 윈도우 호환: NamedTemporaryFile을 열어둔 채로 다른 라이브러리(openSMILE/Librosa)가
        # 같은 경로를 열면 "파일 사용 중"으로 실패한다. 그래서 파일을 만들고 즉시 닫은 뒤,
        # 완전히 분리된 단계에서 경로만 추출 함수에 넘긴다.
        fd, tmp_path = tempfile.mkstemp(suffix=".wav")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(audio_bytes)
                f.flush()
                os.fsync(f.fileno())
        except Exception:
            os.close(fd)
            raise

        # 음향지표 dict 추출 (파킨슨용 + 치매 음향 부분 공용)
        # 이 시점에 임시 WAV는 완전히 닫혀 있어 openSMILE/Librosa가 정상적으로 읽는다.
        acoustic = _fe.extract_all_acoustic_features(tmp_path)

        # 치매: ML팀이 task="CTD" 고정 권장(낭독 1개 기준). 엔진이 WAV 경로에서
        #       HuBERT-PCA를 내부 추출해 음향지표와 합친다.
        # 당뇨: 엔진이 WAV 경로에서 BYOL-S 임베딩을 내부 추출한다(diabetes_wav).
        #       같은 임시 WAV를 재사용한다.
        features = {
            "acoustic": acoustic,                      # 파킨슨용
            "wav_paths": {"CTD": tmp_path},            # 치매용 WAV 경로 (CTD 고정)
            "raw_features": {"CTD": acoustic},         # 치매용 음향지표 (동일 dict 재사용)
            "diabetes_wav": tmp_path,                  # 당뇨용 WAV 경로
        }

        engine = _get_engine()
        result = engine.predict_all(features, user_info)

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    rs = result["data"]["risk_score"]

    pkn = float(rs["score_pkn"])
    dem = float(rs["score_dem"])
    dep = float(rs["score_dep"])
    dm = float(rs["score_dm"])

    return {
        "parkinson": {"score": pkn, "level": _score_to_level(pkn)},
        "dementia": {"score": dem, "level": _score_to_level(dem)},
        "depression": {"score": dep, "level": _score_to_level(dep)},
        "diabetes": {"score": dm, "level": _score_to_level(dm)},
    }
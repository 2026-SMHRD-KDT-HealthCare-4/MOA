"""
ML 추론 다리(bridge) — 백엔드와 ML팀 통합 엔진(ml/inference/total_engine.py)을 연결한다.
[진단 버전] 추출 단계별로 터미널에 상세 로그를 찍는다. 문제 해결 후 제거할 것.
"""

import os
import sys
import tempfile
import traceback

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_ML_DIR = os.path.join(_PROJECT_ROOT, "ml")
_ML_INFERENCE_DIR = os.path.join(_ML_DIR, "inference")
_ML_MODELS_DIR = os.path.join(_ML_DIR, "models")

if _ML_INFERENCE_DIR not in sys.path:
    sys.path.insert(0, _ML_INFERENCE_DIR)

import feature_extraction as _fe
import total_engine as _te
from total_engine import MOAInferenceEngine

_engine = None


def _get_engine() -> MOAInferenceEngine:
    global _engine
    if _engine is None:
        engine = MOAInferenceEngine.__new__(MOAInferenceEngine)
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
    if score >= 0.7:
        return "AMBER"
    if score >= 0.4:
        return "YELLOW"
    return "GREEN"


def predict_risk_from_wav(audio_bytes: bytes, user_info: dict) -> dict:
    tmp_path = None
    try:
        # ── 진단 1: 받은 오디오 크기 ──────────────────────────────────────────
        print(f"\n{'='*60}")
        print(f"[진단] audio_bytes 크기: {len(audio_bytes):,} bytes")
        print(f"[진단] user_info: {user_info}")

        # 임시 파일 생성
        fd, tmp_path = tempfile.mkstemp(suffix=".wav")
        print(f"[진단] 임시파일 경로: {tmp_path}")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(audio_bytes)
                f.flush()
                os.fsync(f.fileno())
        except Exception:
            os.close(fd)
            raise

        # ── 진단 2: 임시파일이 실제로 존재하고 내용이 있는지 ─────────────────
        file_size = os.path.getsize(tmp_path)
        print(f"[진단] 임시파일 크기: {file_size:,} bytes  (0이면 쓰기 실패)")

        # ── 진단 3: feature_extraction 내부 함수별로 개별 추출 시도 ───────────
        # _fe 에 어떤 함수가 있는지 확인
        fe_attrs = [a for a in dir(_fe) if not a.startswith("_")]
        print(f"[진단] feature_extraction 공개 함수/속성: {fe_attrs}")

        # extract_all_acoustic_features 가 있는 함수인지 확인
        if hasattr(_fe, "extract_all_acoustic_features"):
            print("[진단] extract_all_acoustic_features → 호출 시작")
            try:
                acoustic = _fe.extract_all_acoustic_features(tmp_path)
                if isinstance(acoustic, dict):
                    print(f"[진단] ✅ acoustic 추출 완료 — 키 개수: {len(acoustic)}")
                    print(f"[진단] 키 목록: {list(acoustic.keys())}")
                else:
                    print(f"[진단] ⚠️ acoustic 타입이 dict가 아님: {type(acoustic)}")
                    acoustic = acoustic  # 그대로 사용
            except Exception as e:
                print(f"[진단] ❌ extract_all_acoustic_features 예외: {e}")
                print(traceback.format_exc())
                acoustic = {}
        else:
            print("[진단] ❌ feature_extraction에 extract_all_acoustic_features 없음!")
            acoustic = {}

        # ── 진단 4: 개별 추출기 결과 ─────────────────────────────────────────
        # Parselmouth / Librosa / openSMILE 각각 직접 호출 (함수명이 있으면)
        for fn_name in ["extract_parselmouth_features",
                        "extract_librosa_features",
                        "extract_opensmile_features",
                        "extract_praat_features"]:
            if hasattr(_fe, fn_name):
                try:
                    result = getattr(_fe, fn_name)(tmp_path)
                    count = len(result) if isinstance(result, dict) else "dict 아님"
                    print(f"[진단]   {fn_name}: {count}개")
                except Exception as e:
                    print(f"[진단]   {fn_name}: ❌ 예외 → {e}")
            # else: 함수 없으면 무시 (조용히)

        print(f"[진단] 최종 acoustic 키 수 → {len(acoustic) if isinstance(acoustic, dict) else 'N/A'}")
        print(f"{'='*60}\n")

        features = {
            "acoustic": acoustic,
            "tasks": {},
            "byols_embedding": None,
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
    dm  = float(rs["score_dm"])

    return {
        "parkinson":  {"score": pkn, "level": _score_to_level(pkn)},
        "dementia":   {"score": dem, "level": _score_to_level(dem)},
        "depression": {"score": dep, "level": _score_to_level(dep)},
        "diabetes":   {"score": dm,  "level": _score_to_level(dm)},
    }
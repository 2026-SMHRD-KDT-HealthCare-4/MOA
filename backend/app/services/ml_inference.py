"""
ML 추론 bridge — 백엔드 ↔ MOAInferenceEngine 연결
"""

import os
import sys
import tempfile
import numpy as np

_BACKEND_DIR      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_PROJECT_ROOT     = os.path.dirname(_BACKEND_DIR)
_ML_DIR           = os.path.join(_PROJECT_ROOT, "ml")
_ML_INFERENCE_DIR = os.path.join(_ML_DIR, "inference")
_ML_MODELS_DIR    = os.path.join(_ML_DIR, "models")

if _ML_INFERENCE_DIR not in sys.path:
    sys.path.insert(0, _ML_INFERENCE_DIR)
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)

import feature_extraction as _fe
from total_engine import MOAInferenceEngine

# HuBERT 추출 모듈 (치매용)
try:
    import hubert_extraction as _he
    _HUBERT_OK = True
except ImportError:
    print("⚠️ hubert_extraction 임포트 실패 — 치매 HuBERT 비활성화")
    _HUBERT_OK = False

# BYOL-S 추출 모듈 (당뇨용)
try:
    import byols_extraction as _be
    _BYOLS_OK = True
except ImportError:
    print("⚠️ byols_extraction 임포트 실패 — 당뇨 추론 비활성화")
    _BYOLS_OK = False


# ── 엔진 싱글톤 ──────────────────────────────────────────────────
_engine = None

def _get_engine() -> MOAInferenceEngine:
    global _engine
    if _engine is None:
        engine = MOAInferenceEngine.__new__(MOAInferenceEngine)
        engine.ml_root = _ML_MODELS_DIR
        engine.models  = {
            "dementia":  {},
            "diabetes":  {"male": {}, "female": {}},
            "parkinson": {},
        }
        engine.load_all_models()
        _engine = engine
    return _engine


# ── 등급 변환 ────────────────────────────────────────────────────
def _score_to_level(score: float, disease: str = "") -> str:
    if disease == "parkinson":
        if score >= 0.85:
            return "AMBER"
        if score >= 0.65:
            return "YELLOW"
        return "GREEN"
    elif disease == "dementia":
        if score >= 0.55:
            return "AMBER"
        if score >= 0.35:
            return "YELLOW"
        return "GREEN"
    else:
        if score >= 0.7:
            return "AMBER"
        if score >= 0.4:
            return "YELLOW"
        return "GREEN"


# ── 메인 추론 함수 ───────────────────────────────────────────────
def predict_risk_from_wav(audio_bytes: bytes, user_info: dict) -> dict:
    tmp_path = None
    try:
        # 임시 WAV 저장
        fd, tmp_path = tempfile.mkstemp(suffix=".wav")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(audio_bytes)
                f.flush()
                os.fsync(f.fileno())
        except Exception:
            os.close(fd)
            raise

        # ── 1. 음향지표 추출 (파킨슨용) ──
        acoustic = _fe.extract_all_acoustic_features(tmp_path)

        # ── 2. 치매용 음향지표 — acoustic_cols 순서 보장 ──
        engine = _get_engine()
        dem_acoustic_cols = engine.models["dementia"].get("CTD", {}).get("acoustic_cols", [])

        if dem_acoustic_cols:
            dem_feat_list = _fe.extract_dementia_features(tmp_path, dem_acoustic_cols)
            print(f"=== dem_feat_list 첫 5개: {dem_feat_list[:5]} ===")
            print(f"=== dem_feat_list f0_mean(index 1): {dem_feat_list[1]} ===")
            raw_features  = {"CTD": dem_feat_list}
            print(f"=== dem_acoustic_cols 길이: {len(dem_acoustic_cols)} ===")
            print(f"=== dem_feat_list 타입: {type(dem_feat_list)}, 길이: {len(dem_feat_list)} ===")
            print(f"=== dem_feat_list 마지막 6개(언어피처): {dem_feat_list[-6:]} ===")
        else:
            print("⚠️ acoustic_cols 없음 — acoustic dict fallback")
            raw_features = {"CTD": acoustic}

        # ── 3. HuBERT 임베딩 추출 (치매용) ──
        hubert_embedding = None
        if _HUBERT_OK:
            try:
                hubert_dict = _he.extract_hubert_embedding(tmp_path)
                hubert_embedding = np.array(
                    [hubert_dict[f"hubert_{i}"] for i in range(len(hubert_dict))],
                    dtype=float
                )
                if np.isnan(hubert_embedding).any():
                    print("⚠️ HuBERT 임베딩에 NaN 포함 — 치매 HuBERT 비활성화")
                    hubert_embedding = None
            except Exception as e:
                print(f"⚠️ HuBERT 추출 실패: {e}")
                hubert_embedding = None

        # ── 4. BYOL-S 임베딩 추출 (당뇨용) ──
        byols_embedding = None
        if _BYOLS_OK:
            try:
                byols_embedding = _be.extract_byols_embedding(tmp_path)
            except Exception as e:
                print(f"⚠️ BYOL-S 추출 실패: {e}")
                byols_embedding = None

        # ── 5. features 딕셔너리 구성 ──
        features = {
            "acoustic":         acoustic,           # 파킨슨용
            "raw_features":     raw_features,       # 치매용 (acoustic_cols 순서 보장)
            "hubert_embedding": hubert_embedding,   # 치매 HuBERT 임베딩
            "byols_embedding":  byols_embedding,    # 당뇨 BYOL-S 임베딩
        }

        result = engine.predict_all(features, user_info)

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

    rs  = result["data"]["risk_score"]
    pkn = float(rs["score_pkn"])
    dem = float(rs["score_dem"])
    dep = float(rs["score_dep"])
    dm  = float(rs["score_dm"])

    return {
        "parkinson":  {"score": pkn, "level": _score_to_level(pkn, "parkinson")},
        "dementia":   {"score": dem, "level": _score_to_level(dem, "dementia")},
        "depression": {"score": dep, "level": _score_to_level(dep, "depression")},
        "diabetes":   {"score": dm,  "level": _score_to_level(dm,  "diabetes")},
    }
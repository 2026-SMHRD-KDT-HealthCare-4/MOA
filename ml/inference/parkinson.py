"""
파킨슨 추론 모듈
단일 모델(모음 발성 1개 WAV 기준) — 가장 단순한 구조
"""
import numpy as np
import joblib

_model = None
_scaler = None
_feature_names = None
_mm_scaler = None
_selector = None  # Chi-Square selector (있는 경우)

MODEL_DIR = "models/parkinson"


def load_parkinson_models():
    global _model, _scaler, _feature_names, _mm_scaler, _selector
    _model = joblib.load(f"{MODEL_DIR}/model.pkl")
    _scaler = joblib.load(f"{MODEL_DIR}/scaler.pkl")
    _feature_names = joblib.load(f"{MODEL_DIR}/feature_names.pkl")
    try:
        _mm_scaler = joblib.load(f"{MODEL_DIR}/mm_scaler.pkl")
        _selector = joblib.load(f"{MODEL_DIR}/selector.pkl")
    except FileNotFoundError:
        # mm_scaler/selector를 따로 저장 안 했다면 feature_names로 바로 슬라이싱
        _mm_scaler, _selector = None, None
    print("✅ 파킨슨 모델 로드 완료")


def risk_level(prob: float) -> str:
    if prob > 0.7:
        return "고위험"
    elif prob > 0.4:
        return "중위험"
    return "저위험"


def predict_parkinson(raw_features: dict) -> dict:
    """
    raw_features: extract_all_acoustic_features()가 반환한 dict (전체 음향지표)
    저장된 feature_names 순서대로 벡터를 구성해 예측한다.
    """
    if _model is None:
        load_parkinson_models()

    vec = np.array([[raw_features.get(f, np.nan) for f in _feature_names]])
    vec = np.nan_to_num(vec, nan=0.0)

    vec_scaled = _scaler.transform(vec)
    prob = float(_model.predict_proba(vec_scaled)[0][1])
    label = int(prob >= 0.5)

    return {
        "disease": "parkinson",
        "prediction": "파킨슨 의심" if label == 1 else "정상",
        "probability": round(prob, 4),
        "risk_level": risk_level(prob),
    }

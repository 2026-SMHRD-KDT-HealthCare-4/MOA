"""
당뇨 추론 모듈
파이프라인: emb_scaler → pca → aux_scaler(있을때만) → hstack → scaler → model

⚠️ 파일명 자동 탐색: Drive에서 받은 파일을 이름 그대로 models/diabetes/에 넣으면 됩니다.
   (model_diabetes_female_catboost.pkl 처럼 베스트 모델 이름이 붙어있어도 자동으로 찾습니다)
"""
import glob
import numpy as np
import joblib
import os

MODEL_DIR = "models/diabetes"
_models = {}


def _find_file(*patterns) -> str:
    """models/diabetes/ 안에서 여러 이름 후보 중 실제로 존재하는 파일을 찾는다."""
    for pattern in patterns:
        matches = glob.glob(os.path.join(MODEL_DIR, pattern))
        if matches:
            return matches[0]
    raise FileNotFoundError(
        f"다음 패턴 중 일치하는 파일을 찾지 못했습니다: {patterns} (in {MODEL_DIR})"
    )


def load_diabetes_models():
    for gender in ["male", "female"]:
        # 모델 파일은 베스트 모델 이름이 붙어있을 수도, 없을 수도 있어 둘 다 시도
        model_path = _find_file(
            f"model_{gender}.pkl",
            f"model_diabetes_{gender}_*.pkl",
            f"model_diabetes_{gender}.pkl",
        )
        aux_scaler_candidates = glob.glob(os.path.join(MODEL_DIR, f"aux_scaler_{gender}.pkl")) \
            + glob.glob(os.path.join(MODEL_DIR, f"aux_scaler_diabetes_{gender}.pkl"))

        _models[gender] = {
            "model":      joblib.load(model_path),
            "emb_scaler": joblib.load(_find_file(f"emb_scaler_{gender}.pkl", f"emb_scaler_diabetes_{gender}.pkl")),
            "pca":        joblib.load(_find_file(f"pca_{gender}.pkl", f"pca_diabetes_{gender}.pkl")),
            "scaler":     joblib.load(_find_file(f"scaler_{gender}.pkl", f"scaler_diabetes_{gender}.pkl")),
            "aux_cols":   joblib.load(_find_file(f"aux_cols_{gender}.pkl", f"aux_cols_diabetes_{gender}.pkl")),
            "aux_scaler": joblib.load(aux_scaler_candidates[0]) if aux_scaler_candidates else None,
        }
        print(f"  ✅ [{gender}] 모델 파일: {os.path.basename(model_path)}")
    print("✅ 당뇨 모델 로드 완료 (남성/여성)")


def risk_level(prob: float) -> str:
    if prob > 0.7:
        return "고위험"
    elif prob > 0.4:
        return "중위험"
    return "저위험"


def predict_diabetes(byols_embedding: list, age: float, bmi: float, gender: str) -> dict:
    """
    byols_embedding: 길이 2048의 리스트 또는 numpy array (BYOL-S 임베딩)
    gender: "male" 또는 "female"
    """
    if not _models:
        load_diabetes_models()
    if gender not in ("male", "female"):
        return {"disease": "diabetes", "error": "gender는 'male' 또는 'female'이어야 합니다."}

    info = _models[gender]
    emb = np.array(byols_embedding).reshape(1, -1)
    emb_s = info["emb_scaler"].transform(emb)
    emb_pca = info["pca"].transform(emb_s)

    if info["aux_cols"] and info["aux_scaler"] is not None:
        aux = info["aux_scaler"].transform([[age, bmi]])
        X_new = np.hstack([emb_pca, aux])
    else:
        X_new = emb_pca

    X_final = info["scaler"].transform(X_new)
    prob = float(info["model"].predict_proba(X_final)[0][1])
    label = int(prob >= 0.5)

    result = {
        "disease": "diabetes",
        "prediction": "당뇨 의심" if label == 1 else "정상",
        "probability": round(prob, 4),
        "risk_level": risk_level(prob),
    }
    if gender == "male":
        result["note"] = "남성 모델은 검증 표본이 적어 결과를 참고용으로만 활용해주세요."
    return result


def predict_diabetes_from_wav(wav_path: str, age: float, bmi: float, gender: str) -> dict:
    """
    [신규] WAV 파일을 직접 받아 BYOL-S 임베딩 추출부터 예측까지 한 번에 처리.
    main.py의 /predict/diabetes 엔드포인트가 WAV를 직접 받을 수 있게 해주는 진입점.
    """
    from inference.byols_extraction import extract_byols_embedding

    embedding = extract_byols_embedding(wav_path)
    if embedding is None:
        return {
            "disease": "diabetes",
            "error": "BYOL-S 임베딩 추출에 실패했습니다. WAV 파일 형식을 확인해주세요.",
        }

    return predict_diabetes(embedding, age, bmi, gender)

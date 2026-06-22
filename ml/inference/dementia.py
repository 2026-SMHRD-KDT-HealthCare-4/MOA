"""
치매 추론 모듈
CTD / PFT / SFT 과제별 모델 + 화자단위 가중평균(BR 구조 내에서의 내부 앙상블)
사용자는 1개~3개 과제 중 가능한 만큼만 보내면 된다.
"""
import numpy as np
import joblib

from inference.hubert_extraction import extract_hubert_embedding

MODEL_DIR = "models/dementia"
TASKS = ["CTD", "PFT", "SFT"]

_task_models = {}      # {task: {"model":..., "scaler":..., "chi2_mask":..., "rfe_mask":...}}
_task_weights = {}
_acoustic_cols = None
_hubert_scaler = None
_hubert_pca = None
_hubert_cols = None
_use_hubert = True


def load_dementia_models():
    global _task_weights, _acoustic_cols, _hubert_scaler, _hubert_pca, _hubert_cols, _use_hubert

    _task_weights.update(joblib.load(f"{MODEL_DIR}/task_weights.pkl"))
    _acoustic_cols_local = joblib.load(f"{MODEL_DIR}/acoustic_cols.pkl")
    globals()["_acoustic_cols"] = _acoustic_cols_local

    for task in TASKS:
        try:
            _task_models[task] = {
                "model": joblib.load(f"{MODEL_DIR}/model_{task}.pkl"),
                "scaler": joblib.load(f"{MODEL_DIR}/scaler_{task}.pkl"),
                "chi2_mask": joblib.load(f"{MODEL_DIR}/chi2mask_{task}.pkl"),
                "rfe_mask": joblib.load(f"{MODEL_DIR}/rfemask_{task}.pkl"),
            }
        except FileNotFoundError:
            # 해당 과제 모델이 표본 부족으로 학습에서 제외됐을 수 있음 (STEP 8-1 참고)
            print(f"⚠️  [{task}] 모델 파일 없음 — 학습 시 제외된 과제로 추정, 스킵")

    try:
        globals()["_hubert_scaler"] = joblib.load(f"{MODEL_DIR}/hubert_scaler.pkl")
        globals()["_hubert_pca"] = joblib.load(f"{MODEL_DIR}/hubert_pca.pkl")
        globals()["_hubert_cols"] = joblib.load(f"{MODEL_DIR}/hubert_cols.pkl")
    except FileNotFoundError:
        globals()["_use_hubert"] = False
        print("⚠️  HuBERT 관련 파일 없음 — 음향지표만 사용")

    print(f"✅ 치매 모델 로드 완료 (과제: {list(_task_models.keys())})")


def risk_level(prob: float) -> str:
    if prob > 0.7:
        return "고위험"
    elif prob > 0.4:
        return "중위험"
    return "저위험"


def _build_feature_vector(raw_features: dict, wav_path: str) -> np.ndarray:
    """음향지표(+HuBERT-PCA)를 acoustic_cols 순서로 결합한 전체 특징 벡터"""
    acoustic_vec = np.array([raw_features.get(f, np.nan) for f in _acoustic_cols])
    acoustic_vec = np.nan_to_num(acoustic_vec, nan=0.0)

    if _use_hubert and _hubert_pca is not None:
        hub_f = extract_hubert_embedding(wav_path)
        hubert_vec_raw = np.array([[hub_f.get(f, np.nan) for f in _hubert_cols]])
        hubert_vec_raw = np.nan_to_num(hubert_vec_raw, nan=0.0)
        hubert_vec_scaled = _hubert_scaler.transform(hubert_vec_raw)
        hubert_vec_pca = _hubert_pca.transform(hubert_vec_scaled)[0]
        return np.concatenate([acoustic_vec, hubert_vec_pca]).reshape(1, -1)

    return acoustic_vec.reshape(1, -1)


def predict_dementia(wav_paths_by_task: dict, raw_features_by_task: dict) -> dict:
    """
    wav_paths_by_task:        {"CTD": "/tmp/ctd.wav", "PFT": "/tmp/pft.wav", ...}  (1개~3개)
    raw_features_by_task:     {"CTD": {...음향지표...}, ...}  (extract_all_acoustic_features 결과)
    제출된 과제만으로 예측 후 (AUC 가중) 평균해 최종 위험도를 낸다.
    """
    if not _task_models:
        load_dementia_models()

    entries = []
    for task, wav_path in wav_paths_by_task.items():
        if task not in _task_models:
            continue  # 학습되지 않은 과제는 스킵 (위에서 안내 출력됨)

        info = _task_models[task]
        full_vec = _build_feature_vector(raw_features_by_task[task], wav_path)
        vec_sel = full_vec[:, info["chi2_mask"]][:, info["rfe_mask"]]
        vec_scaled = info["scaler"].transform(vec_sel)

        prob = float(info["model"].predict_proba(vec_scaled)[0][1])
        weight = _task_weights.get(task, 1.0)
        entries.append((task, prob, weight))

    if not entries:
        return {
            "disease": "dementia",
            "error": "지원되는 과제(CTD/PFT/SFT)의 WAV가 없습니다. 최소 1개 과제 음성이 필요합니다.",
        }

    total_w = sum(w for _, _, w in entries)
    final_prob = sum(p * w for _, p, w in entries) / total_w if total_w > 0 else np.mean([p for _, p, _ in entries])
    label = int(final_prob >= 0.5)

    return {
        "disease": "dementia",
        "prediction": "MCI/Dementia 의심" if label == 1 else "HC (정상)",
        "probability": round(float(final_prob), 4),
        "risk_level": risk_level(final_prob),
        "task_details": {t: round(float(p), 4) for t, p, _ in entries},
        "tasks_used": [t for t, _, _ in entries],
    }

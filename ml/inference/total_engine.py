import os
import joblib
import numpy as np
import time


class MOAInferenceEngine:
    """
    MOA 통합 추론 엔진
    위치: MOA/MOA/ml/inference/total_engine.py

    수정 사항:
        1. 치매: task_feat(완성된 특징 벡터)를 백엔드가 직접 만들어 넘기던 구조 →
                 WAV 경로 + 음향지표만 받고 내부에서 HuBERT-PCA 합치기 처리
        2. 당뇨: byols_embedding(이미 추출된 벡터)를 받던 구조 →
                 WAV 경로를 직접 받아 내부에서 BYOL-S 임베딩 추출 후 예측
        → 파킨슨/치매/당뇨 모두 백엔드는 WAV 경로만 넘기면 된다.
    """

    def __init__(self):
        self.ml_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self.models = {
            "dementia": {},
            "diabetes": {"male": {}, "female": {}},
            "parkinson": {}
        }
        self.load_all_models()

    def load_all_models(self):
        print(f"🔄 모델 로딩 시작 (경로: {self.ml_root})...")

        # 1. 치매 모델
        dem_dir = os.path.join(self.ml_root, "dementia")
        for task in ["CTD", "PFT", "SFT"]:
            try:
                self.models["dementia"][task] = {
                    "model":    joblib.load(os.path.join(dem_dir, f"model_{task}.pkl")),
                    "scaler":   joblib.load(os.path.join(dem_dir, f"scaler_{task}.pkl")),
                    "chi2mask": joblib.load(os.path.join(dem_dir, f"chi2mask_{task}.pkl")),
                    "rfemask":  joblib.load(os.path.join(dem_dir, f"rfemask_{task}.pkl")),
                }
            except Exception:
                pass

        # 치매 특징 합치기에 필요한 부가 파일
        try:
            self._dem_acoustic_cols = joblib.load(os.path.join(dem_dir, "acoustic_cols.pkl"))
            self._dem_task_weights  = joblib.load(os.path.join(dem_dir, "task_weights.pkl"))
        except Exception as e:
            print(f"⚠️ 치매 보조 파일 로드 실패: {e}")
            self._dem_acoustic_cols = None
            self._dem_task_weights  = {}

        # HuBERT PCA 관련 (없으면 음향지표만 사용)
        try:
            self._dem_hubert_scaler = joblib.load(os.path.join(dem_dir, "hubert_scaler.pkl"))
            self._dem_hubert_pca    = joblib.load(os.path.join(dem_dir, "hubert_pca.pkl"))
            self._dem_hubert_cols   = joblib.load(os.path.join(dem_dir, "hubert_cols.pkl"))
            self._use_hubert = True
        except Exception:
            self._dem_hubert_scaler = None
            self._dem_hubert_pca    = None
            self._dem_hubert_cols   = None
            self._use_hubert = False
            print("⚠️ HuBERT 관련 파일 없음 — 음향지표만 사용")

        # 2. 당뇨 모델
        diab_dir = os.path.join(self.ml_root, "diabetes")
        for gender in ["male", "female"]:
            try:
                self.models["diabetes"][gender] = {
                    "model":      joblib.load(os.path.join(diab_dir, f"model_{gender}.pkl")),
                    "emb_scaler": joblib.load(os.path.join(diab_dir, f"emb_scaler_{gender}.pkl")),
                    "pca":        joblib.load(os.path.join(diab_dir, f"pca_{gender}.pkl")),
                    "scaler":     joblib.load(os.path.join(diab_dir, f"scaler_{gender}.pkl")),
                    "aux_scaler": joblib.load(os.path.join(diab_dir, f"aux_scaler_{gender}.pkl"))
                                  if os.path.exists(os.path.join(diab_dir, f"aux_scaler_{gender}.pkl")) else None,
                }
            except Exception:
                pass

        # 3. 파킨슨 모델
        pkn_dir = os.path.join(self.ml_root, "parkinson")
        try:
            self.models["parkinson"] = {
                "model":         joblib.load(os.path.join(pkn_dir, "model.pkl")),
                "scaler":        joblib.load(os.path.join(pkn_dir, "scaler.pkl")),
                "selector":      joblib.load(os.path.join(pkn_dir, "selector.pkl"))
                                 if os.path.exists(os.path.join(pkn_dir, "selector.pkl")) else None,
                "feature_names": joblib.load(os.path.join(pkn_dir, "feature_names.pkl"))
                                 if os.path.exists(os.path.join(pkn_dir, "feature_names.pkl")) else None,
            }
        except Exception as e:
            print(f"⚠️ 파킨슨 모델 로드 실패: {e}")

        print("✅ 모든 모델 로드 완료")

    # ──────────────────────────────────────────────────────────────
    # predict_all
    # 백엔드 호출 인터페이스
    #
    # features = {
    #   "acoustic":        {...},           # 파킨슨용 음향지표 dict
    #   "wav_paths":       {"CTD": "..."},  # 치매용 WAV 경로 dict  ← 수정
    #   "raw_features":    {"CTD": {...}},  # 치매용 음향지표 dict  ← 수정
    #   "diabetes_wav": "/tmp/xxx.wav",     # 당뇨용 WAV 경로 ← 수정 (임베딩 대신 WAV)
    # }
    # user_info = {"gender": "M"/"F", "age": 55, "bmi": 27.3}
    # ──────────────────────────────────────────────────────────────
    def predict_all(self, features, user_info):
        start_time = time.time()

        score_pkn = self._predict_parkinson(features.get("acoustic"))
        score_dem = self._predict_dementia(
            wav_paths_by_task   = features.get("wav_paths", {}),    # ← 수정
            raw_features_by_task = features.get("raw_features", {}), # ← 수정
        )
        score_dm  = self._predict_diabetes(features.get("diabetes_wav"), user_info)  # ← 수정

        max_score    = max(score_pkn, score_dem, score_dm)
        inference_ms = int((time.time() - start_time) * 1000)

        return {
            "success": True,
            "data": {
                "risk_score": {
                    "score_pkn": round(float(score_pkn), 4),
                    "score_dem": round(float(score_dem), 4),
                    "score_dm":  round(float(score_dm),  4),
                    "score_dep": 0.0,
                    "overall_risk_level": (
                        "AMBER" if max_score >= 0.7 else
                        ("YELLOW" if max_score >= 0.4 else "GREEN")
                    ),
                },
                "model_metadata": {
                    "inference_ms": inference_ms,
                    "model_version": "MOA-Combined-v1",
                },
            },
        }

    # ──────────────────────────────────────────────────────────────
    # 파킨슨 (기존과 동일)
    # ──────────────────────────────────────────────────────────────
    def _predict_parkinson(self, acoustic_dict):
        if not self.models.get("parkinson") or not acoustic_dict:
            return 0.0

        info            = self.models["parkinson"]
        ordered_features = list(acoustic_dict.values())
        X               = np.array(ordered_features).reshape(1, -1)

        if info["selector"]:
            X = info["selector"].transform(X)
        X_s  = info["scaler"].transform(X)
        prob = float(info["model"].predict_proba(X_s)[0, 1])
        return prob

    # ──────────────────────────────────────────────────────────────
    # 치매 (수정)
    # 기존: 완성된 특징 벡터 f를 백엔드가 직접 만들어 넘겨야 했음
    # 수정: WAV 경로 + 음향지표만 받고, HuBERT-PCA 합치기를 내부에서 처리
    # ──────────────────────────────────────────────────────────────
    def _build_dementia_feature_vector(self, raw_features: dict, wav_path: str) -> np.ndarray:
        """음향지표 + HuBERT-PCA를 acoustic_cols 순서로 결합"""
        acoustic_vec = np.array(
            [raw_features.get(col, np.nan) for col in self._dem_acoustic_cols]
        )
        acoustic_vec = np.nan_to_num(acoustic_vec, nan=0.0)

        if self._use_hubert and self._dem_hubert_pca is not None:
            from inference.hubert_extraction import extract_hubert_embedding

            hub_f          = extract_hubert_embedding(wav_path)
            hubert_vec_raw = np.array(
                [[hub_f.get(col, np.nan) for col in self._dem_hubert_cols]]
            )
            hubert_vec_raw    = np.nan_to_num(hubert_vec_raw, nan=0.0)
            hubert_vec_scaled = self._dem_hubert_scaler.transform(hubert_vec_raw)
            hubert_vec_pca    = self._dem_hubert_pca.transform(hubert_vec_scaled)[0]
            return np.concatenate([acoustic_vec, hubert_vec_pca]).reshape(1, -1)

        return acoustic_vec.reshape(1, -1)

    def _predict_dementia(self, wav_paths_by_task: dict, raw_features_by_task: dict) -> float:
        """
        wav_paths_by_task    : {"CTD": "/tmp/ctd.wav", ...}   (1개~3개)
        raw_features_by_task : {"CTD": {...음향지표...}, ...}
        → 제출된 과제만으로 예측 후 AUC 가중 평균해 최종 확률 반환
        """
        if not wav_paths_by_task or self._dem_acoustic_cols is None:
            return 0.0

        entries = []
        for task, wav_path in wav_paths_by_task.items():
            if task not in self.models["dementia"]:
                continue

            info     = self.models["dementia"][task]
            full_vec = self._build_dementia_feature_vector(
                raw_features_by_task.get(task, {}), wav_path
            )

            # chi2 → rfe 마스크 적용
            vec_sel    = full_vec[:, info["chi2mask"]][:, info["rfemask"]]
            vec_scaled = info["scaler"].transform(vec_sel)
            prob       = float(info["model"].predict_proba(vec_scaled)[0][1])
            weight     = self._dem_task_weights.get(task, 1.0)
            entries.append((task, prob, weight))

        if not entries:
            return 0.0

        total_w    = sum(w for _, _, w in entries)
        final_prob = (
            sum(p * w for _, p, w in entries) / total_w
            if total_w > 0
            else np.mean([p for _, p, _ in entries])
        )
        return float(final_prob)

    # ──────────────────────────────────────────────────────────────
    # 당뇨 (수정)
    # 기존: byols_embedding(이미 추출된 2048차원 벡터)을 받던 구조
    # 수정: WAV 경로를 받아 내부에서 BYOL-S 임베딩 추출 후 예측
    # ──────────────────────────────────────────────────────────────
    def _predict_diabetes(self, wav_path: str, user: dict) -> float:
        """
        wav_path : 당뇨용 WAV 파일 경로 (str)
        user     : {"gender": "M"/"F", "age": 55, "bmi": 27.3}
        """
        g = "male" if user.get("gender") == "M" else "female"
        if not self.models["diabetes"].get(g) or not wav_path:
            return 0.0

        # WAV → BYOL-S/CvT 임베딩 추출 (내부에서 처리)
        from inference.byols_extraction import extract_byols_embedding
        emb = extract_byols_embedding(wav_path)
        if emb is None:
            return 0.0

        info  = self.models["diabetes"][g]
        X     = info["pca"].transform(
                    info["emb_scaler"].transform(emb.reshape(1, -1))
                )
        if info["aux_scaler"]:
            X = np.hstack([
                X,
                info["aux_scaler"].transform([[user.get("age", 0), user.get("bmi", 0)]])
            ])
        return float(info["model"].predict_proba(info["scaler"].transform(X))[0, 1])

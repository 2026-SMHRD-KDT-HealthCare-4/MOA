import os
import joblib
import numpy as np
import time


class MOAInferenceEngine:
    """
    MOA 통합 추론 엔진
    위치: MOA/MOA/ml/inference/total_engine.py
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
                print(f"  ✅ 치매 {task} 로드 완료")
            except Exception as e:
                print(f"  ⚠️ 치매 {task} 로드 실패: {e}")

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
            aux_path = os.path.join(diab_dir, f"aux_scaler_{gender}.pkl")
            try:
                self.models["diabetes"][gender] = {
                    "model":      joblib.load(os.path.join(diab_dir, f"model_{gender}.pkl")),
                    "emb_scaler": joblib.load(os.path.join(diab_dir, f"emb_scaler_{gender}.pkl")),
                    "pca":        joblib.load(os.path.join(diab_dir, f"pca_{gender}.pkl")),
                    "scaler":     joblib.load(os.path.join(diab_dir, f"scaler_{gender}.pkl")),
                    "aux_scaler": joblib.load(aux_path) if os.path.exists(aux_path) else None,
                }
                print(f"  ✅ 당뇨 {gender} 로드 완료")
            except Exception as e:
                print(f"  ⚠️ 당뇨 {gender} 로드 실패: {e}")

        # 3. 파킨슨 모델
        pkn_dir   = os.path.join(self.ml_root, "parkinson")
        sel_path  = os.path.join(pkn_dir, "selector.pkl")
        feat_path = os.path.join(pkn_dir, "feature_names.pkl")
        try:
            self.models["parkinson"] = {
                "model":         joblib.load(os.path.join(pkn_dir, "model.pkl")),
                "scaler":        joblib.load(os.path.join(pkn_dir, "scaler.pkl")),
                "selector":      joblib.load(sel_path)  if os.path.exists(sel_path)  else None,
                "feature_names": joblib.load(feat_path) if os.path.exists(feat_path) else None,
            }
            print("  ✅ 파킨슨 로드 완료")
        except Exception as e:
            print(f"  ⚠️ 파킨슨 모델 로드 실패: {e}")

        print("✅ 모든 모델 로드 완료")

    def predict_all(self, features: dict, user_info: dict) -> dict:
        start_time = time.time()

        score_pkn = self._predict_parkinson(features.get("acoustic"))
        score_dem = self._predict_dementia(
            wav_paths_by_task    = features.get("wav_paths", {}),
            raw_features_by_task = features.get("raw_features", {}),
        )
        score_dm  = self._predict_diabetes(features.get("diabetes_wav"), user_info)

        max_score    = max(score_pkn, score_dem, score_dm)
        inference_ms = int((time.time() - start_time) * 1000)

        if max_score >= 0.7:
            risk_level = "AMBER"
        elif max_score >= 0.4:
            risk_level = "YELLOW"
        else:
            risk_level = "GREEN"

        return {
            "success": True,
            "data": {
                "risk_score": {
                    "score_pkn":          round(float(score_pkn), 4),
                    "score_dem":          round(float(score_dem), 4),
                    "score_dm":           round(float(score_dm),  4),
                    "score_dep":          0.0,
                    "overall_risk_level": risk_level,
                },
                "model_metadata": {
                    "inference_ms": inference_ms,
                    "model_version": "MOA-Combined-v1",
                },
            },
        }

    def _predict_parkinson(self, acoustic_dict: dict) -> float:
        info = self.models.get("parkinson")
        if not info or not acoustic_dict:
            return 0.0

        # feature_names 22개 키 순서대로 정확히 추출
        if info["feature_names"]:
            ordered = [float(acoustic_dict.get(k, 0.0)) for k in info["feature_names"]]
        else:
            ordered = list(acoustic_dict.values())

        X = np.array(ordered, dtype=float).reshape(1, -1)

        if info["selector"] is not None:
            X = info["selector"].transform(X)

        X_s  = info["scaler"].transform(X)
        prob = float(info["model"].predict_proba(X_s)[0, 1])
        return prob

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

    def _predict_diabetes(self, wav_path: str, user: dict) -> float:
        g = "male" if user.get("gender") == "M" else "female"
        if not self.models["diabetes"].get(g) or not wav_path:
            return 0.0

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
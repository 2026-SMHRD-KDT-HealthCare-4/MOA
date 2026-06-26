import os
import joblib
import numpy as np
import time


class MOAInferenceEngine:
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
                    "model":         joblib.load(os.path.join(dem_dir, f"model_{task}.pkl")),
                    "scaler":        joblib.load(os.path.join(dem_dir, f"scaler_{task}.pkl")),
                    "chi2mask":      joblib.load(os.path.join(dem_dir, f"chi2mask_{task}.pkl")),
                    "rfemask":       joblib.load(os.path.join(dem_dir, f"rfemask_{task}.pkl")),
                    "acoustic_cols": joblib.load(os.path.join(dem_dir, "acoustic_cols.pkl")),
                    "hubert_scaler": joblib.load(os.path.join(dem_dir, "hubert_scaler.pkl")),
                    "hubert_pca":    joblib.load(os.path.join(dem_dir, "hubert_pca.pkl")),
                    "hubert_cols":   joblib.load(os.path.join(dem_dir, "hubert_cols.pkl")),
                }
                print(f"  ✅ 치매 {task} 로드 완료")
            except Exception as e:
                print(f"  ⚠️ 치매 {task} 로드 실패: {e}")

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
        mm_path   = os.path.join(pkn_dir, "mm_scaler.pkl")
        try:
            self.models["parkinson"] = {
                "model":         joblib.load(os.path.join(pkn_dir, "model.pkl")),
                "scaler":        joblib.load(os.path.join(pkn_dir, "scaler.pkl")),
                "mm_scaler":     joblib.load(mm_path) if os.path.exists(mm_path) else None,
                "selector":      joblib.load(sel_path)  if os.path.exists(sel_path)  else None,
                "feature_names": joblib.load(feat_path) if os.path.exists(feat_path) else None,
            }
            print("  ✅ 파킨슨 로드 완료")
        except Exception as e:
            print(f"  ⚠️ 파킨슨 모델 로드 실패: {e}")

        print("✅ 모든 모델 로드 완료")

    # ──────────────────────────────────────────────────────────────
    def predict_all(self, features: dict, user_info: dict) -> dict:
        start_time = time.time()

        score_pkn = self._predict_parkinson(features.get("acoustic"))
        score_dem = 1.0 - self._predict_dementia(
            features.get("raw_features", {}),
            features.get("hubert_embedding"),
        )
        score_dm  = self._predict_diabetes(features.get("byols_embedding"), user_info)

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

    # ──────────────────────────────────────────────────────────────
    def _predict_parkinson(self, acoustic_dict: dict) -> float:
        info = self.models.get("parkinson")
        if not info or not acoustic_dict:
            return 0.0

        ordered = list(acoustic_dict.values())

        if info["selector"] is not None:
            expected = info["selector"].n_features_in_
            if len(ordered) > expected:
                ordered = ordered[:expected]
            elif len(ordered) < expected:
                ordered = ordered + [0.0] * (expected - len(ordered))

        X = np.array(ordered, dtype=float).reshape(1, -1)

        if info["mm_scaler"] is not None:
            X = info["mm_scaler"].transform(X)

        if info["selector"] is not None:
            X = info["selector"].transform(X)

        X_s  = info["scaler"].transform(X)
        prob = float(info["model"].predict_proba(X_s)[0, 1])
        return prob

    # ──────────────────────────────────────────────────────────────
    def _predict_dementia(self, task_feat: dict, hubert_raw=None) -> float:
        """
        task_feat  : {"CTD": acoustic_list, ...}
        hubert_raw : HuBERT 원시 임베딩 배열 (ml_inference.py 에서 추출해서 넘김)
        """
        if not task_feat:
            return 0.0

        probs = []
        for task, feat in task_feat.items():
            if task not in self.models["dementia"]:
                continue
            info = self.models["dementia"][task]

            # 음향지표 벡터
            if isinstance(feat, dict):
                acoustic_cols = info.get("acoustic_cols", [])
                if acoustic_cols:
                    acoustic_vec = [
                        float(feat.get(c, 0.0)) if feat.get(c) is not None else 0.0
                        for c in acoustic_cols
                    ]
                else:
                    acoustic_vec = list(feat.values())
            else:
                acoustic_vec = list(feat)

            X_acoustic = np.array(acoustic_vec, dtype=float).reshape(1, -1)

            # HuBERT-PCA 벡터
            chi2_len = len(info["chi2mask"])

            if hubert_raw is not None:
                try:
                    H = np.array(hubert_raw, dtype=float).reshape(1, -1)
                    H = info["hubert_scaler"].transform(H)
                    H = info["hubert_pca"].transform(H)

                    hubert_cols = info.get("hubert_cols", [])
                    if len(hubert_cols) > 0 and H.shape[1] > len(hubert_cols):
                        H = H[:, :len(hubert_cols)]

                    X = np.hstack([X_acoustic, H])
                except Exception as e:
                    print(f"⚠️ 치매 {task} HuBERT 처리 실패: {e} — 음향지표만 사용")
                    X = X_acoustic
            else:
                print(f"⚠️ 치매 {task}: HuBERT 임베딩 없음 — 음향지표만 사용")
                X = X_acoustic

            # chi2mask → rfemask → scaler → model
            if X.shape[1] < chi2_len:
                X = np.hstack([X, np.zeros((1, chi2_len - X.shape[1]))])
            elif X.shape[1] > chi2_len:
                X = X[:, :chi2_len]

            X = X[:, info["chi2mask"]]
            X = X[:, info["rfemask"]]

            X_s  = info["scaler"].transform(X)
            prob = float(info["model"].predict_proba(X_s)[0, 1])
            probs.append(prob)

        return float(np.mean(probs)) if probs else 0.0

    # ──────────────────────────────────────────────────────────────
    def _predict_diabetes(self, emb, user: dict) -> float:
        gender = "male" if user.get("gender") == "M" else "female"
        info   = self.models["diabetes"].get(gender)
        if not info or emb is None:
            return 0.0

        X = np.array(emb, dtype=float).reshape(1, -1)
        X = info["emb_scaler"].transform(X)
        X = info["pca"].transform(X)

        if info["aux_scaler"] is not None:
            age = user.get("age", 0)
            bmi = user.get("bmi", 0)
            aux = info["aux_scaler"].transform([[age, bmi]])
            X   = np.hstack([X, aux])

        X_s  = info["scaler"].transform(X)
        prob = float(info["model"].predict_proba(X_s)[0, 1])
        return prob
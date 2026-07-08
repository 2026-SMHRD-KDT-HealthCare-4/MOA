import os
import pickle
import joblib
import numpy as np
import time
import zipfile


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
        self._ensure_dementia_models_unpacked(dem_dir)
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

        # 3. 파킨슨 모델 (v5 번들)
        pkn_dir = os.path.join(self.ml_root, "parkinson")
        try:
            with open(os.path.join(pkn_dir, "parkinson_model_v5.pkl"), 'rb') as f:
                bundle = pickle.load(f)
            self.models["parkinson"] = bundle
            print("  ✅ 파킨슨 로드 완료 (v5)")
        except Exception as e:
            print(f"  ⚠️ 파킨슨 모델 로드 실패: {e}")

        print("✅ 모든 모델 로드 완료")

    # ──────────────────────────────────────────────────────────────
    # ──────────────────────────────────────────────────────────────
    def _ensure_dementia_models_unpacked(self, dem_dir: str) -> None:
        required = [
            "model_CTD.pkl",
            "scaler_CTD.pkl",
            "chi2mask_CTD.pkl",
            "rfemask_CTD.pkl",
            "acoustic_cols.pkl",
            "hubert_scaler.pkl",
            "hubert_pca.pkl",
            "hubert_cols.pkl",
        ]
        if all(os.path.exists(os.path.join(dem_dir, name)) for name in required):
            return

        zip_path = os.path.join(dem_dir, "dementia.zip")
        if not os.path.exists(zip_path):
            print(f"  dementia.zip not found: {zip_path}")
            return

        try:
            os.makedirs(dem_dir, exist_ok=True)
            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(dem_dir)
            print(f"  dementia.zip unpacked: {zip_path}")
        except Exception as e:
            print(f"  dementia.zip unpack failed: {e}")

    def predict_all(self, features: dict, user_info: dict, sample_type: str = None) -> dict:
        start_time = time.time()

        wav_path = features.get("wav_path")

        if sample_type == "sustained_vowel":
            # 지속모음 발성 → 파킨슨만 유효
            score_pkn = self._predict_parkinson(features.get("acoustic"), wav_path)
            score_dem = 0.0
            score_dm  = 0.0
        else:
            # 자유발화/일반대화 → 치매·당뇨만 유효
            score_pkn = 0.0
            score_dem = self._predict_dementia(
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
                    "overall_risk_level": risk_level,
                },
                "model_metadata": {
                    "inference_ms": inference_ms,
                    "model_version": "MOA-Combined-v1",
                },
            },
        }

    # ──────────────────────────────────────────────────────────────
    def _predict_parkinson(self, acoustic_dict: dict, wav_path: str) -> float:
        bundle = self.models.get("parkinson")
        if not bundle or not acoustic_dict or not wav_path:
            return 0.0

        try:
            all_feature_names = bundle['all_feature_names']
            selected_mask     = bundle['selected_mask']
            final_scaler      = bundle['final_scaler']
            hubert_scaler     = bundle['hubert_scaler']
            hubert_pca        = bundle['hubert_pca']
            model             = bundle['model']

            # 1. HuBERT 추출 → PCA 축소
            from inference.hubert_extraction import extract_hubert_embedding
            hubert_raw = extract_hubert_embedding(wav_path)
            hubert_vec = np.array(
                [[hubert_raw.get(f'hubert_{i}', 0.0) for i in range(768)]]
            )
            hubert_vec     = np.nan_to_num(hubert_vec, nan=0.0)
            hubert_scaled  = hubert_scaler.transform(hubert_vec)
            hubert_pca_vec = hubert_pca.transform(hubert_scaled)  # (1, 32)

            # 2. 음향지표 이름 (hubert_ 원시 및 hubert_pca_ 제외)
            # 2. 음향지표 이름 (hubert_ 원시 및 hubert_pca_ 제외)
            acoustic_names = [f for f in all_feature_names
                              if not f.startswith('hubert_')
                              and not f.startswith('hubert_pca_')]
            n_pca     = hubert_pca_vec.shape[1]
            pca_names = [f'hubert_pca_{i}' for i in range(n_pca)]

            # 3. feat_map으로 all_feature_names 순서 보장
            feat_map = {}
            for name in acoustic_names:
               feat_map[name] = float(acoustic_dict.get(name, 0.0))
            # 디버그: 누락 feature 확인
            zero_count = sum(1 for name in acoustic_names if acoustic_dict.get(name) is None)
            print(f"🔍 파킨슨 feature 매핑: 전체 {len(acoustic_names)}개 중 {zero_count}개 누락")
            print(f"🔍 누락 목록: {[name for name in acoustic_names if acoustic_dict.get(name) is None][:10]}")
            # raw HuBERT 추가
            for i in range(768):
                feat_map[f'hubert_{i}'] = float(hubert_vec[0, i])
            for i, name in enumerate(pca_names):
                feat_map[name] = float(hubert_pca_vec[0, i])

            full_vec = np.array(
                [[feat_map.get(f, 0.0) for f in all_feature_names]]
            )  # shape: (1, 954)

            # 4. selected_mask → StandardScaler → 예측
            full_vec_sel = full_vec[:, selected_mask]
            vec_scaled   = final_scaler.transform(full_vec_sel)

            return float(model.predict_proba(vec_scaled)[0, 1])

        except Exception as e:
            print(f"⚠️ 파킨슨 추론 실패: {e}")
            return 0.0

    # ──────────────────────────────────────────────────────────────
    def _predict_dementia(self, task_feat: dict, hubert_raw=None) -> float:
        if not task_feat:
            return 0.0

        probs = []
        for task, feat in task_feat.items():
            if task not in self.models["dementia"]:
                continue
            info = self.models["dementia"][task]

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
            chi2_len   = len(info["chi2mask"])

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

            if X.shape[1] < chi2_len:
                X = np.hstack([X, np.zeros((1, chi2_len - X.shape[1]))])
            elif X.shape[1] > chi2_len:
                X = X[:, :chi2_len]

            X    = X[:, info["chi2mask"]]
            X    = X[:, info["rfemask"]]
            X_s  = info["scaler"].transform(X)
            print(f"🔍 치매 {task} 스케일링벡터: {X_s[0][:10].tolist()}")
            prob = float(info["model"].predict_proba(X_s)[0, 1])
            print(f"🔍 치매 {task} 확률(raw): {prob}")
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

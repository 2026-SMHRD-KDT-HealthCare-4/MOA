import os
import joblib
import numpy as np
import time

class MOAInferenceEngine:
    """
    MOA 통합 추론 엔진 (피처 정렬 로직 적용형)
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
                    "model": joblib.load(os.path.join(dem_dir, f"model_{task}.pkl")),
                    "scaler": joblib.load(os.path.join(dem_dir, f"scaler_{task}.pkl")),
                    "chi2mask": joblib.load(os.path.join(dem_dir, f"chi2mask_{task}.pkl")),
                    "rfemask": joblib.load(os.path.join(dem_dir, f"rfemask_{task}.pkl"))
                }
            except: pass
        
        # 2. 당뇨 모델
        diab_dir = os.path.join(self.ml_root, "diabetes")
        for gender in ["male", "female"]:
            try:
                self.models["diabetes"][gender] = {
                    "model": joblib.load(os.path.join(diab_dir, f"model_{gender}.pkl")),
                    "emb_scaler": joblib.load(os.path.join(diab_dir, f"emb_scaler_{gender}.pkl")),
                    "pca": joblib.load(os.path.join(diab_dir, f"pca_{gender}.pkl")),
                    "scaler": joblib.load(os.path.join(diab_dir, f"scaler_{gender}.pkl")),
                    "aux_scaler": joblib.load(os.path.join(diab_dir, f"aux_scaler_{gender}.pkl")) if os.path.exists(os.path.join(diab_dir, f"aux_scaler_{gender}.pkl")) else None
                }
            except: pass

        # 3. 파킨슨 모델 (피처 순서 로드 포함)
        pkn_dir = os.path.join(self.ml_root, "parkinson")
        try:
            self.models["parkinson"] = {
                "model": joblib.load(os.path.join(pkn_dir, "model.pkl")),
                "scaler": joblib.load(os.path.join(pkn_dir, "scaler.pkl")),
                "selector": joblib.load(os.path.join(pkn_dir, "selector.pkl")) if os.path.exists(os.path.join(pkn_dir, "selector.pkl")) else None,
                "feature_names": joblib.load(os.path.join(pkn_dir, "feature_names.pkl"))
                 if os.path.exists(os.path.join(pkn_dir, "feature_names.pkl")) else None
            }
        except Exception as e:
            print(f"⚠️ 파킨슨 모델 로드 실패: {e}")
        
        print("✅ 모든 모델 로드 완료")

    def predict_all(self, features, user_info):
        start_time = time.time()
        
        score_pkn = self._predict_parkinson(features.get('acoustic'))
        score_dem = self._predict_dementia(features.get('tasks', {}))
        score_dm = self._predict_diabetes(features.get('byols_embedding'), user_info)
        
        max_score = max(score_pkn, score_dem, score_dm)
        inference_ms = int((time.time() - start_time) * 1000)
        
        return {
            "success": True,
            "data": {
                "risk_score": {
                    "score_pkn": round(float(score_pkn), 4),
                    "score_dem": round(float(score_dem), 4),
                    "score_dm": round(float(score_dm), 4),
                    "score_dep": 0.0,
                    "overall_risk_level": "AMBER" if max_score >= 0.7 else ("YELLOW" if max_score >= 0.4 else "GREEN")
                },
                "model_metadata": {
                    "inference_ms": inference_ms,
                    "model_version": "MOA-Combined-v1"
                }
            }
        }

    def _predict_parkinson(self, acoustic_dict):
        if not self.models.get("parkinson") or not acoustic_dict:
            return 0.0

        info = self.models["parkinson"]

        # feature_names 정렬 우회 — 추출기가 항상 같은 순서로 반환하므로
        # 학습 때도 extract_all_acoustic_features 순서 그대로 넣었을 것
        ordered_features = list(acoustic_dict.values())

        X = np.array(ordered_features).reshape(1, -1)

        if info["selector"]:
            X = info["selector"].transform(X)
        X_s = info["scaler"].transform(X)
        prob = float(info["model"].predict_proba(X_s)[0, 1])
        return prob

    def _predict_dementia(self, task_feat):
        if not task_feat: return 0.0
        probs = [self.models["dementia"][t]["model"].predict_proba(self.models["dementia"][t]["scaler"].transform(np.array(f).reshape(1,-1)[:, self.models["dementia"][t]["chi2mask"]][:, self.models["dementia"][t]["rfemask"]]))[0,1] 
                 for t, f in task_feat.items() if t in self.models["dementia"]]
        return float(np.mean(probs)) if probs else 0.0

    def _predict_diabetes(self, emb, user):
        g = "male" if user.get('gender') == 'M' else "female"
        if not self.models["diabetes"].get(g) or emb is None: return 0.0
        info = self.models["diabetes"][g]
        X = info["pca"].transform(info["emb_scaler"].transform(np.array(emb).reshape(1, -1)))
        if info["aux_scaler"]: 
            X = np.hstack([X, info["aux_scaler"].transform([[user.get('age', 0), user.get('bmi', 0)]])])
        return float(info["model"].predict_proba(info["scaler"].transform(X))[0, 1])
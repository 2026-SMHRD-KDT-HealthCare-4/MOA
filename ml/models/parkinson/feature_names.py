"""
feature_names.pkl 재생성 스크립트
위치: MOA/ml/inference/ 에서 실행

현재 feature_names.pkl 에 Parselmouth 22개만 들어있어서
selector(157개 기대)와 불일치 → 이 스크립트로 157개 전체로 교체한다.

실행법:
  cd MOA/ml/inference
  python fix_feature_names.py
"""

import os
import sys
import joblib

# 이 스크립트가 있는 위치(inference/)를 기준으로 경로 설정
_INFERENCE_DIR = os.path.dirname(os.path.abspath(__file__))
_ML_DIR        = os.path.dirname(_INFERENCE_DIR)
_PKN_DIR       = os.path.join(_ML_DIR, "models", "parkinson")

# feature_extraction 임포트
if _INFERENCE_DIR not in sys.path:
    sys.path.insert(0, _INFERENCE_DIR)

import feature_extraction as _fe

# ── 1. 실제 WAV로 157개 키 순서 확인 ────────────────────────────────────────
# 아무 WAV 파일 경로를 넣으면 된다 (내용 무관, 키 이름만 필요)
SAMPLE_WAV = input("샘플 WAV 파일 경로를 입력하세요 (아무 wav): ").strip().strip('"')

if not os.path.isfile(SAMPLE_WAV):
    print(f"❌ 파일 없음: {SAMPLE_WAV}")
    sys.exit(1)

acoustic = _fe.extract_all_acoustic_features(SAMPLE_WAV)
feature_names_157 = list(acoustic.keys())

print(f"\n추출된 피처 수: {len(feature_names_157)}")
print(f"앞 5개: {feature_names_157[:5]}")
print(f"뒤 5개: {feature_names_157[-5:]}")

# ── 2. 현재 feature_names.pkl 백업 ──────────────────────────────────────────
pkl_path    = os.path.join(_PKN_DIR, "feature_names.pkl")
backup_path = os.path.join(_PKN_DIR, "feature_names_backup_22.pkl")

if os.path.isfile(pkl_path):
    old = joblib.load(pkl_path)
    joblib.dump(old, backup_path)
    print(f"\n기존 feature_names.pkl 백업 완료 → {backup_path}  (기존 개수: {len(old)})")

# ── 3. 새 feature_names.pkl 저장 ────────────────────────────────────────────
joblib.dump(feature_names_157, pkl_path)
print(f"✅ feature_names.pkl 갱신 완료 → {len(feature_names_157)}개  ({pkl_path})")

# ── 4. selector 입력 차원 교차 확인 ─────────────────────────────────────────
selector_path = os.path.join(_PKN_DIR, "selector.pkl")
if os.path.isfile(selector_path):
    sel = joblib.load(selector_path)
    if hasattr(sel, "n_features_in_"):
        n_in = sel.n_features_in_
        match = "✅ 일치" if n_in == len(feature_names_157) else f"❌ 불일치 (selector={n_in}, 피처={len(feature_names_157)})"
        print(f"\nselector.n_features_in_ = {n_in}  →  {match}")
    else:
        print("\nselector에 n_features_in_ 속성 없음 (구버전 sklearn일 수 있음)")
else:
    print("\nselector.pkl 없음 — 건너뜀")

print("\n서버 재시작 후 /analyze 재시도하세요.")

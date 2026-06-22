# 팀 모아 음성 스크리닝 FastAPI 서버

## 1차 배포 범위
- ✅ 파킨슨 (AUC 0.82)
- ✅ 치매 (AUC 0.83, CTD/PFT/SFT 과제별 모델 + 화자단위 가중평균)
- ✅ 당뇨 — 여성(AUC 0.893) / 남성(AUC 0.703, 조건부)

## 2차 추가 예정 (현재 미포함)
- ⏳ ALS — 결과 확인 후 추가
- ⏳ 우울증 — AUC 계산 버그 수정 후 추가

---

## 폴더 구조
```
fastapi_server/
├── main.py                      # FastAPI 앱 진입점
├── requirements.txt
├── inference/
│   ├── feature_extraction.py    # 공통 음향지표 추출 (Parselmouth/Librosa/openSMILE)
│   ├── hubert_extraction.py     # HuBERT 임베딩 추출 (치매에서 사용)
│   ├── parkinson.py             # 파킨슨 추론 로직
│   ├── dementia.py              # 치매 추론 로직 (과제별 + 화자단위 앙상블)
│   └── diabetes.py              # 당뇨 추론 로직 (남/여 분리, BYOL-S 임베딩 입력)
└── models/                      # ⚠️ 아래 가이드대로 직접 채워야 함 (현재 비어있음)
    ├── parkinson/
    ├── dementia/
    └── diabetes/
```

## 모델 파일 채우는 방법 (Google Drive → 서버)

각 Colab 노트북의 STEP 12(저장) 셀이 만든 `.pkl` 파일들을 Google Drive에서 다운로드한 뒤,
아래 표대로 `models/` 폴더에 정확한 파일명으로 옮겨주세요.

### models/parkinson/
| Drive 원본 파일명 | 서버에 둘 파일명 |
|---|---|
| `model_randomforest.pkl` (best_model_name에 따라 달라짐) | `model.pkl` |
| `scaler.pkl` | `scaler.pkl` |
| `feature_names.pkl` | `feature_names.pkl` |

> `best_model_name`이 RandomForest가 아닌 다른 모델일 수 있으니, 실제 저장된 파일명을 확인 후 `model.pkl`로 이름만 바꿔서 넣으면 됩니다.

### models/dementia/
| Drive 원본 파일명 | 서버에 둘 파일명 |
|---|---|
| `dementia_model_CTD_{best_model_name}.pkl` | `model_CTD.pkl` |
| `dementia_model_PFT_{best_model_name}.pkl` | `model_PFT.pkl` |
| `dementia_model_SFT_{best_model_name}.pkl` | `model_SFT.pkl` |
| `dementia_scaler_CTD.pkl` 등 | `scaler_CTD.pkl` 등 |
| `dementia_chi2mask_CTD.pkl` 등 | `chi2mask_CTD.pkl` 등 |
| `dementia_rfemask_CTD.pkl` 등 | `rfemask_CTD.pkl` 등 |
| `dementia_task_weights.pkl` | `task_weights.pkl` |
| `dementia_acoustic_cols.pkl` | `acoustic_cols.pkl` |
| `dementia_hubert_scaler.pkl` | `hubert_scaler.pkl` |
| `dementia_hubert_pca.pkl` | `hubert_pca.pkl` |
| `dementia_hubert_cols.pkl` | `hubert_cols.pkl` |

> ⚠️ 학습 시 화자 수 부족(15명 미만)으로 제외된 과제가 있다면 해당 `model_XXX.pkl`이 아예 없을 수 있습니다. `dementia.py`가 이를 자동으로 감지해 건너뛰도록 되어 있으니, 없는 과제 파일은 그냥 두면 됩니다.

### models/diabetes/
| Drive 원본 파일명 | 서버에 둘 파일명 |
|---|---|
| `model_diabetes_male_{best_name_m}.pkl` | `model_male.pkl` |
| `model_diabetes_female_{best_name_f}.pkl` | `model_female.pkl` |
| `scaler_diabetes_male.pkl` | `scaler_male.pkl` |
| `scaler_diabetes_female.pkl` | `scaler_female.pkl` |
| `scaler_pre_diabetes_male.pkl` | `scaler_pre_male.pkl` |
| `scaler_pre_diabetes_female.pkl` | `scaler_pre_female.pkl` |
| `pca_diabetes_male.pkl` | `pca_male.pkl` |
| `pca_diabetes_female.pkl` | `pca_female.pkl` |
| `rfe_diabetes_male.pkl` | `rfe_male.pkl` |
| `rfe_diabetes_female.pkl` | `rfe_female.pkl` |

---

## 실행 방법

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

서버 시작 시 모든 모델(파킨슨/치매/당뇨/HuBERT)을 한 번에 로드합니다(수 초~수십 초 소요, GPU 없으면 더 걸릴 수 있음).

## API 테스트 예시 (curl)

### 파킨슨
```bash
curl -X POST "http://localhost:8000/predict/parkinson" \
  -F "file=@sample_voice.wav"
```

### 치매 (과제 1개만 보내도 됨)
```bash
curl -X POST "http://localhost:8000/predict/dementia" \
  -F "CTD=@ctd_sample.wav"
```

### 치매 (과제 3개 다 보낼 때 — 더 정확)
```bash
curl -X POST "http://localhost:8000/predict/dementia" \
  -F "CTD=@ctd_sample.wav" \
  -F "PFT=@pft_sample.wav" \
  -F "SFT=@sft_sample.wav"
```

### 당뇨 (BYOL-S 임베딩은 별도 전처리 단계에서 미리 추출되어 있어야 함)
```bash
curl -X POST "http://localhost:8000/predict/diabetes" \
  -H "Content-Type: application/json" \
  -d '{"byols_embedding": [0.1, 0.2, ...], "age": 45, "bmi": 24.5, "gender": "female"}'
```

## ZDR(Zero Data Retention) 적용 사항
- 업로드된 WAV는 `tempfile`로만 저장되고, 추론이 끝나면 `finally` 블록에서 즉시 삭제됩니다.
- 서버 디스크에 사용자 음성이 영구 저장되지 않습니다.

## TODO (다음 단계)
1. 당뇨 — BYOL-S 임베딩을 서버에서 직접 추출하는 전처리 모듈 추가 (현재는 클라이언트/별도 단계에서 미리 추출된 임베딩을 받는 구조)
2. ALS, 우울증 모델 검증 완료 후 `inference/als.py`, `inference/depression.py` 추가하고 `main.py`에 엔드포인트 추가
3. 인증/Rate Limiting 등 운영 환경 보안 설정
4. 로깅 — 어떤 질환이 얼마나 호출됐는지 모니터링 (개인 음성 데이터는 로깅하지 않음, ZDR 원칙 유지)

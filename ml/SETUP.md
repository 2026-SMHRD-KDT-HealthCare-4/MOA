# ML(음성분석) 로컬 실행 셋업 가이드

> 처음 세팅하는 팀원용. 녹음 → `/analyze` → 음성분석(파킨슨/치매/당뇨)을 로컬에서 돌리기 위한 환경 구성 순서.

---

## 핵심 개념 먼저 — "왜 `ml/`가 아니라 `backend/venv`에 설치?"

| 구분 | 의미 |
|---|---|
| **`ml/` 폴더** | ML **코드·모델 파일**이 들어있는 *소스 위치* (그냥 `.py` + `.pth`) |
| **`backend/venv`** | 그 코드를 **실제로 실행하는 파이썬 환경** |

백엔드(`backend/app/services/ml_inference.py`)가 `ml/` 코드를 **불러와 uvicorn 프로세스 안에서 직접 실행**한다.
즉 ML을 돌리는 인터프리터 = **백엔드 uvicorn이 쓰는 `backend/venv`**.
`ml/`은 독립 실행 프로세스가 아니라 코드 폴더라 **자체 venv가 없다.**

> **결론: 패키지는 "코드가 있는 곳(`ml/`)"이 아니라 "코드가 실행되는 곳(`backend/venv`)"에 설치한다.**

---

## 설치 순서

### 0. 백엔드 venv 활성화 (모든 pip은 이 환경에서)
```bash
cd backend
venv\Scripts\activate        # Windows
# source venv/bin/activate   # mac / Linux
```

### 1. 코드 받기 (serab-byols 폴더 + 체크포인트 `.pth` 포함)
```bash
git pull origin model_yehoon
```

### 2. 체크포인트 확인
`ml/checkpoints/`에 `cvt_...rs42.pth`가 있으면 OK (repo에 포함되어 보통 자동). 없으면 복사:
```bash
cp ml/serab-byols/checkpoints/cvt_*.pth ml/checkpoints/
```

### 3. 패키지 설치 (← `backend/venv` 활성화 상태에서)
```bash
# (a) ML 의존성 한 번에 — scikit-learn은 반드시 1.6.1 고정
pip install openai-whisper transformers catboost xgboost imbalanced-learn \
            torchaudio easydict einops firebase-admin apscheduler scikit-learn==1.6.1

# (b) serab_byols 를 venv에 설치 (안 하면 백엔드가 import 못 함)
pip install -e ml/serab-byols

# (c) 잘못 딸려온 pathlib 백포트 제거 (반드시 (b) 다음에)
pip uninstall -y pathlib
```

### 4. 백엔드 재기동
```bash
uvicorn main:app --reload
```

---

## 검증 (선택)
`serab_byols` import 되고, BYOL-S 모델 로드 시 콘솔에 `✅ BYOL-S/CvT 로드 완료`가 뜨면 정상.

---

## ⚠️ 주의 / 알려진 함정

- **scikit-learn 버전 고정 필수 (`==1.6.1`)**: 학습된 모델(pickle)과 버전이 안 맞으면 로드 실패.
  `pip install -r ml/requirements.txt`는 sklearn을 최신으로 덮으므로 **단독으로 쓰지 말 것.**
- **`pip install -e ml/serab-byols` 필요**: serab-byols는 폴더만 받아지고 자동 설치는 안 됨.
  안 깔면 백엔드 sys.path에서 `serab_byols`를 못 찾는다.
- **`pathlib` 백포트 제거**: serab_byols의 `setup.py`가 잘못 끌어옴. Python 3.4+ 표준 `pathlib`을
  덮어써서 다른 코드가 깨질 수 있으므로 반드시 제거.
- **버전 관찰 항목** (import는 되지만 런타임 재확인 권장):
  - `transformers 5.x` (ml은 4.x 기대) — HuBERT 첫 실행 시(HF 모델 다운로드, 네트워크 필요) 동작 확인
  - `torchaudio 2.11 ↔ torch 2.12` 버전 불일치 — 실제 사용 시 문제없는지 관찰

> 참고: 기존 4개 패키지 안내(`openai-whisper scikit-learn==1.6.1 firebase-admin apscheduler`)는
> **이미 ML 스택이 깔린 환경 전제**였다. 처음 세팅하는 사람은 위 (a)~(c) 전체가 필요하다.

# MOA — Vocal Biomarker 기반 시니어 헬스케어 서비스

고령층(65+)이 매일 음성으로 건강을 기록하고, 보호자(자녀)가 변화 추이를 확인하는 웰니스 서비스.

## 문서 진입점

개발을 시작하기 전에 루트의 `global.md`를 먼저 읽습니다. 제품 기획, 공통 개발 규칙, 프론트/백엔드/ML 현황, 기능별 스펙은 `docs/` 아래에 분리되어 있습니다.

## 레포 구조

| 폴더 | 설명 |
|------|------|
| frontend/ | React Native + Expo (TypeScript, NativeWind) |
| backend/ | FastAPI 서버 (별도 개발) |
| ml/ | 음성 바이오마커 ML 모델 (별도 개발) |

## 시작하기

### 프론트엔드

```bash
cd frontend
npm install
npm start
```

## 기술 스택

- **Frontend**: React Native, Expo SDK 56, TypeScript, NativeWind v4, Expo Router
- **Backend**: FastAPI (Python)
- **ML**: 음성 바이오마커 분석 모델

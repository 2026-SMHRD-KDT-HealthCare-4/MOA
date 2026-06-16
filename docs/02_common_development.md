# Common Development Guide

## 1. 레포 구조

```text
MOA-RN/
  global.md
  docs/
  frontend/
  backend/
  ml/
```

현재 실제 구현은 `frontend/`에 집중되어 있다. `backend/`와 `ml/`은 아직 `.gitkeep`만 있는 준비 상태다.

## 2. 기술 스택

### 현재 프론트

- React Native
- Expo SDK 56
- Expo Router
- TypeScript
- NativeWind v4
- Zustand
- expo-av
- expo-notifications
- expo-speech는 의존성에 있으나 핵심 TTS는 OpenAI TTS API 코드가 준비되어 있다.
- victory-native
- lucide-react-native

### 예정 백엔드

- FastAPI
- REST API 우선
- OpenAI STT/TTS/챗봇 호출 프록시
- 인증, 기록 저장, 보호자 연결, 리포트 데이터 제공

### 예정 ML

- 음성 바이오마커 분석 모델 또는 분석 파이프라인
- MVP에서는 모델보다 입력/출력 스키마와 안전한 표현 정책을 먼저 확정한다.

## 3. 개발 원칙

- 문서와 코드가 충돌하면 문서를 먼저 갱신하거나 구현을 조정한다.
- mock 데이터도 실제 API로 교체하기 쉽게 타입을 명시한다.
- 개인정보와 음성 데이터는 최소 보관 원칙을 따른다.
- 공통 색상/간격/폰트 값은 프론트의 `src/styles/tokens.ts`에 모은다.
- 의료 서비스처럼 보이는 표현과 UI를 피한다.

## 4. 상태 관리 기준

현재 전역 상태는 Zustand를 사용한다.

| 파일 | 역할 |
| --- | --- |
| `frontend/src/stores/authStore.ts` | 로그인 여부와 사용자 역할 |
| `frontend/src/stores/wakeWordStore.ts` | 호출어 감지 활성/비활성 상태 |

추가 store는 다음 기준을 만족할 때만 만든다.

- 여러 화면에서 공유한다.
- URL/라우팅 상태만으로 표현하기 어렵다.
- props drilling이 화면 구조를 복잡하게 만든다.

## 5. 데이터/API 설계 기준

- 프론트 타입은 mock 단계에서도 실제 응답 형태를 기준으로 둔다.
- API 응답에는 `status`, `data`, `error` 또는 동등한 실패 구조를 명확히 둔다.
- 고령자 화면에는 점수와 퍼센트를 직접 넘기더라도 UI에서는 숨긴다.
- 보호자 리포트는 추이와 메타포를 함께 제공한다.
- 분석 결과는 의료 판단이 아니라 참고 정보로 표현한다.

## 6. 검증 기준

프론트 변경 후 기본 검증:

```bash
cd frontend
npm.cmd run typecheck
```

웹 빌드 검증이 필요한 경우:

```bash
cd frontend
npx expo export --platform web
```

PowerShell에서 `npm`이 실행 정책에 막히면 `npm.cmd`를 사용한다.

## 7. 변경 기록

- 2026-06-15: 공통 개발 기준과 검증 명령을 문서화.

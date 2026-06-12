# MOA — Vocal Biomarker 기반 시니어 헬스케어 서비스

부트캠프 AI 헬스케어 과정 팀 프로젝트. 고령층(65+)이 매일 음성으로 건강을 기록하고,
보호자(자녀)가 변화 추이를 확인하는 서비스. **의료기기가 아닌 웰니스 서비스.**

## 절대 규칙 (위반 금지)

1. **금지 표현**: "진단", "처방", "치료", "병", "질환명 직접 노출" → 반드시 "감지", "변화", "참고용", "패턴"으로 표현. UI 문구·주석·변수명·커밋 메시지 전부 해당.
2. **레드(Red) 컬러 전면 금지**: 경보·에러 포함 모든 상황에서 빨간색 사용 불가. 경보는 앰버 오렌지 `#E8943A` 단일 컬러.
3. **다크모드 구현하지 않음.**
4. **어르신 화면 텍스트 최소 18pt(약 24px)**, 터치 타깃 최소 56px, 한 화면에 핵심 액션 버튼은 1~2개만.
5. **색+아이콘+텍스트 항상 병행** (색각 이상 대응). 색만으로 의미 전달 금지.
6. 수치(%, 점수)나 의학 용어를 어르신 화면에 직접 노출하지 않음 → 날씨 메타포(☀️ 맑음 / ⛅ 흐림 / 🌧️ 비)로 표현. 보호자 화면에서만 추이 그래프 허용.

## 기술 스택 (이 스택만 사용)

- **React Native + TypeScript + Expo (managed workflow)**
- **NativeWind v4** (TailwindCSS for React Native, 인라인 style 지양, 유틸리티 우선)
- 라우팅: **Expo Router** (파일 기반 라우팅, app/ 디렉토리)
- 상태관리: **Zustand** (전역 상태), useState/useRef (로컬·컴포넌트 단위 상태)
- 미디어: **expo-av** (음성 녹음 · 영상 재생), **expo-notifications** (알림)
- STT: OpenAI Whisper API / TTS: OpenAI TTS API (테스트 후 변경 가능)
- 차트: Victory Native (보호자 리포트 화면)
- HTTP: fetch (axios 도입은 팀 합의 전까지 보류)
- 백엔드는 FastAPI(별도 레포). 프론트는 **mock 우선** 개발 → 인터페이스는 docs/02_chatbot_spec.md의 API 규격 준수.

## 디자인 토큰

```
배경(베이스):      #FAF7F2  (크림베이지)
포인트(테마):      연분홍/코랄 계열 (예: #F4A9A8, #F8C8C4 — 팀 확정 전 임시값)
경보:              #E8943A  (앰버 오렌지, 유일한 경보색)
정상 상태:         그린 계열 (온라인 표시등 #2ECC71)
텍스트(본문):      진한 황갈색/차콜 — 크림 배경 위 대비 4.5:1 이상 확보
```
세이지그린은 사용하지 않음. 브랜드 컬러는 추후 재정리 예정이므로 색상값은 한 곳
(`src/styles/tokens.ts` 또는 tailwind.config)에 모아두고 하드코딩 금지.

## 기능 요구사항 메모

### FR-10 앱 내 호출어 기반 음성 UI 네비게이션 (ELD 전용)
- 앱 포그라운드 사용 중 "모아야" 호출어 감지 → 키워드 매핑으로 화면 이동
- UC-01a/01b(녹음·대화 세션) 진행 중에는 자동 비활성화
- ZDR(Zero-Delay Response) 적용 — 호출어 감지 즉시 이동, 확인 팝업 없음
- ELD(어르신) 화면 전용 기능
- 관련 파일: `src/hooks/useWakeWord.ts`, `src/stores/wakeWordStore.ts`
- 세부 키워드 매핑은 `docs/01_mvp_scope.md` FR-10 참조

## 코드 컨벤션

- 컴포넌트: PascalCase, 함수형 + Hooks만
- 파일 구조: `src/components/`(공용), `src/features/chatbot/`, `src/features/record/`, `src/hooks/`, `src/pages/`
- 모든 컴포넌트에 props interface 명시 (TypeScript strict)
- 음성/오디오 관련 로직은 반드시 custom hook으로 분리 (`useRecorder`, `useMoaAvatar`, `useWakeWord` 등)
- 기존 팀원 코드를 수정할 때는 **삭제·대규모 리팩토링 금지**, 추가/확장 위주로. 구조 변경이 필요하면 먼저 계획을 제시하고 승인받을 것.

## 개인정보 원칙 (코드에 반영)

- 원시 음성(blob)은 서버 전송/분석 완료 즉시 메모리에서 해제. localStorage·IndexedDB에 오디오 저장 금지.
- 콘솔에 발화 텍스트·사용자 식별정보 로깅 금지.

## 작업 방식

- 새 기능 착수 전 `docs/01_mvp_scope.md` 확인 — **Out of Scope 항목은 절대 구현하지 않음.**
- 큰 작업은 먼저 파일 단위 계획을 보여주고 승인 후 진행.
- 각 단계 완료 시 `npx expo export --platform web` 빌드가 통과하는 상태 유지.

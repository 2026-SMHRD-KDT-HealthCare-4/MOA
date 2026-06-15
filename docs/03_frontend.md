# Frontend Guide

## 1. 현재 상태

프론트엔드는 Expo Router 기반 모바일 앱이다. 현재 MVP 화면 대부분이 mock 데이터로 구현되어 있으며, STT/TTS는 OpenAI API 호출 코드가 준비되어 있다.

## 2. 주요 구조

```text
frontend/
  app/                 Expo Router 라우트 선언
  src/pages/           실제 화면 구현
  src/components/      공통 UI
  src/features/        기능별 hook과 비즈니스 로직
  src/hooks/           공통 hook
  src/stores/          Zustand store
  src/mocks/           mock API 응답
  src/styles/          디자인 토큰
  src/asset/           Moa 캐릭터 mp4
```

`app/` 파일은 가능한 얇게 유지한다. 화면 코드는 `src/pages/`에서 수정한다.

## 3. 라우팅

| 경로 | 화면 |
| --- | --- |
| `/` | 인트로 |
| `/(auth)/login` | 로그인 |
| `/(auth)/register` | 회원가입 |
| `/(elder)/` | 고령자 홈 |
| `/(elder)/record` | 음성 기록 |
| `/(elder)/history` | 기록 히스토리 |
| `/(elder)/settings` | 고령자 설정 |
| `/chat` | 대화하기 |
| `/done` | 기록 완료 |
| `/(guardian)/` | 보호자 대시보드 |
| `/(guardian)/family` | 가족 연결 |
| `/(guardian)/report` | 리포트 |
| `/(guardian)/settings` | 보호자 설정 |

## 4. 구현된 화면

### 공통/인증

- `app/index.tsx`: 인트로와 터치 시작
- `app/(auth)/login.tsx`: mock 로그인. 현재 로그인 시 `elder` 역할로 진입
- `app/(auth)/register.tsx`: mock 회원가입 폼

### 고령자

- `src/pages/HomePage.tsx`: 캐릭터, 인사 말풍선, 녹음 버튼
- `src/pages/RecordPage.tsx`: 녹음 시작/중지, 처리 상태, STT 결과, 저장 이동
- `src/pages/DonePage.tsx`: 녹음 완료 결과
- `src/pages/HistoryPage.tsx`: mock 기록 캘린더
- `src/pages/ChatPage.tsx`: 텍스트 대화, mock 챗봇 응답, TTS 준비
- `src/pages/SettingsPage.tsx`: 알림 권한, 버전, 로그아웃

### 보호자

- `src/pages/DashboardPage.tsx`: 최근 상태와 주간 흐름 mock
- `src/pages/FamilyPage.tsx`: 연결 가족 mock
- `src/pages/ReportPage.tsx`: Victory Native 차트 기반 리포트
- `src/pages/SettingsPage.tsx`: 보호자 역할 문구 분기

## 5. 공통 컴포넌트

| 파일 | 역할 |
| --- | --- |
| `CharacterPlayer.tsx` | mp4 기반 Moa 캐릭터 재생 |
| `MoaAvatar.tsx` | 작은 원형 아바타 |
| `Waveform.tsx` | 녹음/청취 시각 효과 |
| `layout/BottomNav.tsx` | 고령자/보호자 하단 탭 |
| `icons/*.tsx` | 앱 전용 SVG 아이콘 |

## 6. 디자인 규칙

- 색상/간격/폰트는 `src/styles/tokens.ts`를 우선 사용한다.
- 고령자 화면 텍스트는 최소 18pt 이상을 기본으로 한다.
- 터치 영역은 최소 56px 이상을 유지한다.
- 빨간색 경고를 쓰지 않는다.
- 웹에서는 `app/_layout.tsx`가 430px 모바일 프레임을 제공한다.

## 7. 주의 파일

| 파일 | 이유 |
| --- | --- |
| `src/features/chatbot/useMoaChat.ts` | mock 챗봇, TTS, 호출어 비활성화가 함께 있다. API 이전 시 영향 큼 |
| `src/features/record/useRecorder.ts` | 마이크 권한, 임시 음성, Whisper STT, 개인정보 정책과 연결됨 |
| `src/stores/authStore.ts` | 인증 방식 도입 시 교체 필요 |
| `src/stores/wakeWordStore.ts` | FR-10 호출어 상태의 기준 |
| `src/hooks/useWakeWord.ts` | 호출어 라우팅 규칙 |
| `app/_layout.tsx` | 전체 라우팅, 웹 프레임, viewport 설정 |

## 8. 변경 기록

- 2026-06-15: 프론트 구조와 현재 구현 상태를 최상위 문서 체계로 정리.

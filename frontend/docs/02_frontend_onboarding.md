# MOA 프론트엔드 온보딩 가이드

> 이 문서는 `frontend/` 폴더에 처음 합류하는 팀원을 위한 안내서입니다.

---

## 시작하기

```bash
cd frontend
npm install
npx expo start          # 개발 서버 실행
npx expo start --web    # 웹 브라우저에서 확인 (Chrome DevTools → 폰 사이즈 권장)
```

---

## 폴더 구조

```
frontend/
├── app/                          ← Expo Router 라우팅 (파일명 = URL 경로)
│   ├── _layout.tsx               ← 루트 레이아웃 (인증 분기)
│   ├── index.tsx                 ← 인트로 화면 (앱 진입점)
│   ├── chat.tsx                  ← 챗봇 대화 화면
│   ├── done.tsx                  ← 녹음 완료 결과 화면
│   ├── (auth)/                   ← 비로그인 전용 그룹
│   │   ├── _layout.tsx
│   │   ├── login.tsx             ← 로그인 화면
│   │   └── register.tsx          ← 회원가입 화면
│   ├── (elder)/                  ← 직접사용자 탭 그룹
│   │   ├── _layout.tsx           ← BottomNav 탭 설정
│   │   ├── index.tsx             ← 홈 탭 (→ HomePage)
│   │   ├── record.tsx            ← 기록 탭 (→ RecordPage)
│   │   ├── history.tsx           ← 히스토리 탭 (→ HistoryPage)
│   │   └── settings.tsx          ← 설정 탭 (→ SettingsPage)
│   └── (guardian)/               ← 보호자 탭 그룹
│       ├── _layout.tsx           ← BottomNav 탭 설정
│       ├── index.tsx             ← 대시보드 탭 (→ DashboardPage)
│       ├── family.tsx            ← 가족 탭 (→ FamilyPage)
│       ├── report.tsx            ← 리포트 탭 (→ ReportPage)
│       └── settings.tsx          ← 설정 탭 (→ SettingsPage)
│
├── src/
│   ├── pages/                    ← 실제 화면 구현체 (app/ 파일들이 여기를 re-export)
│   │   ├── HomePage.tsx          ← 직접사용자 홈 (캐릭터 + 녹음하기)
│   │   ├── ChatPage.tsx          ← 챗봇 대화 (텍스트 입력 + 말풍선)
│   │   ├── RecordPage.tsx        ← 음성 녹음 화면
│   │   ├── DonePage.tsx          ← 녹음 완료 결과 화면
│   │   ├── HistoryPage.tsx       ← 캘린더형 기록 열람
│   │   ├── SettingsPage.tsx      ← 알림·계정·로그아웃 설정
│   │   ├── DashboardPage.tsx     ← 보호자 홈 (연결된 직접사용자 상태)
│   │   ├── FamilyPage.tsx        ← 보호자 가족 연결 관리
│   │   └── ReportPage.tsx        ← 보호자 변화 패턴 리포트
│   │
│   ├── components/               ← 재사용 공용 컴포넌트
│   │   ├── CharacterPlayer.tsx   ← 모아 캐릭터 동영상 플레이어 (mood prop)
│   │   ├── MoaAvatar.tsx         ← 원형 클립 아바타 (circular prop)
│   │   ├── Waveform.tsx          ← 음성 파형 시각화 바
│   │   ├── icons/
│   │   │   ├── MicIcon.tsx       ← SVG 마이크 아이콘
│   │   │   ├── BellIcon.tsx      ← SVG 벨 아이콘
│   │   │   ├── SunIcon.tsx       ← SVG 태양 아이콘 (결과 화면)
│   │   │   └── TouchIcon.tsx     ← SVG 손 아이콘 (인트로 힌트)
│   │   └── layout/
│   │       ├── BottomNav.tsx     ← 하단 탭 바 (elder/guardian 각각)
│   │       └── TopBar.tsx        ← 상단 바 (일부 화면 사용)
│   │
│   ├── features/                 ← 기능별 비즈니스 로직 (훅)
│   │   ├── chatbot/
│   │   │   └── useMoaChat.ts     ← 챗봇 대화 상태 관리 + API 연동
│   │   └── record/
│   │       └── useRecorder.ts    ← 마이크 녹음 + STT 처리
│   │
│   ├── hooks/
│   │   ├── useWakeWord.ts        ← "모아야" 호출어 감지 (FR-10)
│   │   └── useMoaAvatar.ts       ← 아바타 감정 제어 훅
│   │
│   ├── stores/                   ← Zustand 전역 상태
│   │   ├── authStore.ts          ← 로그인 상태 + 역할 (elder/guardian)
│   │   └── wakeWordStore.ts      ← 호출어 감지 활성화 여부
│   │
│   ├── constants/
│   │   └── emotionMap.ts         ← 감정 이름 → mp4 파일 매핑 테이블
│   │
│   ├── styles/
│   │   └── tokens.ts             ← 색상·간격·폰트 디자인 토큰 (전체 통일)
│   │
│   ├── mocks/
│   │   └── chatbotResponses.ts   ← API 연동 전 챗봇 더미 응답 데이터
│   │
│   ├── navigation/
│   │   └── types.ts              ← 라우팅 타입 정의
│   │
│   └── asset/                    ← 모아 캐릭터 mp4 영상 파일
│       ├── 모아인사.mp4
│       ├── 기본.mp4 / 기쁨.mp4 / 걱정.mp4
│       ├── 듣기.mp4 / 생각.mp4 / 설명.mp4
│       ├── 사랑.mp4 / 행복.mp4
│
├── assets/                       ← 앱 아이콘, 스플래시 이미지
├── docs/                         ← 팀 문서
│   ├── 01_mvp_scope.md           ← MVP 기능 범위 (구현 전 반드시 확인)
│   └── 02_frontend_onboarding.md ← 이 문서
├── app.json                      ← Expo 앱 설정
├── babel.config.js               ← 빌드 설정
├── metro.config.js               ← Metro 번들러 설정
├── tailwind.config.js            ← NativeWind 설정
└── tsconfig.json                 ← TypeScript 설정
```

---

## app/ vs src/pages/ 관계

`app/` 폴더의 파일들은 **라우팅 선언만** 하고, 실제 UI는 `src/pages/`에 있습니다.

```ts
// app/(elder)/index.tsx — 이게 전부입니다
export { default } from "../../src/pages/HomePage";
```

**화면 코드를 수정할 때는 항상 `src/pages/` 파일을 편집하세요.**

---

## 화면 흐름

```
앱 시작
  └→ app/index.tsx (인트로)
       ├→ 비로그인  → (auth)/login → (auth)/register
       ├→ 직접사용자 → (elder)/  탭 그룹
       │     홈 → 대화(chat) → 녹음(record) → 완료(done)
       └→ 보호자    → (guardian)/ 탭 그룹
             대시보드 → 가족 → 리포트
```

---

## CharacterPlayer 사용법

모아 캐릭터를 화면에 넣을 때 사용합니다.

```tsx
import { CharacterPlayer } from "../components/CharacterPlayer";

// 1) 고정 크기 (flex 레이아웃에 삽입)
<CharacterPlayer mood="idle" size={200} />

// 2) 절대 위치 (화면 가득 채우기)
<CharacterPlayer
  mood="listening"
  containerStyle={{ left: 22, right: 22, top: 190, bottom: 14, borderRadius: 150 }}
/>
```

| mood | 재생 영상 | 사용 상황 |
|---|---|---|
| `idle` | 모아인사.mp4 | 기본 대기 |
| `listening` | 듣기.mp4 | 녹음 중 |
| `happy` | 기쁨.mp4 | 완료·칭찬 |
| `worried` | 걱정.mp4 | 이상 감지 |

---

## ⛔ 건드리면 안 되는 파일

| 파일 | 이유 |
|---|---|
| `src/features/chatbot/useMoaChat.ts` | 챗봇 API 연동 로직 — 백엔드 팀과 인터페이스 확정 |
| `src/features/record/useRecorder.ts` | 마이크 권한·STT 처리 — 오디오 파이프라인 핵심 |
| `src/stores/authStore.ts` | 로그인 상태 전역 관리 — 잘못 수정 시 인증 전체 오작동 |
| `src/stores/wakeWordStore.ts` | 호출어 감지 상태 — FR-10 스펙과 연결 |
| `src/hooks/useWakeWord.ts` | 호출어 감지 로직 — 사용 중 비활성화 조건 포함 |
| `src/constants/emotionMap.ts` | 감정→영상 매핑 — 변경 시 전체 캐릭터 영상 깨짐 |
| `app/_layout.tsx` | 루트 인증 분기 라우팅 — 잘못 수정 시 화면 이동 전체 오작동 |
| `app/(elder)/_layout.tsx` | 직접사용자 탭 바 구조 |
| `app/(guardian)/_layout.tsx` | 보호자 탭 바 구조 |
| `babel.config.js` | 빌드 설정 |
| `metro.config.js` | 번들러 설정 |
| `tsconfig.json` | TypeScript 설정 |

> 위 파일 수정이 필요하다면 반드시 팀원과 먼저 논의하세요.

---

## 스타일 수정 — tokens.ts 사용법

모든 색상·간격·폰트는 `src/styles/tokens.ts` 에서 가져옵니다.
**컴포넌트에 색상 코드를 직접 하드코딩하지 마세요.**

### 임포트

```ts
import { colors, spacing, radius, font } from "../styles/tokens";
```

### 색상 토큰

```ts
colors.bg.base       // "#FFF9F2"  배경 기본
colors.bg.card       // "#FFFDF9"  카드 배경
colors.bg.warm       // "#FFF8EE"  따뜻한 배경 (인트로)
colors.bg.accent     // "#F8E5D2"  그라디언트 끝 색상

colors.brand.DEFAULT // "#FF7955"  버튼·포인트 컬러
colors.brand.record  // "#F06D4D"  녹음 진행 중 버튼

colors.gradient.intro  // ["#FFF8EE", "#FFFDF9", "#F8E5D2"]  인트로 그라디언트
colors.gradient.chat   // ["#FFF9F1", "#FFFDF9"]              대화·홈 그라디언트
colors.gradient.result // ["#FFF9F1", "#FFFDF9", "#F9E6D4"]  결과 그라디언트

colors.alert         // "#E8943A"  경보 (빨간색 절대 금지)

colors.text.primary     // "#342C28"  본문 텍스트
colors.text.secondary   // "#40332D"  보조 텍스트
colors.text.muted       // "#765E52"  설명·힌트 텍스트
colors.text.placeholder // "#9A887D"  입력창 플레이스홀더

colors.nav.activeBg   // "#EAF1E6"  탭 활성 배경
colors.nav.activeText // "#5D7657"  탭 활성 텍스트
```

### 사용 예시

```tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.base,        // ✅
    // backgroundColor: "#FFF9F2",          // ❌ 하드코딩 금지
  },
  title: {
    fontSize: font.sizeLarge,               // 24
    color: colors.text.primary,             // "#342C28"
    fontWeight: "800",
  },
  button: {
    borderRadius: radius.button,            // 23
    backgroundColor: colors.brand.DEFAULT, // "#FF7955"
    paddingHorizontal: spacing.screenH,    // 24
  },
});
```

### LinearGradient 사용 예시

```tsx
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../styles/tokens";

<LinearGradient
  colors={colors.gradient.chat}   // ["#FFF9F1", "#FFFDF9"]
  style={StyleSheet.absoluteFill}
/>
```

---

## 주요 규칙 요약

| 규칙 | 내용 |
|---|---|
| 빨간색 전면 금지 | 경보는 반드시 `colors.alert` (#E8943A) |
| 화면 텍스트 최소 18pt | `font.sizeBase` 이상 사용 |
| 터치 타깃 최소 56px | 버튼 height ≥ 56 |
| 색+아이콘+텍스트 병행 | 색만으로 의미 전달 금지 |
| "진단·처방·치료" 표현 금지 | "감지·변화·참고용·패턴"으로 대체 |
| 다크모드 구현하지 않음 | |

> 전체 규칙은 `CLAUDE.md` 참고

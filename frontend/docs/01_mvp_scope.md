# MOA MVP Scope

> 부트캠프 발표용 MVP. Out of Scope 항목은 절대 구현하지 않음.
> 신규 기준 문서는 루트 `global.md`와 `docs/01_product_planning.md`입니다. 이 파일은 프론트 MVP 범위 참고 문서로 유지합니다.

---

## In Scope (구현 대상)

| ID | 기능 | 대상 |
|----|------|------|
| FR-01 | 인트로 화면 → 로그인 → 역할 분기 | ELD / GRD |
| FR-02 | 어르신 홈 — 모아 아바타 + 액션 버블(대화 / 기록) | ELD |
| FR-03 | MoaAvatar — 감정별 mp4 재생 (expo-av Video) | ELD |
| FR-04 | 대화하기 (ChatPage) — 텍스트 입력 → mock 응답 → TTS 재생 | ELD |
| FR-05 | 음성 기록 (RecordPage) — expo-av 녹음 → Whisper STT → 저장 | ELD |
| FR-06 | 기록 히스토리 (HistoryPage) — 날씨 메타포 캘린더 | ELD |
| FR-07 | 보호자 대시보드 (DashboardPage) — 요약 카드 | GRD |
| FR-08 | 보호자 리포트 (ReportPage) — 추이 그래프 (Victory Native) | GRD |
| FR-09 | 알림 설정 (SettingsPage) — expo-notifications 권한 | ELD / GRD |
| FR-10 | 앱 내 호출어 기반 음성 UI 네비게이션 | ELD |

---

## FR-10 앱 내 호출어 기반 음성 UI 네비게이션

**우선순위:** 하  
**대상:** ELD(어르신) 전용  
**조건:** 앱 포그라운드 + UC-01a/01b 세션 외부

### 키워드 매핑

| 호출어 | 이동 경로 |
|--------|-----------|
| "모아야, 기록" | `/(elder)/history` |
| "모아야, 홈" | `/(elder)/index` |
| "모아야, 설정" | `/(elder)/settings` |
| "모아야, 대화하자" | `/chat` |

### 동작 규칙
- ZDR(Zero-Delay Response): 호출어 감지 즉시 이동, 확인 팝업 없음
- UC-01a(녹음 세션) · UC-01b(대화 세션) 진행 중 자동 비활성화
- 관련 파일: `src/hooks/useWakeWord.ts`, `src/stores/wakeWordStore.ts`

---

## Out of Scope (구현 금지)

- 실제 의료 수치 표시 (혈압, 혈당 등)
- 보호자 → 어르신 실시간 음성 통화
- SNS 공유 기능
- 다국어(영어 등) 지원
- 다크모드
- 백그라운드 상시 호출어 감지 (포그라운드 한정)
- 외부 의료기관 연동 API

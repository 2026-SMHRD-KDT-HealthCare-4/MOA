# MOA 중간 점검 — 로그인·인증·가족연동 (가형 담당)

> 작성일: 2026-06-20 · 브랜치: `frontend_Gahyoung`
> 범위: 로그인 / 인증 / 가족연동. **챗봇(보경 담당) 제외.**
> 기준 문서: [docs/03_auth_onboarding_spec.md](03_auth_onboarding_spec.md)
> ⚠️ 이 문서는 **현황 보고서**다. 코드 변경 없음.

코드 실체는 `frontend/` 아래에 있다(스펙 문서의 경로 표기 `app/…`, `src/…` 는 모두 `frontend/app`, `frontend/src`).

---

## 1. 아키텍처 개요

### 1-1. 라우팅 구조 (Expo Router, 파일 기반)

| 그룹 | 파일 | 역할 |
|---|---|---|
| 루트 가드 | [frontend/app/_layout.tsx:13-52](../frontend/app/_layout.tsx#L13-L52) | `hydrate()` 세션 복원 후 `(auth)/(elder)/(guardian)` 분기 |
| (auth) | [role-select.tsx](../frontend/app/(auth)/role-select.tsx), [register.tsx](../frontend/app/(auth)/register.tsx), [login.tsx](../frontend/app/(auth)/login.tsx), [elder-consent.tsx](../frontend/app/(auth)/elder-consent.tsx), [elder-claim.tsx](../frontend/app/(auth)/elder-claim.tsx), [guardian-invite.tsx](../frontend/app/(auth)/guardian-invite.tsx) | 역할선택·가입·로그인·동의·클레임·공동보호자초대수락 |
| (보호자 온보딩) | [frontend/app/onboarding.tsx](../frontend/app/onboarding.tsx) | 부모님 프로비저닝(초대 토큰 발급) — `provision → pairing` 2-step |
| (elder) | [_layout.tsx](../frontend/app/(elder)/_layout.tsx) (홈/기록/히스토리/설정), [index.tsx](../frontend/app/(elder)/index.tsx) | 가족 탭 없음 |
| (guardian) | [_layout.tsx](../frontend/app/(guardian)/_layout.tsx) (홈/가족/리포트/설정), [family/index.tsx](../frontend/app/(guardian)/family/index.tsx), [family/[elderlyId].tsx](../frontend/app/(guardian)/family/[elderlyId].tsx) | 가족 탭 보유 |

가드 동작 ([frontend/app/_layout.tsx:33-51](../frontend/app/_layout.tsx#L33-L51)):
- 비로그인 + 보호영역 진입 → `/(auth)/role-select`
- `elder` && `!consentDone` → `/(auth)/elder-consent` 강제
- 교차역할 차단: `elder`가 `(guardian)` 진입 차단, `guardian`이 `(elder)` 진입 차단
- `(auth)`→홈 자동이동은 **각 화면이 직접** `router.replace` (가드 race 방지)

### 1-2. 상태 (Zustand) — [frontend/src/stores/authStore.ts](../frontend/src/stores/authStore.ts)

스펙의 골격(`userId/role/refreshToken/consentDone/links/hasGuardianTab`)을 넘어 **가족그룹 모델**까지 확장됨:
- 타입: `FamilyGroup`, `FamilyLink`(linkId/counterpartId/relation/status), `GuardianMember`(OWNER/SUB_GUARDIAN), `SessionUser` — [authStore.ts:11-51](../frontend/src/stores/authStore.ts#L11-L51)
- ID 체계는 스펙의 `number` → **UUID 문자열**로 바뀜(Supabase auth.users 계열) — [authStore.ts:20-29](../frontend/src/stores/authStore.ts#L20-L29)
- `hasGuardianTab` 계산: `role==='guardian' && (ACTIVE guardianMember 있음 || ACTIVE link 있음)` — [authStore.ts:124-130](../frontend/src/stores/authStore.ts#L124-L130) ⚠️ 스펙은 "ACTIVE 링크 1개+"만 조건으로 둠 → 3장 참고
- `OWNER`는 권한 우위 없는 라벨(평탄 모델) — [authStore.ts:7-9](../frontend/src/stores/authStore.ts#L7-L9)
- **DEV 자동로그인 스위치**: `EXPO_PUBLIC_DEV_AUTOLOGIN=elder|guardian` → 인증 흐름 건너뛰고 부팅. 기본값 OFF — [authStore.ts:65-78](../frontend/src/stores/authStore.ts#L65-L78), 초기상태 주입 [authStore.ts:219-226](../frontend/src/stores/authStore.ts#L219-L226)

### 1-3. API 레이어 — mock/real 듀얼 모드 — [frontend/src/api/auth.ts](../frontend/src/api/auth.ts)

- 스위치: `EXPO_PUBLIC_AUTH_API_MODE === "real" ? "real" : "mock"` (기본 mock) — [auth.ts:24-25](../frontend/src/api/auth.ts#L24-L25)
- 거의 모든 함수가 `xxxMock` / `xxxReal` 쌍으로 분기 (login/register/createInvite/verifyInvite/registerSenior/getGuardianSeniors/updateLinkStatus/getPendingInvites/restoreSession)
- **mock DB**는 localStorage 영속(`moa.mock.family.v2`) + 시드 — [auth.ts:90-166](../frontend/src/api/auth.ts#L90-L166). `MOA-DEV` 초대는 매 로드 시 미사용 리시드 + `resetMockDb()` 콘솔 헬퍼 — [auth.ts:168-244](../frontend/src/api/auth.ts#L168-L244)
- **real 모드 BE 엔드포인트 매핑**: `/auth/login`, `/auth/guardian/register`, `/auth/invite`, `/auth/invite/{token}/verify`, `/auth/senior/register`, `/auth/guardian/seniors`, `PATCH /auth/link/{id}`
- 토큰 저장: access=메모리, refresh=SecureStore(웹은 localStorage 폴백) — [frontend/src/api/session.ts](../frontend/src/api/session.ts)

### 1-4. 주요 컴포넌트

- 챗봇 메인: `ChatbotMain` — `(elder)/index.tsx`·`(guardian)/index.tsx`가 동일 re-export ([elder index](../frontend/app/(elder)/index.tsx), [guardian index](../frontend/app/(guardian)/index.tsx)) → 스펙의 "공통 메인" 충족. *(내부는 보경 담당 챗봇 영역)*
- 가족 허브: [frontend/src/pages/FamilyHubPage.tsx](../frontend/src/pages/FamilyHubPage.tsx) ← `(guardian)/family/index.tsx`
- 부모 상세 리포트: [frontend/src/pages/DashboardPage.tsx](../frontend/src/pages/DashboardPage.tsx) ← `(guardian)/family/[elderlyId].tsx` (param `elderlyId`로 부모 식별 — [DashboardPage.tsx:45-50](../frontend/src/pages/DashboardPage.tsx#L45-L50))
- 가족 보조 mock 데이터(상태/안부/형제): [frontend/src/mocks/family.ts](../frontend/src/mocks/family.ts) — "진실원천은 authStore.links, 카드 곁들이 정보만 mock"이라고 명시

---

## 2. 구현된 흐름 (시작 → 현재)

| 단계 | 흐름 | 상태 | 근거 |
|---|---|---|---|
| 역할선택 | 직접사용자/보호자 + 로그인·공동보호자초대 링크 | **완료** | [role-select.tsx:10-24](../frontend/app/(auth)/role-select.tsx#L10-L24) |
| 보호자 가입 | 이름/이메일/비번 → register → `/onboarding` | **완료**(mock), **stub**(real PII) | [register.tsx:21-37](../frontend/app/(auth)/register.tsx#L21-L37); real은 birth/phone placeholder [auth.ts:522-539](../frontend/src/api/auth.ts#L522-L539) |
| 부모 provision | 성함 입력 → `createInvite`(토큰 발급) → 페어링 코드 | **완료**(mock) / **mock만**(real 캐시 의존) | [onboarding.tsx:26-49](../frontend/app/onboarding.tsx#L26-L49); createInvite [auth.ts:560-609](../frontend/src/api/auth.ts#L560-L609) |
| 초대 공유 | `Share.share` 코드 전달 | **완료** | [onboarding.tsx:51-56](../frontend/app/onboarding.tsx#L51-L56), [FamilyHubPage.tsx:47-58](../frontend/src/pages/FamilyHubPage.tsx#L47-L58) |
| 동의 | 생체정보 동의 화면 → 동의의사 param 전달 | **완료** | [elder-consent.tsx:19-24](../frontend/app/(auth)/elder-consent.tsx#L19-L24) |
| 클레임 | 코드 입력 → verify → throwaway credential 생성 → registerSenior → login → consent 제출 | **완료**(mock) | [elder-claim.tsx:25-43](../frontend/app/(auth)/elder-claim.tsx#L25-L43); `claimSenior` [auth.ts:762-802](../frontend/src/api/auth.ts#L762-L802) |
| 자동 로그인 | refresh 토큰 보관 → `restoreSession` 복원 | **완료**(mock) / **stub**(real) | [auth.ts:1058-1099](../frontend/src/api/auth.ts#L1058-L1099) — 3장 E-2 |
| 가족 허브 | 연동 부모 카드 + 초대 대기 + 공동보호자 초대/목록 | **완료**(mock) | [FamilyHubPage.tsx](../frontend/src/pages/FamilyHubPage.tsx) |
| 공동보호자 | 초대코드 발급/수락 | **mock만** (real 미지원, throw) | inviteGuardian/acceptGuardianInvite [auth.ts:924-998](../frontend/src/api/auth.ts#L924-L998) |
| 부모 리포트 | 가족 카드 → drill-down 대시보드 | **완료(UI)** / 데이터 mock | [DashboardPage.tsx](../frontend/src/pages/DashboardPage.tsx) |
| **연동 해제** | 부모/보호자 연동 끊기 | **없음** (UI 미존재) | 3장 B-4 |

흐름 자체는 역할선택→가입→provision→초대→클레임→자동로그인→가족허브→리포트까지 **mock 기준 end-to-end 동작**. real 모드는 인증·연동 조회는 붙지만 보조 데이터(이름/세션복원/초대목록/공동보호자)가 비어있거나 캐시 의존.

---

## 3. 백엔드 계약과 상반/불일치 부분

### B-3. "연결 대기"의 근거 → ✅ 일치 (미사용 초대 토큰 기반)

- 가족 허브의 초대 대기 카드는 `getPendingInvites`로 채워짐 — [FamilyHubPage.tsx:36-45,139-168](../frontend/src/pages/FamilyHubPage.tsx#L36-L45)
- mock: `invites` 중 `!isUsed && 미만료`를 반환 (**PENDING 링크가 아님**) — [auth.ts:887-890](../frontend/src/api/auth.ts#L887-L890)
- 코드 주석도 "guardian_senior는 senior 가입 시 ACTIVE로 생성 → 여기 PENDING은 link 상태가 아니라 invite 상태" 라고 BE 계약과 동일하게 명시 — [auth.ts:879-884](../frontend/src/api/auth.ts#L879-L884)
- 클레임 시 mock은 링크를 **즉시 ACTIVE**로 생성 — [auth.ts:685-695](../frontend/src/api/auth.ts#L685-L695). BE의 "senior 가입 시 ACTIVE 생성"과 일치.
- **결론: B-3는 BE 계약과 정합.** PENDING 링크를 쓰지 않는다. (단, real 모드 pending 목록은 localStorage 캐시라 기기 간 동기화 안 됨 → E-3)

### B-4. 연동 해제 → ⚠️ FE에 해제 흐름 자체가 없음

- `updateLinkStatus`(`PATCH /auth/link/{id}`)는 **정의되어 있으나 어떤 화면에서도 호출되지 않음** — 정의 [auth.ts:837-868](../frontend/src/api/auth.ts#L837-L868), 전체 코드베이스에서 호출처 0건(grep 확인).
- 보호자 설정 화면에 **연동 해제 버튼 없음**. 설정은 알림/버전/개인정보/역할표시/로그아웃만 — [frontend/src/pages/SettingsPage.tsx](../frontend/src/pages/SettingsPage.tsx)
- 따라서 **해제 confirm 단계 없음**(존재 자체가 없으니). confirm 패턴은 로그아웃에만 있음 — [SettingsPage.tsx:36-53](../frontend/src/pages/SettingsPage.tsx#L36-L53)
- "본인 링크만 변경"(guardian_id 불일치 403)은 **BE가 강제**([backend/app/routes/auth.py:262-268](../backend/app/routes/auth.py#L262-L268)). FE `updateLinkStatus`는 linkId만 보내고 본인 여부를 자체 검증하지 않음 — 호출 UI가 생기면 403 처리/소유 링크 필터링을 FE에서 챙겨야 함.
- 공동보호자 제거 `removeGuardian`도 정의만 있고 미호출, real 모드는 throw — [auth.ts:1000-1028](../frontend/src/api/auth.ts#L1000-L1028)
- **결론: B-4는 "미구현"이 정답.** 해제 UI를 새로 만들 때 (1) confirm 다이얼로그, (2) 본인 명의 링크만 노출/요청, (3) 403 핸들링을 함께 설계해야 함.

### E-1~4 — BE 미확정 항목 현황

| 항목 | 현황 | 처리 방식 | 근거 |
|---|---|---|---|
| **E-1 senior 표시명** | placeholder | real `getGuardianSeniors`가 `어르신 {senior_id 앞 4자}`로 채움. `updateLinkStatus`도 동일 placeholder | [auth.ts:818-819](../frontend/src/api/auth.ts#L818-L819), [auth.ts:853-854](../frontend/src/api/auth.ts#L853-L854) |
| **E-2 세션복원(/auth/me)** | stub | real `restoreSession`은 **메모리 `realCurrentUser`에만 의존** → 새로고침/재부팅 시 null 반환(복원 실패). `/auth/me` 미호출 | [auth.ts:386](../frontend/src/api/auth.ts#L386), [auth.ts:1058-1081](../frontend/src/api/auth.ts#L1058-L1081) |
| **E-3 초대 사용여부 조회** | 캐시 우회 | real pending 목록은 서버 조회 없이 `moa.real.pendingInvites.v1` localStorage 캐시. 기기/브라우저 간 동기화 안 됨(주석에 TODO 명시) | [auth.ts:592-602](../frontend/src/api/auth.ts#L592-L602), [auth.ts:876-884](../frontend/src/api/auth.ts#L876-L884) |
| **E-4 senior PII 입력경로** | placeholder | senior register는 `birth_date:"1940-01-01"`, `phone:"010-0000-0000"` 하드코딩 전송. 보호자 register도 `1970-01-01` placeholder | senior [auth.ts:716-720](../frontend/src/api/auth.ts#L716-L720), guardian [auth.ts:532-536](../frontend/src/api/auth.ts#L532-L536) |

추가 정합 확인된 부분:
- **A-1 consent**: 클레임 시 `consent`를 `biometric_consent_yn`으로 register에 전달 + 별도 `submitConsent` 호출 — [auth.ts:707-719](../frontend/src/api/auth.ts#L707-L719), [elder-claim.tsx:32](../frontend/app/(auth)/elder-claim.tsx#L32). BE의 "register가 저장"과 정합(단 FE는 submitConsent도 추가로 부르는데 real은 no-op [auth.ts:897-904](../frontend/src/api/auth.ts#L897-L904))
- **A-2 email confirm OFF**: FE가 throwaway 이메일(`senior-{uuid}@moa.app`)을 생성해 즉시 register→login — [auth.ts:287-290](../frontend/src/api/auth.ts#L287-L290), [auth.ts:776-785](../frontend/src/api/auth.ts#L776-L785). Confirm OFF 전제와 정합.

### 기타 스펙↔구현 차이 (FE 내부)

- **가족 탭 노출 조건 확장**: 스펙은 "ACTIVE 링크 1개+"만이나, 구현은 `ACTIVE guardianMember`도 OR 조건 — [authStore.ts:124-130](../frontend/src/stores/authStore.ts#L124-L130). OWNER는 그룹 생성 시 항상 ACTIVE이므로, **부모 연동 0명이어도 초대를 한 번 발급(그룹 생성)하면 가족 탭이 보임**. 평탄 모델 의도일 수 있으나 스펙과 다르므로 의논 필요(5장).
- **provision 방식 변경**: 스펙 `POST /guardian/elders`(계정+PENDING 링크+코드 동시 생성)이지만, 실제는 `POST /auth/invite`(토큰만) → senior 가입 시 계정·링크 생성. BE 재량 계약(B-3)을 따라간 것으로, **스펙 6번 표가 구버전**임.

---

## 4. 수정해야 할 항목

### [FE 단독으로 고칠 수 있는 것]

| 우선 | 항목 | 위치 |
|---|---|---|
| **높음** | 연동 해제 UI 신규 구현 — 보호자 설정/가족 카드에 해제 버튼 + confirm + 본인 링크만 노출 + 403 핸들링. 이미 있는 `updateLinkStatus` 재사용 | [SettingsPage.tsx](../frontend/src/pages/SettingsPage.tsx) / [FamilyHubPage.tsx](../frontend/src/pages/FamilyHubPage.tsx) |
| 중 | 가족 탭 노출 조건을 스펙대로 "ACTIVE 링크 기준"으로 좁힐지 결정·반영 | [authStore.ts:124-130](../frontend/src/stores/authStore.ts#L124-L130) |
| 중 | UI 문구 "어르신" 잔존 정리(CLAUDE.md 절대규칙 7 "직접사용자") — onboarding/FamilyHub 문구·placeholder | [onboarding.tsx:54,83,129,137](../frontend/app/onboarding.tsx#L54), [auth.ts:819,854](../frontend/src/api/auth.ts#L819) |
| 낮음 | 스펙 6번 API 표를 실제 계약(`/auth/invite` 등)으로 갱신 | [docs/03_auth_onboarding_spec.md](03_auth_onboarding_spec.md) |
| 낮음 | `claimSenior`가 register(consent 포함)+submitConsent를 이중 호출 — 정리 검토 | [auth.ts:778-791](../frontend/src/api/auth.ts#L778-L791) |

### [BE 의존 — BE 합의/엔드포인트 필요]

| 우선 | 항목 | 비고 |
|---|---|---|
| **높음** | **E-2 세션복원**: `/auth/me`(또는 refresh로 재발급) 생기면 real `restoreSession`을 서버 기반으로 교체 → 새로고침 후 로그인 유지 | 현재 메모리 의존이라 real 모드 자동로그인 사실상 미작동 |
| **높음** | **E-1 표시명**: `/auth/guardian/seniors` 응답에 senior name 포함 시 placeholder 제거 | 가족 카드/리포트 이름 정확도 |
| 중 | **E-3 초대 사용여부**: 서버 기준 미사용 invite 목록 GET API → localStorage 캐시 제거(기기 동기화) | |
| 중 | **E-4 PII 입력**: senior/guardian 생년월일·전화 실제 수집 UI + 전송 (현 placeholder) | 가입 화면에 입력 필드 추가 동반 |
| 낮음 | 공동보호자 초대/수락/제거 API (현 real 모드 throw) | MVP 범위 여부 확인 |

---

## 5. 재량 / 의논 필요

1. **가족 탭 노출 기준** — 스펙("ACTIVE 링크 1개+") vs 구현(OWNER ACTIVE면 노출). 부모 연동 0명인 보호자에게 가족 탭을 보일지(빈 상태 안내 카드는 이미 있음 [FamilyHubPage.tsx:97-106](../frontend/src/pages/FamilyHubPage.tsx#L97-L106)) 팀 결정 필요.
2. **공동보호자(SUB_GUARDIAN) 범위** — FamilyHub/authStore에 평탄 모델로 꽤 구현돼 있으나 BE real 미지원. MVP 포함인지, mock 데모로만 둘지.
3. **연동 해제 위치/정책** — 보호자만 해제 가능한지, senior 쪽에서도 가능한지, REVOKED 후 재초대 흐름. BE는 본인 링크만 허용(403)이므로 UI도 그에 맞춰야 함.
4. **real 모드 자동로그인 UX** — `/auth/me` 전까지 새로고침 시 로그아웃되는 문제를 임시로 어떻게 안내할지(또는 refresh 토큰 기반 임시 복원).
5. **DEV 자동로그인 스위치** 유지 여부 — 데모/제출 시 OFF 확인 필요([authStore.ts:65-72](../frontend/src/stores/authStore.ts#L65-L72)).

---

## 6. 이 영역의 git 커밋 흐름

스펙의 Stage 0~5 단계가 커밋에 거의 그대로 드러남:

```
7ed65aa refactor: 모노레포 구조 재정리 (frontend/ backend/ ml/)   ← 기반
0402803 가입-로그인 mock 흐름 구현 (역할별 홈 분기)               ← Stage 1
4b93c6c 보호자 온보딩 및 캐릭터 대시보드 반영
1bd5eaa fix: 온보딩 문구 조사 수정
d6dc3d9 feat: Stage 2 보호자 프로비저닝 흐름 + 인증 화면 코랄 통일  ← Stage 2
f11b380 feat: Stage 3 직접사용자 클레임 흐름 (동의→코드→자동로그인) ← Stage 3
3ff387f feat: Stage 4 메인 구조 통합 (ChatbotMain 공통화)         ← Stage 4
664daa0 feat: Stage 5 가족 탭 완성 + 연동 상태 가시성             ← Stage 5
3c3016e feat: add family group guardian invite flow             ← 공동보호자 확장
b1a72d4 feat: 가족연동 FE 정합성 정렬(Supabase Auth 계약) + dev 자동로그인 ← UUID/계약 정렬
15b59f1 feat: add testable family invite auth flow
16d3daf fix: mock 초대 MOA-DEV 상시 리시드 + resetMockDb 헬퍼      ← 테스트 편의
d57145e feat: 가족 초대 MVP 플로우 정리                           ← 현재
```

발전 서사:
1. **모노레포 정리 → mock 가입/로그인**(역할 분기)로 골격.
2. **Stage 2~5**: 보호자 provision → elder 클레임(동의→코드→자동로그인) → 챗봇 메인 공통화 → 가족 탭. 스펙 단계 충실히 따라감.
3. **공동보호자(FamilyGroup/GuardianMember)** 모델로 확장(스펙 범위 밖, 평탄 모델).
4. **`b1a72d4`에서 BE 실제 계약(Supabase Auth)에 맞춰 대전환** — ID를 number→UUID, provision을 `/guardian/elders`→`/auth/invite`(토큰만)+senior 가입 시 ACTIVE 링크로 재정렬. 현재 B-3/A-1/A-2 정합은 이 커밋에서 확립.
5. 이후 **mock 테스트 편의**(MOA-DEV 리시드, resetMockDb, dev 자동로그인)와 초대 플로우 정리로 마무리.

---

## 한 줄 요약

mock 기준 **역할선택→가입→provision→클레임→자동로그인→가족허브→리포트** end-to-end 동작하며 B-3/A-1/A-2는 BE 계약과 정합. 가장 큰 공백은 **(1) 연동 해제 UI 전무(B-4)**, **(2) real 모드 세션복원/표시명/초대목록/PII가 placeholder·캐시 의존(E-1~4)** — 이 중 해제 UI·문구정리·탭조건은 FE 단독, 나머지는 BE 엔드포인트 합의가 선행돼야 한다.

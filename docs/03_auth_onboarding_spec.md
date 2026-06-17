# MOA — 인증 / 온보딩 구현 스펙 (Claude Code용)

> 이 문서는 Claude Code가 작업 전 반드시 읽는 단일 기준 문서다.
> 저장 위치 권장: `frontend/docs/03_auth_onboarding_spec.md` + `CLAUDE.md`에서 링크.
> 스택: React Native + Expo(managed) + TypeScript(5.8.x) + NativeWind + Expo Router + Zustand + expo-av

---

## 0. 작업 원칙 (가장 중요)

1. **기존 코드를 먼저 파악한 뒤 손댄다.** 이미 작업된 화면·라우팅·상태가 있으므로, 새로 만들기 전에 현재 구조를 읽고 재사용/확장 우선.
2. **단계별로 진행한다.** 한 번에 전체를 만들지 말 것. 각 단계 끝에서 멈추고 결과를 보고한다.
3. **백엔드는 아직 미완성.** API는 아래 6번 계약대로 클라이언트를 구현하되, 응답은 목(mock)으로 처리해 화면이 독립적으로 돌아가게 한다.

---

## 1. 확정된 구조 (한눈에)

```
앱 최초 진입
   └─ 역할 선택: [직접사용자]  [보호자]
        │
        ├─ 보호자 ──▶ 회원가입(이메일/비번) ──▶ 첫 진입: 가족 설정 ──▶ 메인(음성 챗봇)
        │                                                          + 가족 탭(추가)
        │
        └─ 직접사용자 ─▶ 생체정보 동의 ──▶ 초대코드 입력 ──▶ 자동 로그인 ──▶ 메인(음성 챗봇)
```

- **메인 화면(음성 챗봇 "모아")은 보호자·직접사용자 공통.** 보호자도 자기 음성 체크인을 여기서 한다(= 내 리포트).
- **보호자만 네비게이션에 `가족 탭`이 추가**된다 → 가족 구성 + 부모님 리포트 + 내 리포트.
- **직접사용자에게는 가족 탭이 없다.** 메인 + 최소 메뉴만.

---

## 2. 라우팅 구조 (Expo Router)

기존 `(elder)` / `(guardian)` 그룹을 유지·확장한다. 메인 챗봇 화면은 **공통 컴포넌트로 추출**해 두 그룹에서 재사용.

```
app/
  _layout.tsx              # 루트 가드: 인증·역할 보고 (auth)/(elder)/(guardian)로 redirect
  (auth)/
    role-select.tsx        # [직접사용자] [보호자] 선택
    guardian-signup.tsx    # 보호자 회원가입
    family-setup.tsx       # 보호자 첫 진입 가족 설정 (부모님 추가 → 코드 발급)
    elder-consent.tsx      # 직접사용자 생체정보 동의
    elder-claim.tsx        # 직접사용자 초대코드 입력 → 클레임
  (elder)/
    _layout.tsx            # 직접사용자 탭: 메인 / 기록 / 안부 / 설정  (가족 탭 없음)
    index.tsx              # = 공통 챗봇 메인
  (guardian)/
    _layout.tsx            # 보호자 탭: 메인 / 가족 / 리포트 / 설정
    index.tsx              # = 공통 챗봇 메인
    family/                # 가족 구성 + 부모님 상세 리포트 + 내 리포트
components/
  ChatbotMain.tsx          # 공통 메인(두 그룹이 공유)
  CharacterPlayer.tsx      # 기존 추상화 유지 (mp4 → Lottie 교체 대비)
```

- 루트 `_layout`은 Zustand 인증 상태를 읽어 분기. **직접사용자는 `(guardian)` 라우트 접근 자체 차단.**

---

## 3. 상태 (Zustand)

```ts
type Role = 'elder' | 'guardian';

interface AuthState {
  userId: number | null;
  role: Role | null;
  accessToken: string | null;
  refreshToken: string | null;   // 직접사용자 장수명(자동 로그인)
  consentDone: boolean;
  links: Array<{ linkId: number; counterpartId: number; counterpartName: string; relation: 'elder' | 'guardian'; status: 'PENDING' | 'ACTIVE' }>;
  hasGuardianTab: boolean;        // role==='guardian' && ACTIVE 링크 1개 이상
}
```

- `hasGuardianTab` 로 가족 탭 노출 여부를 제어. (보호자라도 연동 0명이면 탭 숨김 → 대신 메인에 "부모님 연결하기" 안내)

---

## 4. 화면별 요구사항

### (auth) role-select
- 큰 버튼 2개: `직접사용자` / `보호자`. 색+아이콘+텍스트 병행.

### (auth) guardian-signup
- 이메일/비번/이름/생년월일/성별. 일반 회원가입.

### (auth) family-setup (보호자 첫 진입)
- "부모님 추가" → 이름·생년월일·성별 입력 → **페어링 코드 발급 화면**(코드 + 공유 버튼).
- 건너뛰기 허용 → 메인 진입(가족 탭은 아직 숨김, 메인에 연결 안내).

### (auth) elder-consent / elder-claim (직접사용자)
- **화면 순서**: 생체정보 동의 → 초대코드 입력. (사용자 요구 순서)
- **단, 커밋 순서 주의**: 초대코드로 계정을 클레임해야 동의를 그 계정에 기록할 수 있다.
  → FE는 동의 의사를 로컬에 보관했다가, 코드 클레임 직후 동의를 함께 제출한다(claim → consent).
- 동의 문구 **18pt 이상**, 핵심 텍스트 22pt+. 단일 대형 버튼.
- 성공 시 refresh 토큰 보관 → 이후 자동 로그인.

### (elder) 메인 / (guardian) 메인
- 공통 `ChatbotMain` + `CharacterPlayer`. 캐릭터 mood prop 유지(`idle|listening|happy|worried`).

### (guardian) 가족 탭
- 가족 구성(부모님·형제 + 역할/연동상태) · 부모님 상세 리포트 대시보드 · 내 리포트.

---

## 5. 제약 (반드시 준수 — 위반 시 재작업)

- **빨간색 절대 금지.** 경고/주의/경보는 **앰버 `#E8943A` 단독**. 색은 항상 **아이콘+텍스트와 병행**(색각 이상 대응).
- **세이지그린 사용 금지.** 브랜드 컬러 미확정 → 중립 팔레트 + 앰버(경고)로만. 디자인 토큰은 `frontend/src/styles/tokens.ts` 참조.
- **직접사용자 화면**: 최소 18pt, 핵심 22pt+. 버튼 단순. 수치·의학 점수 비표시.
- **진단 표현 금지**: "진단/처방/치료" ✕ → "감지/경보/참고" ○.
- **CharacterPlayer 추상화 유지**: 현재 mp4(`사랑.mp4`), 향후 Lottie 교체 시 호출부 수정 없도록.
- 다크모드 미제공.

---

## 6. API 계약 (백엔드 미완성 → 목으로 구현)

`{ "success": true, "data": {...} }` 엔벨로프. (상세는 `provisioning_schema_api_agreement.md` 참조)

| 흐름 | 메서드 · 경로 | 비고 |
|---|---|---|
| 보호자 가입 | `POST /auth/register` | login_id/password 필수 |
| 부모님 프로비저닝 | `POST /guardian/elders` | 계정+PENDING 링크+페어링 코드 |
| 직접사용자 클레임 | `POST /auth/claim` | 코드 → JWT(access+refresh) |
| 직접사용자 동의 | `POST /elders/me/consent` | 링크 PENDING→ACTIVE |
| 가족 목록 | `GET /guardian/links` | 가족 탭 데이터 |

- FE는 `services/api.ts`에 위 계약대로 함수 시그니처를 만들고, 내부는 목 응답으로 시작. 백엔드 완료 시 목만 교체.

---

## 7. 작업 단계 (순서대로, 단계마다 멈춤)

- **Stage 0** — 현재 코드 구조 파악 후 보고 (변경 없음)
- **Stage 1** — `(auth)` 역할 선택 + 루트 가드 라우팅 + Zustand authStore 골격
- **Stage 2** — 보호자 흐름: 가입 → family-setup → 메인 진입 (가족 탭 조건부)
- **Stage 3** — 직접사용자 흐름: 동의 → 코드 클레임 → 자동 로그인 → 메인
- **Stage 4** — 가족 탭: 가족 구성 + 부모님 리포트 + 내 리포트
- 각 단계: 목 API로 화면 독립 동작 확인 → 다음 단계 진행 여부는 사람이 결정.

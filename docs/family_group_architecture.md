# Family Group Architecture

## 1. 현재 모델 문제점

현재 인증/연동 구조는 `Guardian ↔ Elder`의 1:1 또는 보호자 기준 링크 목록에 가깝다.

대표적인 한계는 다음과 같다.

- 보호자와 직접사용자의 관계가 `FamilyLink` 하나에 직접 묶여 있어, 여러 보호자가 같은 직접사용자를 함께 돌보는 구조를 표현하기 어렵다.
- `OWNER`와 `SUB_GUARDIAN` 같은 보호자 권한 차이가 없다.
- 부모님이 여러 명인 가족 단위, 예를 들어 아버지와 어머니를 같은 보호자 그룹이 함께 돌보는 구조를 자연스럽게 표현하기 어렵다.
- 초대 코드는 현재 직접사용자 페어링에 집중되어 있어, 보호자 초대와 직접사용자 페어링이 구분되지 않는다.
- 가족 탭의 "함께 돌보는 가족"은 실제 멤버십 모델이 아니라 mock 표시 데이터에 가깝다.
- 링크 상태가 보호자 앱과 직접사용자 앱 사이에서 장기적으로 동기화되는 구조가 아직 명확하지 않다.

따라서 최종 구조는 개별 링크가 아니라 `FamilyGroup`을 중심으로 두고, 직접사용자와 보호자를 각각 그룹의 멤버로 연결하는 방식이 적합하다.

## 2. FamilyGroup 모델 제안

`FamilyGroup`은 하나의 돌봄 단위를 의미한다. 한 그룹 안에는 여러 직접사용자와 여러 보호자가 존재할 수 있다.

예시:

```ts
interface FamilyGroup {
  id: string;
  name: string;
  createdByGuardianId: string;
  createdAt: string;
  updatedAt: string;
  status: "ACTIVE" | "REVOKED";
}
```

예시 데이터:

```ts
const familyGroupA = {
  id: "family-1",
  name: "김순자 가족",
  createdByGuardianId: "guardian-1",
  createdAt: "2026-06-17T00:00:00.000Z",
  updatedAt: "2026-06-17T00:00:00.000Z",
  status: "ACTIVE",
};
```

직접사용자 목록은 별도 멤버 테이블로 분리한다.

```ts
interface FamilyElderMember {
  id: string;
  familyGroupId: string;
  elderId: string;
  elderName: string;
  relationLabel?: string;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  pairingCode?: string;
  pairedAt?: string;
  createdAt: string;
}
```

`PENDING`은 대표보호자가 부모님을 등록했지만, 직접사용자가 아직 본인 기기에서 생체정보 동의와 pairing code 입력을 완료하지 않은 상태다.

## 3. GuardianMember 모델 제안

보호자는 `FamilyGroup`에 멤버로 참여한다. 같은 사용자 역할은 `GUARDIAN`이지만, 그룹 안에서의 권한은 `GuardianMemberRole`로 나눈다.

```ts
type Role = "ELDER" | "GUARDIAN";
type GuardianMemberRole = "OWNER" | "SUB_GUARDIAN";

interface GuardianMember {
  id: string;
  familyGroupId: string;
  guardianId: string;
  guardianName: string;
  memberRole: GuardianMemberRole;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  invitedByGuardianId?: string;
  inviteCode?: string;
  inviteExpiresAt?: string;
  joinedAt?: string;
  createdAt: string;
}
```

권한 기준:

- `OWNER`: 대표보호자. 직접사용자 등록, 부보호자 초대, 부보호자 제거, 그룹 설정 변경 가능.
- `SUB_GUARDIAN`: 부보호자. 가족 탭 조회, 건강 리포트 조회, 이상징후 알림 확인 가능. 직접사용자 추가/보호자 제거 같은 관리 권한은 제한한다.

초기 MVP에서는 권한을 다음처럼 단순화해도 된다.

```ts
const permissions = {
  OWNER: ["READ_FAMILY", "READ_REPORT", "INVITE_GUARDIAN", "REMOVE_GUARDIAN", "ADD_ELDER"],
  SUB_GUARDIAN: ["READ_FAMILY", "READ_REPORT"],
};
```

## 4. 상태 전이

직접사용자 멤버 상태:

```text
PENDING
  대표보호자가 직접사용자 등록
  pairing code 발급

ACTIVE
  직접사용자가 생체정보 동의
  pairing code 입력
  claim 성공

REVOKED
  대표보호자가 연결 해제
  또는 직접사용자가 연결 철회
```

보호자 멤버 상태:

```text
PENDING
  OWNER가 부보호자 초대
  invite code 또는 invite link 발급

ACTIVE
  부보호자가 회원가입 또는 로그인
  초대 수락
  FamilyGroup 참여 완료

REVOKED
  OWNER가 부보호자 제거
  또는 부보호자가 가족 그룹 나가기
```

주의할 점:

- 직접사용자 pairing code와 보호자 invite code는 목적이 다르므로 API와 타입에서 분리한다.
- `PENDING` 직접사용자는 가족 탭에 "연결 대기 중"으로 표시할 수 있다.
- `PENDING` 부보호자는 가족 탭의 보호자 목록에 "초대 대기 중"으로 표시할 수 있다.

## 5. API 설계 초안

### createFamilyGroup

대표보호자가 첫 직접사용자를 등록할 때 FamilyGroup을 생성한다.

```http
POST /family-groups
```

Request:

```json
{
  "name": "김순자 가족"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "familyGroupId": "family-1",
    "ownerGuardianMemberId": "guardian-member-1"
  }
}
```

### provisionElder

FamilyGroup에 직접사용자를 등록하고 pairing code를 발급한다.

```http
POST /family-groups/{familyGroupId}/elders
```

Request:

```json
{
  "name": "김순자",
  "relationLabel": "어머니"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "elderMember": {
      "id": "family-elder-1",
      "familyGroupId": "family-1",
      "elderId": "elder-1",
      "elderName": "김순자",
      "status": "PENDING"
    },
    "pairingCode": "MOA-ABC"
  }
}
```

### claimElderPairing

직접사용자가 생체정보 동의 후 pairing code를 입력해 FamilyGroup에 연결된다.

```http
POST /auth/claim
```

Request:

```json
{
  "pairingCode": "MOA-ABC"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "elder-1",
      "name": "김순자",
      "role": "ELDER"
    },
    "familyGroupId": "family-1",
    "elderMemberStatus": "ACTIVE",
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

### inviteGuardian

대표보호자가 부보호자를 초대한다.

```http
POST /family-groups/{familyGroupId}/guardians/invite
```

Request:

```json
{
  "name": "자녀1",
  "phoneOrEmail": "child1@example.com",
  "memberRole": "SUB_GUARDIAN"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "guardianMember": {
      "id": "guardian-member-2",
      "familyGroupId": "family-1",
      "guardianName": "자녀1",
      "memberRole": "SUB_GUARDIAN",
      "status": "PENDING"
    },
    "inviteCode": "FAM-123",
    "inviteLink": "moa://guardian-invite/FAM-123"
  }
}
```

### acceptGuardianInvite

부보호자가 회원가입 또는 로그인 후 초대를 수락한다.

```http
POST /guardian-invites/accept
```

Request:

```json
{
  "inviteCode": "FAM-123"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "familyGroupId": "family-1",
    "guardianMember": {
      "id": "guardian-member-2",
      "guardianId": "guardian-2",
      "guardianName": "자녀1",
      "memberRole": "SUB_GUARDIAN",
      "status": "ACTIVE"
    }
  }
}
```

### removeGuardian

대표보호자가 부보호자를 제거한다.

```http
DELETE /family-groups/{familyGroupId}/guardians/{guardianMemberId}
```

Response:

```json
{
  "success": true,
  "data": {
    "guardianMemberId": "guardian-member-2",
    "status": "REVOKED"
  }
}
```

### listFamilyMembers

가족 탭에서 직접사용자와 보호자를 함께 조회한다.

```http
GET /family-groups/{familyGroupId}/members
```

Response:

```json
{
  "success": true,
  "data": {
    "familyGroup": {
      "id": "family-1",
      "name": "김순자 가족"
    },
    "elders": [
      {
        "id": "family-elder-1",
        "elderId": "elder-1",
        "elderName": "김순자",
        "relationLabel": "어머니",
        "status": "ACTIVE"
      }
    ],
    "guardians": [
      {
        "id": "guardian-member-1",
        "guardianId": "guardian-1",
        "guardianName": "대표보호자",
        "memberRole": "OWNER",
        "status": "ACTIVE"
      },
      {
        "id": "guardian-member-2",
        "guardianId": "guardian-2",
        "guardianName": "자녀1",
        "memberRole": "SUB_GUARDIAN",
        "status": "ACTIVE"
      }
    ]
  }
}
```

## 6. 현재 구조에서 마이그레이션 방법

현재 구조:

```ts
interface FamilyLink {
  linkId: number;
  counterpartId: number;
  counterpartName: string;
  relation: "elder" | "guardian";
  status: "PENDING" | "ACTIVE";
  pairingCode?: string;
}
```

마이그레이션 방향:

1. 기존 `FamilyLink`를 `FamilyElderMember`로 해석한다.
2. 보호자가 첫 부모님을 등록하는 순간 `FamilyGroup`을 생성한다.
3. 해당 보호자는 자동으로 `GuardianMember(OWNER)`가 된다.
4. 기존 `links` 배열은 임시로 `elderMembers` 역할을 유지한다.
5. 새 store 필드를 단계적으로 추가한다.

권장 store 초안:

```ts
interface AuthState {
  user: SessionUser | null;
  role: Role | null;
  familyGroupId: string | null;
  guardianMemberRole: GuardianMemberRole | null;
  elderMembers: FamilyElderMember[];
  guardianMembers: GuardianMember[];
  hasGuardianTab: boolean;
}
```

단계별 적용:

1. `FamilyLink`를 바로 제거하지 말고 `FamilyElderMember`로 이름만 확장한다.
2. `hasGuardianTab` 계산식을 `guardianMembers`와 `elderMembers` 기반으로 바꾼다.
3. `provisionGuardianElder()` 응답에 `familyGroup`, `elderMember`, `guardianMember`를 포함한다.
4. 가족 탭은 `listFamilyMembers()` 결과를 기준으로 렌더링한다.
5. mock 단계에서는 in-memory store로 시작하되, 실제 백엔드 전환 시 FamilyGroup 단위 API로 교체한다.

임시 호환 전략:

```ts
const hasGuardianTab =
  role === "GUARDIAN" &&
  elderMembers.some((member) => member.status === "ACTIVE");
```

향후에는 부보호자도 `guardianMembers`에 포함되므로, `OWNER` 여부와 무관하게 가족 탭을 볼 수 있다.

```ts
const canViewFamily =
  role === "GUARDIAN" &&
  guardianMembers.some((member) => member.status === "ACTIVE");
```

## 7. 추가 구현이 필요한 화면 목록

### 보호자

- 가족 그룹 생성 또는 첫 부모님 등록 화면
- 부모님 추가 화면
- pairing code 발급 화면
- 가족 탭 허브
- 부모님 상세 리포트 화면
- 이상징후 알림 이력 화면
- 보호자 목록 화면
- 부보호자 초대 화면
- 부보호자 초대 코드/링크 공유 화면
- PENDING 부보호자 관리 화면
- 부보호자 제거 확인 모달

### 부보호자

- 초대 코드 입력 화면
- 초대 링크 진입 화면
- 초대 수락 확인 화면
- 이미 계정이 있는 사용자의 로그인 후 초대 수락 화면
- 새 회원가입 후 초대 수락 화면
- 참여 완료 후 가족 탭 진입 화면

### 직접사용자

- 생체정보 동의 화면
- pairing code 입력 화면
- 연결 완료 화면
- 연결 해제 또는 보호자 확인 화면

### 공통

- `ChatbotMain`
- 역할별 라우트 가드
- 세션 복원 후 FamilyGroup/멤버 목록 hydrate
- 권한별 접근 제어
- `PENDING`, `ACTIVE`, `REVOKED` 상태 표시 컴포넌트

## MVP 권장 구현 순서

1. 타입과 mock store에 `FamilyGroup`, `FamilyElderMember`, `GuardianMember` 추가
2. 기존 `FamilyLink` 사용처를 `FamilyElderMember` 의미로 점진 치환
3. 대표보호자 첫 등록 시 `FamilyGroup + OWNER + PENDING elder` 생성
4. 직접사용자 claim/consent 완료 시 elder member를 `ACTIVE`로 전환
5. 가족 탭에서 보호자 목록을 mock 기반으로 표시
6. `inviteGuardian`과 `acceptGuardianInvite` mock API 추가
7. 부보호자 초대/수락 화면 추가
8. 실제 백엔드 API 전환

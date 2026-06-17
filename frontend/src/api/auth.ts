// 인증 API 레이어.
// 함수 시그니처는 실제 API 규격(backend /auth/*)에 맞추고, 내부는 지금 mock 응답을 반환한다.
// 백엔드 명세가 확정되면 각 함수 "내부만" fetch로 교체하면 됨 (호출부는 그대로).
import type { SessionUser, UserRole, FamilyLink } from "../stores/authStore";
import { saveToken, getToken, clearToken } from "./session";

// 백엔드 공통 응답 엔벨로프 (spec §6: { success, data }).
export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

// ── mock 계정 저장소 (백엔드 연동 시 이 블록 전체 제거) ──────────────
interface MockAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  relation?: string; // 어른 ↔ 보호자 관계 (예: "어머니")
  linkedElderId?: string; // 보호자 → 담당 어른 id
  voiceConsentAt?: string; // 음성 데이터 동의 시각(ISO)
}

// 어른 일상 테스트용 기본 계정. "보호자가 미리 생성해 둔 어른 계정"이라는 가정.
const mockAccounts: MockAccount[] = [
  { id: "elder-1", name: "김순자", email: "elder@moa.app", password: "moa00000", role: "elder" },
];
const mockFamilyLinks: FamilyLink[] = [];

const makeToken = (id: string) => `mock-token-${id}`;
const idNumberOf = (id: string): number => {
  const digits = id.replace(/\D/g, "");
  return digits ? Number(digits) : Date.now();
};
const makePairingCode = (): string =>
  `${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 5)}`.toUpperCase();

function toSession(acc: MockAccount): SessionUser {
  return { id: acc.id, name: acc.name, role: acc.role, token: makeToken(acc.id) };
}
// ─────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

// 실제: POST /auth/login → { access_token, role, name, id }
export async function login({ email, password }: LoginPayload): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  const acc = mockAccounts.find((a) => a.email === normalized);
  if (!acc || acc.password !== password) {
    throw new Error("이메일 또는 비밀번호가 올바르지 않아요.");
  }
  const user = toSession(acc);
  await saveToken(user.token);
  return user;
}

// 실제: POST /auth/register
export async function register({ name, email, password, role }: RegisterPayload): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  if (mockAccounts.some((a) => a.email === normalized)) {
    throw new Error("이미 가입된 이메일이에요.");
  }
  const acc: MockAccount = { id: `${role}-${Date.now()}`, name: name.trim(), email: normalized, password, role };
  mockAccounts.push(acc);
  const user = toSession(acc);
  await saveToken(user.token);
  return user;
}

// 실제: POST /auth/logout (+ 토큰 폐기)
export async function logout(): Promise<void> {
  await clearToken();
}

export interface CreateElderPayload {
  guardianId: string;
  name: string;
  relation?: string;
}

export interface ProvisionGuardianElderPayload {
  guardianId: string;
  name: string;
  relation?: string;
}

export interface GuardianElderProvisioningData {
  elder: SessionUser;
  link: FamilyLink;
  pairing_code: string;
}

// 실제: POST /guardian/elders
// 보호자가 어른 계정과 PENDING 가족 링크를 만들고, 어르신 기기에서 입력할 페어링 코드를 받는다.
export async function provisionGuardianElder({
  guardianId,
  name,
  relation,
}: ProvisionGuardianElderPayload): Promise<ApiEnvelope<GuardianElderProvisioningData>> {
  const now = Date.now();
  const id = `elder-${now}`;
  const elder: MockAccount = {
    id,
    name: name.trim(),
    email: `${id}@moa.app`,
    password: "",
    role: "elder",
    relation,
  };
  mockAccounts.push(elder);

  const link: FamilyLink = {
    linkId: now,
    counterpartId: idNumberOf(id),
    counterpartName: elder.name,
    relation: "elder",
    status: "PENDING",
  };
  mockFamilyLinks.push(link);

  const guardian = mockAccounts.find((a) => a.id === guardianId);
  if (guardian) {
    guardian.linkedElderId = id;
    guardian.relation = relation;
  }

  return {
    success: true,
    data: {
      elder: toSession(elder),
      link,
      pairing_code: makePairingCode(),
    },
  };
}

// 보호자가 어른 계정을 생성·연결 (어른 본인은 가입 절차를 거치지 않음).
// 실제: POST /elders (보호자 토큰으로). 어른은 이후 자동 로그인으로 진입.
export async function createElderAccount({
  guardianId,
  name,
  relation,
}: CreateElderPayload): Promise<SessionUser> {
  const id = `elder-${Date.now()}`;
  const elder: MockAccount = {
    id,
    name: name.trim(),
    email: `${id}@moa.app`,
    password: "", // 어른은 매일 입력하는 비밀번호를 두지 않음 (자동 로그인)
    role: "elder",
    relation,
  };
  mockAccounts.push(elder);

  const guardian = mockAccounts.find((a) => a.id === guardianId);
  if (guardian) {
    guardian.linkedElderId = id;
    guardian.relation = relation;
  }
  return toSession(elder);
}

// 음성 데이터 수집·분석에 대한 동의 기록 (보호자가 온보딩에서 진행).
// 실제: POST /elders/{id}/consent
export async function recordVoiceConsent(elderId: string): Promise<void> {
  const elder = mockAccounts.find((a) => a.id === elderId);
  if (elder) elder.voiceConsentAt = new Date().toISOString();
}

// 앱 시작 시 세션 복원.
// 실제: 저장된 토큰을 검증하고 프로필을 조회. mock: 토큰이 있으면 기본 어른 세션을 통과시킴.
export async function restoreSession(): Promise<SessionUser | null> {
  const token = await getToken();
  if (!token) return null;
  const acc = mockAccounts.find((a) => makeToken(a.id) === token);
  return acc ? toSession(acc) : null;
}

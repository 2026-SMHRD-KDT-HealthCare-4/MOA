// 인증 API 레이어.
// 함수 시그니처는 실제 API 규격(backend /auth/*)에 맞추고, 내부는 지금 mock 응답을 반환한다.
// 백엔드 명세가 확정되면 각 함수 "내부만" fetch로 교체하면 됨 (호출부는 그대로).
import type { SessionUser, UserRole, FamilyLink } from "../stores/authStore";
import { saveToken, getToken, clearToken, saveRefreshToken, getRefreshToken } from "./session";

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
  pairingCode?: string; // 직접사용자 계정의 클레임용 페어링 코드
}

// 어른 일상 테스트용 기본 계정. "보호자가 미리 생성해 둔 어른 계정"이라는 가정.
// dev 편의: 페어링 코드 "MOA-DEV"로 클레임 가능.
const mockAccounts: MockAccount[] = [
  { id: "elder-1", name: "김순자", email: "elder@moa.app", password: "moa00000", role: "elder", pairingCode: "MOA-DEV" },
];
const mockFamilyLinks: FamilyLink[] = [];

const makeToken = (id: string) => `mock-token-${id}`;
const makeRefreshToken = (id: string) => `mock-refresh-${id}`;
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
  const pairingCode = makePairingCode();
  const elder: MockAccount = {
    id,
    name: name.trim(),
    email: `${id}@moa.app`,
    password: "",
    role: "elder",
    relation,
    pairingCode,
  };
  mockAccounts.push(elder);

  const link: FamilyLink = {
    linkId: now,
    counterpartId: idNumberOf(id),
    counterpartName: elder.name,
    relation: "elder",
    status: "PENDING",
    pairingCode,
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
      pairing_code: pairingCode,
    },
  };
}

export interface ClaimPayload {
  code: string;
}

export interface ClaimData {
  user: SessionUser; // access 토큰 포함
  accessToken: string;
  refreshToken: string;
  consent_required: boolean; // 생체정보 동의가 아직 안 된 경우 true
}

// 직접사용자 초대코드 클레임.
// 실제: POST /auth/claim → 코드 검증 후 JWT(access+refresh) 발급.
// mock: provision이 발급한 코드(또는 dev 코드 "MOA-DEV")를 수락하고 토큰을 보관한다.
export async function claim({ code }: ClaimPayload): Promise<ApiEnvelope<ClaimData>> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    throw new Error("초대 코드를 입력해 주세요.");
  }
  const elder = mockAccounts.find((a) => a.role === "elder" && a.pairingCode === normalized);
  if (!elder) {
    throw new Error("코드를 확인해 주세요. 보호자에게 받은 코드와 다른 것 같아요.");
  }

  const accessToken = makeToken(elder.id);
  const refreshToken = makeRefreshToken(elder.id);
  await saveToken(accessToken);
  await saveRefreshToken(refreshToken);

  return {
    success: true,
    data: {
      user: toSession(elder),
      accessToken,
      refreshToken,
      consent_required: !elder.voiceConsentAt,
    },
  };
}

export interface SubmitConsentData {
  consentDone: true;
  link: FamilyLink | null; // PENDING→ACTIVE로 전환된 가족 링크
}

// 직접사용자 본인의 생체정보 동의 제출(클레임 직후).
// 실제: POST /elders/me/consent → 해당 GUARDIAN_LINK를 PENDING→ACTIVE로 전환.
export async function submitElderConsent(elderId: string): Promise<ApiEnvelope<SubmitConsentData>> {
  const elder = mockAccounts.find((a) => a.id === elderId);
  if (elder) elder.voiceConsentAt = new Date().toISOString();

  const link = mockFamilyLinks.find((l) => l.counterpartId === idNumberOf(elderId)) ?? null;
  if (link) link.status = "ACTIVE";

  return { success: true, data: { consentDone: true, link } };
}

export interface RestoredSession {
  user: SessionUser;
  consentDone: boolean;
  refreshToken: string;
}

// 앱 시작 시 세션 복원(자동 로그인).
// 실제: SecureStore의 refresh 토큰을 검증하고 새 access 토큰을 발급받는다.
// mock: refresh 토큰에서 계정을 찾아 세션을 재구성(없으면 메모리 access 토큰으로 폴백).
export async function restoreSession(): Promise<RestoredSession | null> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    const acc = mockAccounts.find((a) => makeRefreshToken(a.id) === refreshToken);
    if (acc) {
      await saveToken(makeToken(acc.id));
      return { user: toSession(acc), consentDone: !!acc.voiceConsentAt, refreshToken };
    }
  }

  const token = await getToken();
  if (!token) return null;
  const acc = mockAccounts.find((a) => makeToken(a.id) === token);
  if (!acc) return null;
  return { user: toSession(acc), consentDone: !!acc.voiceConsentAt, refreshToken: refreshToken ?? "" };
}

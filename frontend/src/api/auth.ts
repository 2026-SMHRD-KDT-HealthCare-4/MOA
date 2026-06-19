import type {
  FamilyGroup,
  FamilyLink,
  GuardianMember,
  SessionUser,
  UserRole,
} from "../stores/authStore";
import {
  saveToken,
  getToken,
  clearToken,
  saveRefreshToken,
  getRefreshToken,
} from "./session";

// ───────────────────────────────────────────────────────────────────────────
// 백엔드 계약 = Supabase Auth + FastAPI(/auth/*). 이 파일은 그 계약을 흉내 내는
// mock 레이어다. 실 연동 시 각 함수 내부만 fetch 로 교체하면 되도록, 함수 시그니처와
// 반환 형태를 실제 엔드포인트에 맞춰 둔다.
//
// 보호자 권한은 평탄(flat): 그룹/초대 흐름은 유지하되, 그룹 생성자(OWNER)는
// '생성자·초대 발급자' 라벨일 뿐 권한 우위가 없다. 모든 보호자가 동등하게 조회·관리한다.
// ───────────────────────────────────────────────────────────────────────────

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface MockAccount {
  id: string; // UUID (= Supabase auth.users.id)
  name: string;
  email: string;
  password: string;
  role: UserRole;
  voiceConsentAt?: string;
}

// 직접사용자 초대 토큰(INVITE). BE INVITE 테이블: token/guardian_id/expired_at/is_used.
// seniorName 은 mock 전용 — 실제 INVITE 에는 name 컬럼이 없다.
// TODO(BE 확정): 초대 시 직접사용자 이름을 어디서 받는지 미확정(보호자 입력 vs 등록 시 입력).
interface SeniorInvite {
  token: string;
  guardianId: string;
  familyGroupId: string;
  seniorName?: string;
  expiredAt: string;
  isUsed: boolean;
}

const nowIso = () => new Date().toISOString();
const INVITE_EXPIRE_HOURS = 72;

// RFC4122 v4 형태 UUID (mock용 — 암호학적 보장 불필요).
function makeUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const mockAccounts: MockAccount[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "김보호",
    email: "guardian@moa.app",
    password: "moa00000",
    role: "guardian",
  },
];
const mockFamilyGroups: FamilyGroup[] = [];
const mockFamilyLinks: FamilyLink[] = [];
const mockGuardianMembers: GuardianMember[] = [];
const mockInvites: SeniorInvite[] = [];

// ── DEV 시드 ──────────────────────────────────────────────────────────────
// 보호자 온보딩을 거치지 않고도 직접사용자 클레임을 바로 테스트할 수 있도록,
// 'MOA-DEV' 토큰을 가진 미사용 초대를 하나 심어 둔다. (시드 가드는 guardian@moa.app)
const DEV_GUARDIAN_ID = "11111111-1111-4111-8111-111111111111";
const DEV_FAMILY_GROUP_ID = "22222222-2222-4222-8222-222222222222";
const DEV_FAR_FUTURE = "2999-12-31T00:00:00.000Z";
mockFamilyGroups.push({
  id: DEV_FAMILY_GROUP_ID,
  name: "김보호 가족",
  createdByGuardianId: DEV_GUARDIAN_ID,
  status: "ACTIVE",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});
mockGuardianMembers.push({
  id: "33333333-3333-4333-8333-333333333333",
  familyGroupId: DEV_FAMILY_GROUP_ID,
  guardianId: DEV_GUARDIAN_ID,
  guardianName: "김보호",
  memberRole: "OWNER",
  status: "ACTIVE",
  joinedAt: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
});
mockInvites.push({
  token: "MOA-DEV",
  guardianId: DEV_GUARDIAN_ID,
  familyGroupId: DEV_FAMILY_GROUP_ID,
  seniorName: "김순자",
  expiredAt: DEV_FAR_FUTURE,
  isUsed: false,
});

const makeToken = (id: string) => `mock-token-${id}`;
const makeRefreshToken = (id: string) => `mock-refresh-${id}`;
const makeInviteCode = (): string =>
  `FAM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function toSession(acc: MockAccount): SessionUser {
  return { id: acc.id, name: acc.name, role: acc.role, token: makeToken(acc.id) };
}

// 직접사용자 클레임 시 사람이 직접 입력하지 않는 throwaway 자격증명을 생성한다.
// 직접사용자는 토큰만 입력하고, FE가 이 email/pw 로 Supabase 가입·로그인을 대신 수행한다.
export function generateSeniorCredential(): { email: string; password: string } {
  const uuid = makeUuid();
  return { email: `senior-${uuid}@moa.app`, password: `moa-${makeUuid().slice(0, 12)}` };
}

function groupForGuardian(guardianId: string): FamilyGroup | null {
  const member = mockGuardianMembers.find(
    (m) => m.guardianId === guardianId && m.status === "ACTIVE",
  );
  return member ? mockFamilyGroups.find((g) => g.id === member.familyGroupId) ?? null : null;
}

// 그룹 생성자(OWNER) 멤버십을 보장한다. OWNER 는 '생성자·초대 발급자' 라벨일 뿐 권한 우위 없음.
function ensureFamilyGroupForOwner(guardian: MockAccount): FamilyGroup {
  const existing = groupForGuardian(guardian.id);
  if (existing) return existing;

  const familyGroup: FamilyGroup = {
    id: makeUuid(),
    name: `${guardian.name} 가족`,
    createdByGuardianId: guardian.id,
    status: "ACTIVE",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  mockFamilyGroups.push(familyGroup);
  mockGuardianMembers.push({
    id: makeUuid(),
    familyGroupId: familyGroup.id,
    guardianId: guardian.id,
    guardianName: guardian.name,
    memberRole: "OWNER",
    status: "ACTIVE",
    joinedAt: nowIso(),
    createdAt: nowIso(),
  });
  return familyGroup;
}

function membersForFamily(familyGroupId: string) {
  return {
    familyGroup: mockFamilyGroups.find((g) => g.id === familyGroupId) ?? null,
    links: mockFamilyLinks.filter((l) => l.familyGroupId === familyGroupId),
    guardianMembers: mockGuardianMembers.filter((m) => m.familyGroupId === familyGroupId),
  };
}

function familyStateForUser(user: SessionUser) {
  if (user.role === "guardian") {
    const familyGroup = groupForGuardian(user.id);
    if (!familyGroup) return { familyGroup: null, links: [], guardianMembers: [] };
    return membersForFamily(familyGroup.id);
  }

  // 직접사용자: 본인이 counterpart 인 링크가 속한 그룹.
  const link = mockFamilyLinks.find((l) => l.counterpartId === user.id);
  if (!link?.familyGroupId) return { familyGroup: null, links: [], guardianMembers: [] };
  return membersForFamily(link.familyGroupId);
}

// ───────────────────────────────────────────────────────────────────────────
// 보호자 회원가입 / 로그인 (POST /auth/login, 보호자 self sign-up)
// ───────────────────────────────────────────────────────────────────────────

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

// POST /auth/login → Supabase 세션(access/refresh) 발급. mock 은 SessionUser 로 환원해 반환.
export async function login({ email, password }: LoginPayload): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  const acc = mockAccounts.find((a) => a.email === normalized);
  if (!acc || acc.password !== password) {
    throw new Error("이메일 또는 비밀번호가 올바르지 않아요.");
  }
  const user = toSession(acc);
  await saveToken(user.token);
  await saveRefreshToken(makeRefreshToken(user.id));
  return user;
}

// 보호자 self sign-up (Supabase auth.sign_up + GUARDIAN 프로필 저장).
export async function register({ name, email, password, role }: RegisterPayload): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  if (mockAccounts.some((a) => a.email === normalized)) {
    throw new Error("이미 가입된 이메일이에요.");
  }
  const acc: MockAccount = { id: makeUuid(), name: name.trim(), email: normalized, password, role };
  mockAccounts.push(acc);
  const user = toSession(acc);
  await saveToken(user.token);
  await saveRefreshToken(makeRefreshToken(user.id));
  return user;
}

export async function logout(): Promise<void> {
  await clearToken();
}

// ───────────────────────────────────────────────────────────────────────────
// 직접사용자 초대 토큰 (POST /auth/invite, GET /auth/invite/{token}/verify)
// ───────────────────────────────────────────────────────────────────────────

export interface CreateInvitePayload {
  guardianId: string;
  seniorName?: string;
}

export interface CreateInviteData {
  token: string;
  expired_at: string;
}

// POST /auth/invite — 로그인한 보호자 명의로 초대 토큰 발급(72시간).
export async function createInvite({
  guardianId,
  seniorName,
}: CreateInvitePayload): Promise<ApiEnvelope<CreateInviteData>> {
  const guardian = mockAccounts.find((a) => a.id === guardianId && a.role === "guardian");
  if (!guardian) throw new Error("보호자 계정을 찾을 수 없어요.");

  const familyGroup = ensureFamilyGroupForOwner(guardian);
  const invite: SeniorInvite = {
    token: makeUuid(),
    guardianId,
    familyGroupId: familyGroup.id,
    seniorName: seniorName?.trim() || undefined,
    expiredAt: new Date(Date.now() + INVITE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString(),
    isUsed: false,
  };
  mockInvites.push(invite);
  return { success: true, data: { token: invite.token, expired_at: invite.expiredAt } };
}

export interface VerifyInviteData {
  valid: boolean;
  reason?: "EXPIRED" | "USED" | "NOT_FOUND";
  guardian_name?: string;
  senior_name?: string; // mock 전용 — BE verify 응답엔 없음(TODO).
}

// GET /auth/invite/{token}/verify
export async function verifyInvite(token: string): Promise<ApiEnvelope<VerifyInviteData>> {
  const normalized = token.trim();
  const invite = mockInvites.find((i) => i.token === normalized);
  if (!invite) return { success: true, data: { valid: false, reason: "NOT_FOUND" } };
  if (invite.isUsed) return { success: true, data: { valid: false, reason: "USED" } };
  if (new Date(invite.expiredAt).getTime() < Date.now()) {
    return { success: true, data: { valid: false, reason: "EXPIRED" } };
  }
  const guardian = mockAccounts.find((a) => a.id === invite.guardianId);
  return {
    success: true,
    data: { valid: true, guardian_name: guardian?.name, senior_name: invite.seniorName },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 직접사용자 등록 (POST /auth/senior/register) — 초대한 보호자와 즉시 ACTIVE 연동
// ───────────────────────────────────────────────────────────────────────────

export interface RegisterSeniorPayload {
  invite_token: string;
  email: string;
  password: string;
  name: string;
}

export interface RegisterSeniorData {
  senior: SessionUser;
  link: FamilyLink;
}

// POST /auth/senior/register — 세션을 발급하지 않는다(프로필만 반환). 세션은 login() 으로 별도 획득(2-step).
export async function registerSenior({
  invite_token,
  email,
  password,
  name,
}: RegisterSeniorPayload): Promise<ApiEnvelope<RegisterSeniorData>> {
  const invite = mockInvites.find((i) => i.token === invite_token.trim());
  if (!invite) throw new Error("초대 코드를 확인해 주세요.");
  if (invite.isUsed) throw new Error("이미 사용된 초대 코드예요.");
  if (new Date(invite.expiredAt).getTime() < Date.now()) {
    throw new Error("만료된 초대 코드예요. 보호자에게 재발송을 요청해 주세요.");
  }

  const normalized = email.trim().toLowerCase();
  const senior: MockAccount = {
    id: makeUuid(),
    name: name.trim(),
    email: normalized,
    password,
    role: "elder",
  };
  mockAccounts.push(senior);

  // 초대한 보호자와 즉시 ACTIVE 연동 (BE: register 시 link_status=ACTIVE).
  const link: FamilyLink = {
    linkId: makeUuid(),
    familyGroupId: invite.familyGroupId,
    counterpartId: senior.id,
    counterpartName: senior.name,
    relation: "elder",
    status: "ACTIVE",
    linkedAt: nowIso(),
  };
  mockFamilyLinks.push(link);
  invite.isUsed = true;

  return { success: true, data: { senior: toSession(senior), link } };
}

// ───────────────────────────────────────────────────────────────────────────
// 직접사용자 클레임 오케스트레이터 (UI용)
//   토큰 + 동의 → 자동 credential → registerSenior → login → 세션 저장.
//   사람은 credential 을 입력하지 않는다. (spec 4번)
// ───────────────────────────────────────────────────────────────────────────

export interface ClaimSeniorPayload {
  token: string;
  name?: string;
  consent?: boolean;
}

export interface ClaimSeniorData {
  user: SessionUser;
  refreshToken: string;
  consentDone: boolean;
  familyGroup: FamilyGroup | null;
  links: FamilyLink[];
  guardianMembers: GuardianMember[];
}

export async function claimSenior({
  token,
  name,
  consent,
}: ClaimSeniorPayload): Promise<ApiEnvelope<ClaimSeniorData>> {
  const verify = await verifyInvite(token);
  if (!verify.data.valid) {
    const reason = verify.data.reason;
    if (reason === "EXPIRED") throw new Error("만료된 초대 코드예요. 보호자에게 재발송을 요청해 주세요.");
    if (reason === "USED") throw new Error("이미 사용된 초대 코드예요.");
    throw new Error("코드를 확인해 주세요. 보호자에게 받은 코드와 다른 것 같아요.");
  }

  // 1) 자동 credential 생성 → 2) registerSenior(즉시 ACTIVE) → 3) login(세션 획득)
  const cred = generateSeniorCredential();
  const seniorName = name?.trim() || verify.data.senior_name || "직접사용자";
  await registerSenior({ invite_token: token, email: cred.email, password: cred.password, name: seniorName });
  const user = await login({ email: cred.email, password: cred.password });

  // 4) 동의 제출(미확정 — stub). consent=true 일 때만.
  let consentDone = false;
  if (consent) {
    await submitConsent({ seniorId: user.id });
    consentDone = true;
  }

  const refreshToken = (await getRefreshToken()) ?? "";
  return {
    success: true,
    data: { user, refreshToken, consentDone, ...familyStateForUser(user) },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 연동 목록 / 상태 변경 (GET /auth/guardian/seniors, PATCH /auth/link/{id})
// ───────────────────────────────────────────────────────────────────────────

// GET /auth/guardian/seniors — 평탄 모델: 보호자가 속한 그룹의 모든 연동(PENDING/ACTIVE/REVOKED).
export async function getGuardianSeniors(guardianId: string): Promise<ApiEnvelope<FamilyLink[]>> {
  const familyGroup = groupForGuardian(guardianId);
  const links = familyGroup ? membersForFamily(familyGroup.id).links : [];
  return { success: true, data: links };
}

export interface UpdateLinkStatusPayload {
  linkId: string;
  link_status: "ACTIVE" | "REVOKED";
}

// PATCH /auth/link/{id} — ACTIVE ↔ REVOKED. ("연동 해제" = REVOKED)
export async function updateLinkStatus({
  linkId,
  link_status,
}: UpdateLinkStatusPayload): Promise<ApiEnvelope<FamilyLink>> {
  const link = mockFamilyLinks.find((l) => l.linkId === linkId);
  if (!link) throw new Error("연동 정보를 찾을 수 없어요.");
  link.status = link_status;
  if (link_status === "ACTIVE") link.linkedAt = nowIso();
  return { success: true, data: link };
}

// ───────────────────────────────────────────────────────────────────────────
// 연결 대기(미사용 초대) — 보호자 홈/가족 탭 '연결 대기 카드' 데이터 소스 (spec 7번, 추상화)
// ───────────────────────────────────────────────────────────────────────────

export interface PendingInvite {
  token: string;
  seniorName?: string;
  expiresAt: string;
}

// TODO(BE 확정): '연결 대기'의 소스가 미사용 INVITE 토큰인지, PENDING guardian_senior 링크인지 미확정.
//   현재는 미사용·미만료 INVITE 토큰을 노출한다. 확정되면 이 함수 내부만 교체하면 된다.
export async function getPendingInvites(guardianId: string): Promise<ApiEnvelope<PendingInvite[]>> {
  const now = Date.now();
  const pending = mockInvites
    .filter((i) => i.guardianId === guardianId && !i.isUsed && new Date(i.expiredAt).getTime() >= now)
    .map((i) => ({ token: i.token, seniorName: i.seniorName, expiresAt: i.expiredAt }));
  return { success: true, data: pending };
}

// ───────────────────────────────────────────────────────────────────────────
// 동의 제출 — 위치 미확정(stub) (spec 6번)
// ───────────────────────────────────────────────────────────────────────────

export interface SubmitConsentData {
  consentDone: true;
}

// TODO(BE 확정): '동의 기록 위치' 미확정.
//   옵션 A) registerSenior payload 에 biometric_consent_yn 포함, 옵션 B) 별도 POST /auth/consent.
//   확정 전까지 FE 는 이 함수로 추상화한다. 확정 시 내부만 교체(또는 register 에 병합).
export async function submitConsent({
  seniorId,
}: {
  seniorId: string;
}): Promise<ApiEnvelope<SubmitConsentData>> {
  const senior = mockAccounts.find((a) => a.id === seniorId);
  if (senior) senior.voiceConsentAt = nowIso();
  return { success: true, data: { consentDone: true } };
}

// ───────────────────────────────────────────────────────────────────────────
// 형제(공동보호자) 초대 — ⚠️ BE 엔드포인트 미확정. mock + TODO 전용.
//   평탄 모델: 그룹의 모든 보호자가 초대·제거 가능(권한 우위 없음). 신규 합류자도 동등한 보호자.
// ───────────────────────────────────────────────────────────────────────────

export interface InviteGuardianPayload {
  familyGroupId: string;
  inviterGuardianId: string;
  name: string;
}

export interface InviteGuardianData {
  guardianMember: GuardianMember;
  inviteCode: string;
  inviteLink: string;
}

// TODO(BE): 공동보호자 초대 엔드포인트 미확정. 확정 시 이 mock 을 실 호출로 교체.
export async function inviteGuardian({
  familyGroupId,
  inviterGuardianId,
  name,
}: InviteGuardianPayload): Promise<ApiEnvelope<InviteGuardianData>> {
  // 평탄: '대표보호자만' 제한 제거 → 그룹의 ACTIVE 보호자면 누구나 초대 가능.
  const inviter = mockGuardianMembers.find(
    (m) =>
      m.familyGroupId === familyGroupId &&
      m.guardianId === inviterGuardianId &&
      m.status === "ACTIVE",
  );
  if (!inviter) throw new Error("이 가족의 보호자만 초대할 수 있어요.");

  const inviteCode = makeInviteCode();
  const guardianMember: GuardianMember = {
    id: makeUuid(),
    familyGroupId,
    guardianName: name.trim(),
    memberRole: "SUB_GUARDIAN", // 합류자 라벨(권한 동등)
    status: "PENDING",
    invitedByGuardianId: inviterGuardianId,
    inviteCode,
    inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdAt: nowIso(),
  };
  mockGuardianMembers.push(guardianMember);

  return {
    success: true,
    data: { guardianMember, inviteCode, inviteLink: `moa://guardian-invite/${inviteCode}` },
  };
}

export interface AcceptGuardianInvitePayload {
  guardianId: string;
  guardianName: string;
  inviteCode: string;
}

export interface AcceptGuardianInviteData {
  familyGroup: FamilyGroup;
  guardianMember: GuardianMember;
}

// TODO(BE): 공동보호자 합류 엔드포인트 미확정.
export async function acceptGuardianInvite({
  guardianId,
  guardianName,
  inviteCode,
}: AcceptGuardianInvitePayload): Promise<ApiEnvelope<AcceptGuardianInviteData>> {
  const normalized = inviteCode.trim().toUpperCase();
  const member = mockGuardianMembers.find(
    (m) => m.inviteCode === normalized && m.status === "PENDING",
  );
  if (!member) throw new Error("초대 코드를 확인해 주세요.");

  member.guardianId = guardianId;
  member.guardianName = guardianName;
  member.status = "ACTIVE";
  member.joinedAt = nowIso();

  const familyGroup = mockFamilyGroups.find((g) => g.id === member.familyGroupId);
  if (!familyGroup) throw new Error("가족 그룹을 찾을 수 없어요.");

  return { success: true, data: { familyGroup, guardianMember: member } };
}

// TODO(BE): 공동보호자 제거 엔드포인트 미확정.
export async function removeGuardian({
  familyGroupId,
  guardianMemberId,
  requesterGuardianId,
}: {
  familyGroupId: string;
  guardianMemberId: string;
  requesterGuardianId: string;
}): Promise<ApiEnvelope<{ guardianMemberId: string; status: "REVOKED" }>> {
  // 평탄: '대표보호자만' 제한 제거 → 그룹의 ACTIVE 보호자면 누구나 제거 가능.
  const requester = mockGuardianMembers.find(
    (m) =>
      m.familyGroupId === familyGroupId &&
      m.guardianId === requesterGuardianId &&
      m.status === "ACTIVE",
  );
  if (!requester) throw new Error("이 가족의 보호자만 제거할 수 있어요.");

  const target = mockGuardianMembers.find((m) => m.id === guardianMemberId);
  // 생성자(OWNER) 라벨은 그룹 기준점이라 제거 대상에서 제외(권한 우위가 아니라 안전장치).
  if (!target || target.memberRole === "OWNER") throw new Error("제거할 보호자를 찾을 수 없어요.");
  target.status = "REVOKED";
  return { success: true, data: { guardianMemberId, status: "REVOKED" } };
}

export async function listFamilyMembers(
  familyGroupId: string,
): Promise<ApiEnvelope<{ familyGroup: FamilyGroup | null; links: FamilyLink[]; guardianMembers: GuardianMember[] }>> {
  return { success: true, data: membersForFamily(familyGroupId) };
}

// ───────────────────────────────────────────────────────────────────────────
// 세션 복원
// ───────────────────────────────────────────────────────────────────────────

export interface RestoredSession {
  user: SessionUser;
  consentDone: boolean;
  refreshToken: string;
  familyGroup: FamilyGroup | null;
  links: FamilyLink[];
  guardianMembers: GuardianMember[];
}

export async function restoreSession(): Promise<RestoredSession | null> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    const acc = mockAccounts.find((a) => makeRefreshToken(a.id) === refreshToken);
    if (acc) {
      await saveToken(makeToken(acc.id));
      const user = toSession(acc);
      return { user, consentDone: !!acc.voiceConsentAt, refreshToken, ...familyStateForUser(user) };
    }
  }

  const token = await getToken();
  if (!token) return null;
  const acc = mockAccounts.find((a) => makeToken(a.id) === token);
  if (!acc) return null;
  const user = toSession(acc);
  return { user, consentDone: !!acc.voiceConsentAt, refreshToken: refreshToken ?? "", ...familyStateForUser(user) };
}

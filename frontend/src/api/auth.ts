import type {
  FamilyGroup,
  FamilyLink,
  GuardianMember,
  GuardianMemberRole,
  SessionUser,
  UserRole,
} from "../stores/authStore";
import { saveToken, getToken, clearToken, saveRefreshToken, getRefreshToken } from "./session";

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

interface MockAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  relation?: string;
  linkedElderId?: string;
  voiceConsentAt?: string;
  pairingCode?: string;
}

const nowIso = () => new Date().toISOString();

const mockAccounts: MockAccount[] = [
  {
    id: "elder-1",
    name: "김순자",
    email: "elder@moa.app",
    password: "moa00000",
    role: "elder",
    pairingCode: "MOA-DEV",
  },
];
const mockFamilyGroups: FamilyGroup[] = [];
const mockFamilyLinks: FamilyLink[] = [];
const mockGuardianMembers: GuardianMember[] = [];

const makeToken = (id: string) => `mock-token-${id}`;
const makeRefreshToken = (id: string) => `mock-refresh-${id}`;
const idNumberOf = (id: string): number => {
  const digits = id.replace(/\D/g, "");
  return digits ? Number(digits) : Date.now();
};
const makePairingCode = (): string =>
  `${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
const makeInviteCode = (): string =>
  `FAM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function toSession(acc: MockAccount): SessionUser {
  return { id: acc.id, name: acc.name, role: acc.role, token: makeToken(acc.id) };
}

function groupForGuardian(guardianId: string): FamilyGroup | null {
  const member = mockGuardianMembers.find(
    (m) => m.guardianId === guardianId && m.status === "ACTIVE",
  );
  return member ? mockFamilyGroups.find((g) => g.id === member.familyGroupId) ?? null : null;
}

function ensureFamilyGroupForOwner(guardian: MockAccount): FamilyGroup {
  const existing = groupForGuardian(guardian.id);
  if (existing) return existing;

  const ts = Date.now();
  const familyGroup: FamilyGroup = {
    id: `family-${ts}`,
    name: `${guardian.name} 가족`,
    createdByGuardianId: guardian.id,
    status: "ACTIVE",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  mockFamilyGroups.push(familyGroup);
  mockGuardianMembers.push({
    id: `guardian-member-${ts}`,
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

  const elderId = idNumberOf(user.id);
  const link = mockFamilyLinks.find((l) => l.counterpartId === elderId);
  if (!link?.familyGroupId) return { familyGroup: null, links: [], guardianMembers: [] };
  return membersForFamily(link.familyGroupId);
}

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

export async function register({ name, email, password, role }: RegisterPayload): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  if (mockAccounts.some((a) => a.email === normalized)) {
    throw new Error("이미 가입된 이메일이에요.");
  }
  const acc: MockAccount = { id: `${role}-${Date.now()}`, name: name.trim(), email: normalized, password, role };
  mockAccounts.push(acc);
  const user = toSession(acc);
  await saveToken(user.token);
  await saveRefreshToken(makeRefreshToken(user.id));
  return user;
}

export async function logout(): Promise<void> {
  await clearToken();
}

export interface ProvisionGuardianElderPayload {
  guardianId: string;
  name: string;
  relation?: string;
}

export interface GuardianElderProvisioningData {
  familyGroup: FamilyGroup;
  elder: SessionUser;
  link: FamilyLink;
  guardianMembers: GuardianMember[];
  pairing_code: string;
}

// Mock for POST /guardian/elders. Creates FamilyGroup + OWNER when needed.
export async function provisionGuardianElder({
  guardianId,
  name,
  relation,
}: ProvisionGuardianElderPayload): Promise<ApiEnvelope<GuardianElderProvisioningData>> {
  const guardian = mockAccounts.find((a) => a.id === guardianId && a.role === "guardian");
  if (!guardian) throw new Error("보호자 계정을 찾을 수 없어요.");

  const familyGroup = ensureFamilyGroupForOwner(guardian);
  const ts = Date.now();
  const id = `elder-${ts}`;
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
    linkId: ts,
    familyGroupId: familyGroup.id,
    counterpartId: idNumberOf(id),
    counterpartName: elder.name,
    relation: "elder",
    status: "PENDING",
    pairingCode,
  };
  mockFamilyLinks.push(link);

  guardian.linkedElderId = id;
  guardian.relation = relation;

  return {
    success: true,
    data: {
      familyGroup,
      elder: toSession(elder),
      link,
      guardianMembers: membersForFamily(familyGroup.id).guardianMembers,
      pairing_code: pairingCode,
    },
  };
}

export interface InviteGuardianPayload {
  familyGroupId: string;
  inviterGuardianId: string;
  name: string;
  phoneOrEmail?: string;
  memberRole?: GuardianMemberRole;
}

export interface InviteGuardianData {
  guardianMember: GuardianMember;
  inviteCode: string;
  inviteLink: string;
}

export async function inviteGuardian({
  familyGroupId,
  inviterGuardianId,
  name,
  memberRole = "SUB_GUARDIAN",
}: InviteGuardianPayload): Promise<ApiEnvelope<InviteGuardianData>> {
  const inviter = mockGuardianMembers.find(
    (m) =>
      m.familyGroupId === familyGroupId &&
      m.guardianId === inviterGuardianId &&
      m.status === "ACTIVE" &&
      m.memberRole === "OWNER",
  );
  if (!inviter) throw new Error("대표보호자만 부보호자를 초대할 수 있어요.");

  const inviteCode = makeInviteCode();
  const guardianMember: GuardianMember = {
    id: `guardian-member-${Date.now()}`,
    familyGroupId,
    guardianName: name.trim(),
    memberRole,
    status: "PENDING",
    invitedByGuardianId: inviterGuardianId,
    inviteCode,
    inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdAt: nowIso(),
  };
  mockGuardianMembers.push(guardianMember);

  return {
    success: true,
    data: {
      guardianMember,
      inviteCode,
      inviteLink: `moa://guardian-invite/${inviteCode}`,
    },
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

export async function removeGuardian({
  familyGroupId,
  guardianMemberId,
  requesterGuardianId,
}: {
  familyGroupId: string;
  guardianMemberId: string;
  requesterGuardianId: string;
}): Promise<ApiEnvelope<{ guardianMemberId: string; status: "REVOKED" }>> {
  const requester = mockGuardianMembers.find(
    (m) =>
      m.familyGroupId === familyGroupId &&
      m.guardianId === requesterGuardianId &&
      m.status === "ACTIVE" &&
      m.memberRole === "OWNER",
  );
  if (!requester) throw new Error("대표보호자만 부보호자를 제거할 수 있어요.");

  const target = mockGuardianMembers.find((m) => m.id === guardianMemberId);
  if (!target || target.memberRole === "OWNER") throw new Error("제거할 부보호자를 찾을 수 없어요.");
  target.status = "REVOKED";
  return { success: true, data: { guardianMemberId, status: "REVOKED" } };
}

export async function listFamilyMembers(
  familyGroupId: string,
): Promise<ApiEnvelope<{ familyGroup: FamilyGroup | null; links: FamilyLink[]; guardianMembers: GuardianMember[] }>> {
  return { success: true, data: membersForFamily(familyGroupId) };
}

export interface ClaimPayload {
  code: string;
}

export interface ClaimData {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  consent_required: boolean;
  familyGroup: FamilyGroup | null;
  links: FamilyLink[];
  guardianMembers: GuardianMember[];
}

export async function claim({ code }: ClaimPayload): Promise<ApiEnvelope<ClaimData>> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error("초대 코드를 입력해 주세요.");

  const elder = mockAccounts.find((a) => a.role === "elder" && a.pairingCode === normalized);
  if (!elder) throw new Error("코드를 확인해 주세요. 보호자에게 받은 코드와 다른 것 같아요.");

  const accessToken = makeToken(elder.id);
  const refreshToken = makeRefreshToken(elder.id);
  await saveToken(accessToken);
  await saveRefreshToken(refreshToken);
  const familyState = familyStateForUser(toSession(elder));

  return {
    success: true,
    data: {
      user: toSession(elder),
      accessToken,
      refreshToken,
      consent_required: !elder.voiceConsentAt,
      ...familyState,
    },
  };
}

export interface SubmitConsentData {
  consentDone: true;
  link: FamilyLink | null;
}

export async function submitElderConsent(elderId: string): Promise<ApiEnvelope<SubmitConsentData>> {
  const elder = mockAccounts.find((a) => a.id === elderId);
  if (elder) elder.voiceConsentAt = nowIso();

  const link = mockFamilyLinks.find((l) => l.counterpartId === idNumberOf(elderId)) ?? null;
  if (link) link.status = "ACTIVE";

  return { success: true, data: { consentDone: true, link } };
}

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

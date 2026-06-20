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

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

type AuthApiMode = "mock" | "real";
type BackendRole = "guardian" | "senior" | "elder";

const AUTH_API_MODE: AuthApiMode =
  process.env.EXPO_PUBLIC_AUTH_API_MODE === "real" ? "real" : "mock";
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

export function getAuthApiMode(): AuthApiMode {
  return AUTH_API_MODE;
}

const nowIso = () => new Date().toISOString();
const INVITE_EXPIRE_HOURS = 72;
const MOCK_STORAGE_KEY = "moa.mock.family.v2";
const REAL_PENDING_STORAGE_KEY = "moa.real.pendingInvites.v1";

interface MockAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  voiceConsentAt?: string;
}

interface SeniorInvite {
  token: string;
  guardianId: string;
  familyGroupId: string;
  seniorName?: string;
  expiredAt: string;
  isUsed: boolean;
}

interface MockDb {
  accounts: MockAccount[];
  familyGroups: FamilyGroup[];
  familyLinks: FamilyLink[];
  guardianMembers: GuardianMember[];
  invites: SeniorInvite[];
}

function makeUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function storageGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Native builds may not have localStorage; in-memory state still works.
  }
}

function buildSeedDb(): MockDb {
  const guardianId = "guardian-1";
  const familyGroupId = "family-dev";
  const createdAt = new Date(0).toISOString();

  return {
    accounts: [
      {
        id: guardianId,
        name: "김보호",
        email: "guardian@moa.app",
        password: "moa00000",
        role: "guardian",
      },
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "김보호",
        email: "guardian.dev@moa.app",
        password: "moa00000",
        role: "guardian",
      },
    ],
    familyGroups: [
      {
        id: familyGroupId,
        name: "김보호 가족",
        createdByGuardianId: guardianId,
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    familyLinks: [],
    guardianMembers: [
      {
        id: "guardian-member-owner-dev",
        familyGroupId,
        guardianId,
        guardianName: "김보호",
        memberRole: "OWNER",
        status: "ACTIVE",
        joinedAt: createdAt,
        createdAt,
      },
    ],
    invites: [
      {
        token: "MOA-DEV",
        guardianId,
        familyGroupId,
        seniorName: "김순자",
        expiredAt: "2999-12-31T00:00:00.000Z",
        isUsed: false,
      },
    ],
  };
}

function loadMockDb(): MockDb {
  const raw = storageGet(MOCK_STORAGE_KEY);
  if (!raw) return buildSeedDb();
  try {
    const parsed = JSON.parse(raw) as MockDb;
    if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.invites)) {
      return buildSeedDb();
    }
    return parsed;
  } catch {
    return buildSeedDb();
  }
}

const mockDb = loadMockDb();

function saveMockDb(): void {
  storageSet(MOCK_STORAGE_KEY, JSON.stringify(mockDb));
}

// MOA-DEV 초대는 localStorage 영속화와 무관하게 매 로드 시 항상 미사용으로 리시드한다.
// (한 번 클레임해 isUsed=true 가 저장돼도 새로고침하면 다시 초대 가능 → 반복 클레임 테스트.)
// 보호자/그룹 의존성이 없으면 함께 보강한다.
const DEV_INVITE_TOKEN = "MOA-DEV";
const DEV_GUARDIAN_ID = "guardian-1";
const DEV_FAMILY_GROUP_ID = "family-dev";
function ensureDevInvite(db: MockDb): void {
  const zero = new Date(0).toISOString();
  if (!db.accounts.some((a) => a.id === DEV_GUARDIAN_ID)) {
    db.accounts.push({
      id: DEV_GUARDIAN_ID,
      name: "김보호",
      email: "guardian@moa.app",
      password: "moa00000",
      role: "guardian",
    });
  }
  if (!db.familyGroups.some((g) => g.id === DEV_FAMILY_GROUP_ID)) {
    db.familyGroups.push({
      id: DEV_FAMILY_GROUP_ID,
      name: "김보호 가족",
      createdByGuardianId: DEV_GUARDIAN_ID,
      status: "ACTIVE",
      createdAt: zero,
      updatedAt: zero,
    });
  }
  if (
    !db.guardianMembers.some(
      (m) => m.familyGroupId === DEV_FAMILY_GROUP_ID && m.guardianId === DEV_GUARDIAN_ID,
    )
  ) {
    db.guardianMembers.push({
      id: "guardian-member-owner-dev",
      familyGroupId: DEV_FAMILY_GROUP_ID,
      guardianId: DEV_GUARDIAN_ID,
      guardianName: "김보호",
      memberRole: "OWNER",
      status: "ACTIVE",
      joinedAt: zero,
      createdAt: zero,
    });
  }
  const existing = db.invites.find((i) => i.token === DEV_INVITE_TOKEN);
  if (existing) {
    existing.isUsed = false;
    existing.expiredAt = "2999-12-31T00:00:00.000Z";
    existing.guardianId = DEV_GUARDIAN_ID;
    existing.familyGroupId = DEV_FAMILY_GROUP_ID;
    existing.seniorName = existing.seniorName ?? "김순자";
  } else {
    db.invites.push({
      token: DEV_INVITE_TOKEN,
      guardianId: DEV_GUARDIAN_ID,
      familyGroupId: DEV_FAMILY_GROUP_ID,
      seniorName: "김순자",
      expiredAt: "2999-12-31T00:00:00.000Z",
      isUsed: false,
    });
  }
}

// dev 전용: mock 가족 DB 를 초기 시드 상태로 되돌린다.
// 브라우저 콘솔에서 resetMockDb() 로 호출하거나, dev 버튼에서 import 해 쓴다.
export function resetMockDb(): void {
  const seed = buildSeedDb();
  mockDb.accounts = seed.accounts;
  mockDb.familyGroups = seed.familyGroups;
  mockDb.familyLinks = seed.familyLinks;
  mockDb.guardianMembers = seed.guardianMembers;
  mockDb.invites = seed.invites;
  ensureDevInvite(mockDb);
  saveMockDb();
}
if (AUTH_API_MODE === "mock") {
  (globalThis as unknown as { resetMockDb?: () => void }).resetMockDb = resetMockDb;
}

// 매 모듈 로드 시 MOA-DEV 리시드 후 저장.
ensureDevInvite(mockDb);
saveMockDb();

function toUserRole(role: BackendRole): UserRole {
  return role === "guardian" ? "guardian" : "elder";
}

function makeToken(id: string): string {
  return `mock-token-${id}`;
}

function makeRefreshToken(id: string): string {
  return `mock-refresh-${id}`;
}

function makeInviteCode(): string {
  return `FAM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function makeSeniorPairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part()}-${part()}`;
}

function normalizeSeniorPairingCode(token: string): string {
  const compact = token.trim().replace(/[\s-]+/g, "").toUpperCase();
  if (/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(compact)) {
    return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  }
  return token.trim().toUpperCase();
}

function seniorPairingCodeMatches(a: string, b: string): boolean {
  return normalizeSeniorPairingCode(a) === normalizeSeniorPairingCode(b);
}

function toSession(acc: MockAccount): SessionUser {
  return { id: acc.id, name: acc.name, role: acc.role, token: makeToken(acc.id) };
}

export function generateSeniorCredential(): { email: string; password: string } {
  const uuid = makeUuid();
  return { email: `senior-${uuid}@moa.app`, password: `moa-${makeUuid().slice(0, 12)}` };
}

function groupForGuardian(guardianId: string): FamilyGroup | null {
  const member = mockDb.guardianMembers.find(
    (m) => m.guardianId === guardianId && m.status === "ACTIVE",
  );
  return member ? mockDb.familyGroups.find((g) => g.id === member.familyGroupId) ?? null : null;
}

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
  mockDb.familyGroups.push(familyGroup);
  mockDb.guardianMembers.push({
    id: makeUuid(),
    familyGroupId: familyGroup.id,
    guardianId: guardian.id,
    guardianName: guardian.name,
    memberRole: "OWNER",
    status: "ACTIVE",
    joinedAt: nowIso(),
    createdAt: nowIso(),
  });
  saveMockDb();
  return familyGroup;
}

function membersForFamily(familyGroupId: string) {
  return {
    familyGroup: mockDb.familyGroups.find((g) => g.id === familyGroupId) ?? null,
    links: mockDb.familyLinks.filter((l) => l.familyGroupId === familyGroupId),
    guardianMembers: mockDb.guardianMembers.filter((m) => m.familyGroupId === familyGroupId),
  };
}

function familyStateForUser(user: SessionUser) {
  if (user.role === "guardian") {
    const familyGroup = groupForGuardian(user.id);
    if (!familyGroup) return { familyGroup: null, links: [], guardianMembers: [] };
    return membersForFamily(familyGroup.id);
  }

  const link = mockDb.familyLinks.find((l) => l.counterpartId === user.id);
  if (!link?.familyGroupId) return { familyGroup: null, links: [], guardianMembers: [] };
  return membersForFamily(link.familyGroupId);
}

function parseJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    if (!globalThis.atob) return null;
    const json = globalThis.atob(padded);
    return (JSON.parse(json) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.auth) {
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      typeof body?.detail === "string"
        ? body.detail
        : typeof body?.message === "string"
          ? body.message
          : "API 요청에 실패했어요.";
    throw new Error(message);
  }
  return body as T;
}

let realCurrentUser: SessionUser | null = null;

function realFamilyGroupForGuardian(user: SessionUser): FamilyGroup {
  return {
    id: `family-${user.id}`,
    name: `${user.name} 가족`,
    createdByGuardianId: user.id,
    status: "ACTIVE",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function realGuardianMember(user: SessionUser): GuardianMember {
  return {
    id: `guardian-member-${user.id}`,
    familyGroupId: `family-${user.id}`,
    guardianId: user.id,
    guardianName: user.name,
    memberRole: "OWNER",
    status: "ACTIVE",
    joinedAt: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString(),
  };
}

function loadRealPendingInvites(): PendingInvite[] {
  const raw = storageGet(REAL_PENDING_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingInvite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRealPendingInvites(invites: PendingInvite[]): void {
  storageSet(REAL_PENDING_STORAGE_KEY, JSON.stringify(invites));
}

interface BackendLoginResponse {
  status: string;
  data: {
    access_token: string;
    refresh_token?: string;
    role: BackendRole;
    name: string;
  };
}

interface BackendInviteResponse {
  token: string;
  expired_at: string;
}

interface BackendInviteListItemResponse {
  token: string;
  created_at: string;
  expired_at: string;
  is_used: boolean;
}

interface BackendInviteVerifyResponse {
  valid: boolean;
  reason?: "EXPIRED" | "USED" | "NOT_FOUND";
  guardian_name?: string;
}

interface BackendSeniorResponse {
  senior_id: string;
  name: string;
  email: string;
}

interface BackendGuardianSeniorResponse {
  link_id: string;
  guardian_id: string;
  senior_id: string;
  link_status: "PENDING" | "ACTIVE" | "REVOKED";
  linked_at?: string | null;
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

async function loginMock({ email, password }: LoginPayload): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  const acc = mockDb.accounts.find((a) => a.email === normalized);
  if (!acc || acc.password !== password) {
    throw new Error("이메일 또는 비밀번호가 올바르지 않아요.");
  }
  const user = toSession(acc);
  await saveToken(user.token);
  await saveRefreshToken(makeRefreshToken(user.id));
  return user;
}

async function loginReal({ email, password }: LoginPayload): Promise<SessionUser> {
  const res = await apiFetch<BackendLoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const token = res.data.access_token;
  const user: SessionUser = {
    id: parseJwtSub(token) ?? email.trim().toLowerCase(),
    name: res.data.name,
    role: toUserRole(res.data.role),
    token,
  };
  realCurrentUser = user;
  await saveToken(token);
  if (res.data.refresh_token) await saveRefreshToken(res.data.refresh_token);
  return user;
}

export async function login(payload: LoginPayload): Promise<SessionUser> {
  return AUTH_API_MODE === "real" ? loginReal(payload) : loginMock(payload);
}

async function registerMock({ name, email, password, role }: RegisterPayload): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  if (mockDb.accounts.some((a) => a.email === normalized)) {
    throw new Error("이미 가입된 이메일이에요.");
  }
  const acc: MockAccount = { id: makeUuid(), name: name.trim(), email: normalized, password, role };
  mockDb.accounts.push(acc);
  saveMockDb();
  const user = toSession(acc);
  await saveToken(user.token);
  await saveRefreshToken(makeRefreshToken(user.id));
  return user;
}

async function registerReal(payload: RegisterPayload): Promise<SessionUser> {
  if (payload.role !== "guardian") {
    throw new Error("직접사용자는 초대코드로 가입해 주세요.");
  }
  await apiFetch("/auth/guardian/register", {
    method: "POST",
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      name: payload.name.trim(),
      // TODO(BE 연동): 보호자 등록 화면에서 실제 생년월일/전화번호 수집 (현재 placeholder)
      birth_date: "1970-01-01",
      phone: "010-0000-0000",
      biometric_consent_yn: true,
    }),
  });
  return loginReal({ email: payload.email, password: payload.password });
}

export async function register(payload: RegisterPayload): Promise<SessionUser> {
  return AUTH_API_MODE === "real" ? registerReal(payload) : registerMock(payload);
}

export async function logout(): Promise<void> {
  realCurrentUser = null;
  await clearToken();
}

export interface CreateInvitePayload {
  guardianId: string;
  seniorName?: string;
}

export interface CreateInviteData {
  token: string;
  expired_at: string;
}

async function createInviteMock({
  guardianId,
  seniorName,
}: CreateInvitePayload): Promise<ApiEnvelope<CreateInviteData>> {
  const guardian = mockDb.accounts.find((a) => a.id === guardianId && a.role === "guardian");
  if (!guardian) throw new Error("보호자 계정을 찾을 수 없어요.");

  const familyGroup = ensureFamilyGroupForOwner(guardian);
  let token = makeSeniorPairingCode();
  while (mockDb.invites.some((i) => seniorPairingCodeMatches(i.token, token))) {
    token = makeSeniorPairingCode();
  }
  const invite: SeniorInvite = {
    token,
    guardianId,
    familyGroupId: familyGroup.id,
    seniorName: seniorName?.trim() || undefined,
    expiredAt: new Date(Date.now() + INVITE_EXPIRE_HOURS * 60 * 60 * 1000).toISOString(),
    isUsed: false,
  };
  mockDb.invites.push(invite);
  saveMockDb();
  return { success: true, data: { token: invite.token, expired_at: invite.expiredAt } };
}

async function createInviteReal({
  seniorName,
}: CreateInvitePayload): Promise<ApiEnvelope<CreateInviteData>> {
  const invite = await apiFetch<BackendInviteResponse>("/auth/invite", {
    method: "POST",
    auth: true,
  });
  // TODO(BE 연동): 현재 백엔드는 미사용 invite 목록 조회 API가 없다.
  // real 모드의 초대 대기 카드는 임시로 localStorage 캐시에 의존하므로,
  // 다른 기기/브라우저와 동기화되지 않는다. GET pending invites API가 생기면 제거한다.
  const pending = loadRealPendingInvites().filter((i) => i.token !== invite.token);
  pending.push({
    token: invite.token,
    seniorName: seniorName?.trim() || undefined,
    expiresAt: invite.expired_at,
  });
  saveRealPendingInvites(pending);
  return { success: true, data: invite };
}

export async function createInvite(
  payload: CreateInvitePayload,
): Promise<ApiEnvelope<CreateInviteData>> {
  return AUTH_API_MODE === "real" ? createInviteReal(payload) : createInviteMock(payload);
}

export interface VerifyInviteData {
  valid: boolean;
  reason?: "EXPIRED" | "USED" | "NOT_FOUND";
  guardian_name?: string;
  senior_name?: string;
}

async function verifyInviteMock(token: string): Promise<ApiEnvelope<VerifyInviteData>> {
  const normalized = normalizeSeniorPairingCode(token);
  const invite = mockDb.invites.find((i) => seniorPairingCodeMatches(i.token, normalized));
  if (!invite) return { success: true, data: { valid: false, reason: "NOT_FOUND" } };
  if (invite.isUsed) return { success: true, data: { valid: false, reason: "USED" } };
  if (new Date(invite.expiredAt).getTime() < Date.now()) {
    return { success: true, data: { valid: false, reason: "EXPIRED" } };
  }
  const guardian = mockDb.accounts.find((a) => a.id === invite.guardianId);
  return {
    success: true,
    data: { valid: true, guardian_name: guardian?.name, senior_name: invite.seniorName },
  };
}

async function verifyInviteReal(token: string): Promise<ApiEnvelope<VerifyInviteData>> {
  const normalized = normalizeSeniorPairingCode(token);
  const data = await apiFetch<BackendInviteVerifyResponse>(
    `/auth/invite/${encodeURIComponent(normalized)}/verify`,
  );
  const pending = loadRealPendingInvites().find((i) => seniorPairingCodeMatches(i.token, normalized));
  return {
    success: true,
    data: { ...data, senior_name: pending?.seniorName },
  };
}

export async function verifyInvite(token: string): Promise<ApiEnvelope<VerifyInviteData>> {
  return AUTH_API_MODE === "real" ? verifyInviteReal(token) : verifyInviteMock(token);
}

export interface RegisterSeniorPayload {
  invite_token: string;
  email: string;
  password: string;
  name: string;
  consent?: boolean;
}

export interface RegisterSeniorData {
  senior: SessionUser;
  link: FamilyLink;
}

async function registerSeniorMock({
  invite_token,
  email,
  password,
  name,
}: RegisterSeniorPayload): Promise<ApiEnvelope<RegisterSeniorData>> {
  const normalized = normalizeSeniorPairingCode(invite_token);
  const invite = mockDb.invites.find((i) => seniorPairingCodeMatches(i.token, normalized));
  if (!invite) throw new Error("초대 코드를 확인해 주세요.");
  if (invite.isUsed) throw new Error("이미 사용된 초대 코드예요.");
  if (new Date(invite.expiredAt).getTime() < Date.now()) {
    throw new Error("만료된 초대 코드예요. 보호자에게 재발송을 요청해 주세요.");
  }

  const senior: MockAccount = {
    id: makeUuid(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    role: "elder",
  };
  mockDb.accounts.push(senior);

  const link: FamilyLink = {
    linkId: makeUuid(),
    familyGroupId: invite.familyGroupId,
    counterpartId: senior.id,
    counterpartName: senior.name,
    relation: "elder",
    status: "ACTIVE",
    linkedAt: nowIso(),
  };
  mockDb.familyLinks.push(link);
  invite.isUsed = true;
  saveMockDb();

  return { success: true, data: { senior: toSession(senior), link } };
}

async function registerSeniorReal({
  invite_token,
  email,
  password,
  name,
  consent,
}: RegisterSeniorPayload): Promise<ApiEnvelope<RegisterSeniorData>> {
  const normalizedInviteToken = normalizeSeniorPairingCode(invite_token);
  const senior = await apiFetch<BackendSeniorResponse>("/auth/senior/register", {
    method: "POST",
    body: JSON.stringify({
      invite_token: normalizedInviteToken,
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
      // TODO(BE 연동): 직접사용자 생년월일/전화번호 실제 입력값 수집 (현재 placeholder)
      birth_date: "1940-01-01",
      phone: "010-0000-0000",
      biometric_consent_yn: Boolean(consent),
    }),
  });
  const user = await loginReal({ email, password });
  const pending = loadRealPendingInvites().filter((i) => !seniorPairingCodeMatches(i.token, normalizedInviteToken));
  saveRealPendingInvites(pending);
  return {
    success: true,
    data: {
      senior: user,
      link: {
        linkId: `link-${senior.senior_id}`,
        counterpartId: senior.senior_id,
        counterpartName: senior.name,
        relation: "elder",
        status: "ACTIVE",
        linkedAt: nowIso(),
      },
    },
  };
}

export async function registerSenior(
  payload: RegisterSeniorPayload,
): Promise<ApiEnvelope<RegisterSeniorData>> {
  return AUTH_API_MODE === "real" ? registerSeniorReal(payload) : registerSeniorMock(payload);
}

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
  const normalizedToken = normalizeSeniorPairingCode(token);
  const verify = await verifyInvite(normalizedToken);
  if (!verify.data.valid) {
    const reason = verify.data.reason;
    if (reason === "EXPIRED") throw new Error("만료된 초대 코드예요. 보호자에게 재발송을 요청해 주세요.");
    if (reason === "USED") throw new Error("이미 사용된 초대 코드예요.");
    throw new Error("코드를 확인해 주세요. 보호자에게 받은 코드와 다른 것 같아요.");
  }

  const cred = generateSeniorCredential();
  const seniorName = name?.trim() || verify.data.senior_name || "직접사용자";
  await registerSenior({
    invite_token: normalizedToken,
    email: cred.email,
    password: cred.password,
    name: seniorName,
    consent,
  });
  const user = await login({ email: cred.email, password: cred.password });

  let consentDone = false;
  if (consent) {
    await submitConsent({ seniorId: user.id });
    consentDone = true;
  }

  const refreshToken = (await getRefreshToken()) ?? "";
  const familyState =
    AUTH_API_MODE === "real"
      ? { familyGroup: null, links: [], guardianMembers: [] }
      : familyStateForUser(user);
  return {
    success: true,
    data: { user, refreshToken, consentDone, ...familyState },
  };
}

export async function getGuardianSeniors(
  guardianId: string,
): Promise<ApiEnvelope<FamilyLink[]>> {
  if (AUTH_API_MODE === "real") {
    const rows = await apiFetch<BackendGuardianSeniorResponse[]>("/auth/guardian/seniors", {
      auth: true,
    });
    const familyGroupId = `family-${guardianId}`;
    return {
      success: true,
      data: rows.map((row) => ({
        linkId: row.link_id,
        familyGroupId,
        counterpartId: row.senior_id,
        // TODO(BE 연동): /auth/guardian/seniors 가 직접사용자 이름 반환 시 교체 (현재 placeholder)
        counterpartName: `어르신 ${row.senior_id.slice(0, 4)}`,
        relation: "elder",
        status: row.link_status,
        linkedAt: row.linked_at ?? undefined,
      })),
    };
  }

  const familyGroup = groupForGuardian(guardianId);
  const links = familyGroup ? membersForFamily(familyGroup.id).links : [];
  return { success: true, data: links };
}

export interface UpdateLinkStatusPayload {
  linkId: string;
  link_status: "ACTIVE" | "REVOKED";
}

export async function updateLinkStatus({
  linkId,
  link_status,
}: UpdateLinkStatusPayload): Promise<ApiEnvelope<FamilyLink>> {
  if (AUTH_API_MODE === "real") {
    const row = await apiFetch<BackendGuardianSeniorResponse>(`/auth/link/${linkId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ link_status }),
    });
    return {
      success: true,
      data: {
        linkId: row.link_id,
        familyGroupId: `family-${row.guardian_id}`,
        counterpartId: row.senior_id,
        // TODO(BE 연동): BE 응답에 직접사용자 이름 포함 시 교체 (현재 placeholder)
        counterpartName: `어르신 ${row.senior_id.slice(0, 4)}`,
        relation: "elder",
        status: row.link_status,
        linkedAt: row.linked_at ?? undefined,
      },
    };
  }

  const link = mockDb.familyLinks.find((l) => l.linkId === linkId);
  if (!link) throw new Error("연동 정보를 찾을 수 없어요.");
  link.status = link_status;
  if (link_status === "ACTIVE") link.linkedAt = nowIso();
  saveMockDb();
  return { success: true, data: link };
}

export interface PendingInvite {
  token: string;
  seniorName?: string;
  expiresAt: string;
}

export async function getPendingInvites(guardianId: string): Promise<ApiEnvelope<PendingInvite[]>> {
  const now = Date.now();
  if (AUTH_API_MODE === "real") {
    const serverInvites = await apiFetch<BackendInviteListItemResponse[]>("/auth/guardian/invites", {
      auth: true,
    });
    const localNames = new Map(loadRealPendingInvites().map((invite) => [invite.token, invite.seniorName]));
    return {
      success: true,
      data: serverInvites
        .filter((invite) => !invite.is_used && new Date(invite.expired_at).getTime() >= now)
        .map((invite) => ({
          token: invite.token,
          seniorName: localNames.get(invite.token),
          expiresAt: invite.expired_at,
        })),
    };
  }

  const pending = mockDb.invites
    .filter((i) => i.guardianId === guardianId && !i.isUsed && new Date(i.expiredAt).getTime() >= now)
    .map((i) => ({ token: i.token, seniorName: i.seniorName, expiresAt: i.expiredAt }));
  return { success: true, data: pending };
}

export interface SubmitConsentData {
  consentDone: true;
}

export async function submitConsent({
  seniorId,
}: {
  seniorId: string;
}): Promise<ApiEnvelope<SubmitConsentData>> {
  if (AUTH_API_MODE === "real") {
    return { success: true, data: { consentDone: true } };
  }

  const senior = mockDb.accounts.find((a) => a.id === seniorId);
  if (senior) senior.voiceConsentAt = nowIso();
  saveMockDb();
  return { success: true, data: { consentDone: true } };
}

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

export async function inviteGuardian({
  familyGroupId,
  inviterGuardianId,
  name,
}: InviteGuardianPayload): Promise<ApiEnvelope<InviteGuardianData>> {
  if (AUTH_API_MODE === "real") {
    throw new Error("공동보호자 초대 API는 아직 백엔드에 없어서 mock 모드에서 테스트해 주세요.");
  }

  const inviter = mockDb.guardianMembers.find(
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
    memberRole: "SUB_GUARDIAN",
    status: "PENDING",
    invitedByGuardianId: inviterGuardianId,
    inviteCode,
    inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdAt: nowIso(),
  };
  mockDb.guardianMembers.push(guardianMember);
  saveMockDb();

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

export async function acceptGuardianInvite({
  guardianId,
  guardianName,
  inviteCode,
}: AcceptGuardianInvitePayload): Promise<ApiEnvelope<AcceptGuardianInviteData>> {
  if (AUTH_API_MODE === "real") {
    throw new Error("공동보호자 수락 API는 아직 백엔드에 없어서 mock 모드에서 테스트해 주세요.");
  }

  const normalized = inviteCode.trim().toUpperCase();
  const member = mockDb.guardianMembers.find(
    (m) => m.inviteCode === normalized && m.status === "PENDING",
  );
  if (!member) throw new Error("초대 코드를 확인해 주세요.");

  member.guardianId = guardianId;
  member.guardianName = guardianName;
  member.status = "ACTIVE";
  member.joinedAt = nowIso();
  saveMockDb();

  const familyGroup = mockDb.familyGroups.find((g) => g.id === member.familyGroupId);
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
  if (AUTH_API_MODE === "real") {
    throw new Error("공동보호자 제거 API는 아직 백엔드에 없어서 mock 모드에서 테스트해 주세요.");
  }

  const requester = mockDb.guardianMembers.find(
    (m) =>
      m.familyGroupId === familyGroupId &&
      m.guardianId === requesterGuardianId &&
      m.status === "ACTIVE",
  );
  if (!requester) throw new Error("이 가족의 보호자만 제거할 수 있어요.");

  const target = mockDb.guardianMembers.find(
    (m) => m.familyGroupId === familyGroupId && m.id === guardianMemberId,
  );
  if (!target) throw new Error("제거할 보호자를 찾을 수 없어요.");
  target.status = "REVOKED";
  saveMockDb();
  return { success: true, data: { guardianMemberId, status: "REVOKED" } };
}

export async function listFamilyMembers(
  familyGroupId: string,
): Promise<ApiEnvelope<{ familyGroup: FamilyGroup | null; links: FamilyLink[]; guardianMembers: GuardianMember[] }>> {
  if (AUTH_API_MODE === "real") {
    const user = realCurrentUser;
    const links = user?.role === "guardian" ? (await getGuardianSeniors(user.id)).data : [];
    return {
      success: true,
      data: {
        familyGroup: user?.role === "guardian" ? realFamilyGroupForGuardian(user) : null,
        links,
        guardianMembers: user?.role === "guardian" ? [realGuardianMember(user)] : [],
      },
    };
  }

  return { success: true, data: membersForFamily(familyGroupId) };
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
  if (AUTH_API_MODE === "real") {
    if (!realCurrentUser) return null;
    const refreshToken = (await getRefreshToken()) ?? "";
    if (realCurrentUser.role === "guardian") {
      const links = (await getGuardianSeniors(realCurrentUser.id)).data;
      return {
        user: realCurrentUser,
        consentDone: true,
        refreshToken,
        familyGroup: realFamilyGroupForGuardian(realCurrentUser),
        links,
        guardianMembers: [realGuardianMember(realCurrentUser)],
      };
    }
    return {
      user: realCurrentUser,
      consentDone: true,
      refreshToken,
      familyGroup: null,
      links: [],
      guardianMembers: [],
    };
  }

  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    const acc = mockDb.accounts.find((a) => makeRefreshToken(a.id) === refreshToken);
    if (acc) {
      await saveToken(makeToken(acc.id));
      const user = toSession(acc);
      return { user, consentDone: !!acc.voiceConsentAt, refreshToken, ...familyStateForUser(user) };
    }
  }

  const token = await getToken();
  if (!token) return null;
  const acc = mockDb.accounts.find((a) => makeToken(a.id) === token);
  if (!acc) return null;
  const user = toSession(acc);
  return { user, consentDone: !!acc.voiceConsentAt, refreshToken: refreshToken ?? "", ...familyStateForUser(user) };
}

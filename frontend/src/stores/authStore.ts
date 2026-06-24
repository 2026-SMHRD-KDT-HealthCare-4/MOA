import { create } from "zustand";
import { restoreSession, logout as apiLogout } from "../api/auth";
import { saveOnboardingDone } from "../api/session";

export type UserRole = "elder" | "guardian";
export type Role = UserRole;
export type LinkStatus = "PENDING" | "ACTIVE" | "REVOKED";
// 평탄(flat) 모델: OWNER 는 '그룹 생성자·초대 발급자' 라벨일 뿐 권한 우위가 없다.
// 모든 보호자는 조회·관리 권한이 동등하다.
export type GuardianMemberRole = "OWNER" | "SUB_GUARDIAN";
// 직접사용자 온보딩에서 수집하는 프로필.
export type SeniorGender = "male" | "female";
export type FamilyHistoryLevel =
  | "parent_one"
  | "parents_both"
  | "grandparent_or_more"
  | "unknown"
  | "none";
export interface FamilyHistoryDetails {
  dementia: FamilyHistoryLevel;
  parkinson: FamilyHistoryLevel;
  diabetes: FamilyHistoryLevel;
  stroke: FamilyHistoryLevel;
}

const EMPTY_FAMILY_HISTORY_DETAILS: FamilyHistoryDetails = {
  dementia: "none",
  parkinson: "none",
  diabetes: "none",
  stroke: "none",
};

export interface FamilyGroup {
  id: string;
  name: string;
  createdByGuardianId: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  updatedAt: string;
}

// guardian_senior 연동(보호자↔직접사용자). id 는 모두 UUID 문자열(Supabase auth.users.id 계열).
export interface FamilyLink {
  linkId: string; // UUID — guardian_senior.link_id
  familyGroupId?: string;
  counterpartId: string; // UUID — 상대(직접사용자) senior_id
  counterpartName: string;
  relation: UserRole;
  status: LinkStatus;
  linkedAt?: string; // ACTIVE 전환 시각
}

export interface GuardianMember {
  id: string;
  familyGroupId: string;
  guardianId?: string;
  guardianName: string;
  memberRole: GuardianMemberRole;
  status: LinkStatus;
  invitedByGuardianId?: string;
  inviteCode?: string;
  inviteExpiresAt?: string;
  joinedAt?: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  token: string;
  linkedElderName?: string;
}

const MOCK_ELDER_SESSION: SessionUser = {
  id: "elder-1",
  name: "김순자",
  email: "senior@moa.app",
  role: "elder",
  token: "mock-token-elder-1",
};
const MOCK_GUARDIAN_SESSION: SessionUser = {
  id: "guardian-1",
  name: "김보호",
  email: "guardian@moa.app",
  role: "guardian",
  token: "mock-token-guardian-1",
};
// ⚠️ DEV 전용 자동 로그인 — 추적 코드의 기본값은 항상 OFF(null).
//   켜기: 각자 로컬 `.env.local`(gitignore됨)에 한 줄 추가 후 expo 서버 재시작.
//     EXPO_PUBLIC_DEV_AUTOLOGIN=elder      → 직접사용자(챗봇 메인)로 바로 부팅
//     EXPO_PUBLIC_DEV_AUTOLOGIN=guardian   → 보호자로 바로 부팅
//   끄기: 그 줄을 지우거나 비우고 재시작 → 정상 인증 흐름(로그인/클레임).
//   env 는 번들 타임에 주입되므로, 값을 바꾸면 dev 서버를 재시작해야 반영된다.
//   (.env.local 은 추적되지 않으니 다른 프론트엔드 작업자에겐 영향이 없다.)
const DEV_AUTOLOGIN = process.env.EXPO_PUBLIC_DEV_AUTOLOGIN;
const DEV_MOCK_SESSION: SessionUser | null =
  DEV_AUTOLOGIN === "elder"
    ? MOCK_ELDER_SESSION
    : DEV_AUTOLOGIN === "guardian"
      ? MOCK_GUARDIAN_SESSION
      : null;
const DEV_MOCK_FAMILY_GROUP: FamilyGroup = {
  id: "family-dev",
  name: "김순자 가족",
  createdByGuardianId: "guardian-1",
  status: "ACTIVE",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
// 연동(링크)은 클레임 완료 시 즉시 ACTIVE 로 생성된다(미사용 초대는 링크가 아니라 getPendingInvites 소스).
const DEV_MOCK_LINKS: FamilyLink[] = [
  {
    linkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
    familyGroupId: "family-dev",
    counterpartId: "cccccccc-cccc-4ccc-8ccc-cccccccccc01",
    counterpartName: "김순자",
    relation: "elder",
    status: "ACTIVE",
    linkedAt: new Date(0).toISOString(),
  },
];
const DEV_MOCK_GUARDIAN_MEMBERS: GuardianMember[] = [
  {
    id: "guardian-member-owner-dev",
    familyGroupId: "family-dev",
    guardianId: "guardian-1",
    guardianName: "김보호",
    memberRole: "OWNER",
    status: "ACTIVE",
    joinedAt: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "guardian-member-sub-dev",
    familyGroupId: "family-dev",
    guardianName: "김지훈",
    memberRole: "SUB_GUARDIAN",
    status: "PENDING",
    invitedByGuardianId: "guardian-1",
    inviteCode: "FAM-PND",
    createdAt: new Date(0).toISOString(),
  },
];

const userIdOf = (user: SessionUser | null): string | null => user?.id ?? null;

const computeHasGuardianTab = (
  role: UserRole | null,
  links: FamilyLink[],
  guardianMembers: GuardianMember[],
): boolean =>
  role === "guardian" &&
  (guardianMembers.some((m) => m.status === "ACTIVE") || links.some((l) => l.status === "ACTIVE"));

interface SetSessionOptions {
  refreshToken?: string | null;
  consentDone?: boolean;
  links?: FamilyLink[];
  familyGroup?: FamilyGroup | null;
  guardianMembers?: GuardianMember[];
  onboardingDone?: boolean;
}

interface AuthState {
  user: SessionUser | null;
  isLoggedIn: boolean;
  role: UserRole | null;
  name: string;

  userId: string | null;
  refreshToken: string | null;
  consentDone: boolean;
  links: FamilyLink[];
  familyGroup: FamilyGroup | null;
  familyGroupId: string | null;
  guardianMemberRole: GuardianMemberRole | null;
  guardianMembers: GuardianMember[];
  hasGuardianTab: boolean;
  hydrated: boolean;

  // 직접사용자 온보딩 프로필 (생년월일/성별/가족력).
  birthDate: string | null;
  gender: SeniorGender | null;
  familyHistory: string[];
  familyHistoryDetails: FamilyHistoryDetails;
  onboardingDone: boolean; // 온보딩 완료 여부 (가드 게이트)

  setSession: (user: SessionUser, opts?: SetSessionOptions) => void;
  setLinkedElder: (elderName: string) => void;
  setLinks: (links: FamilyLink[]) => void;
  setFamilyGroup: (familyGroup: FamilyGroup | null) => void;
  setGuardianMembers: (guardianMembers: GuardianMember[]) => void;
  setFamilyState: (state: {
    familyGroup?: FamilyGroup | null;
    links?: FamilyLink[];
    guardianMembers?: GuardianMember[];
  }) => void;
  setConsentDone: (done: boolean) => void;
  setOnboardingBirthDate: (birthDate: string) => void;
  setOnboardingGender: (gender: SeniorGender) => void;
  setOnboardingFamilyHistory: (familyHistory: string[]) => void;
  setFamilyHistoryDetails: (details: FamilyHistoryDetails) => void;
  setOnboardingDone: (done: boolean) => void;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

const loggedOutState = {
  user: null as SessionUser | null,
  isLoggedIn: false,
  role: null as UserRole | null,
  name: "",
  userId: null as string | null,
  refreshToken: null as string | null,
  consentDone: false,
  links: [] as FamilyLink[],
  familyGroup: null as FamilyGroup | null,
  familyGroupId: null as string | null,
  guardianMemberRole: null as GuardianMemberRole | null,
  guardianMembers: [] as GuardianMember[],
  hasGuardianTab: false,
  birthDate: null as string | null,
  gender: null as SeniorGender | null,
  familyHistory: [] as string[],
  familyHistoryDetails: { ...EMPTY_FAMILY_HISTORY_DETAILS },
  onboardingDone: false,
};

const familyGroupIdOf = (familyGroup?: FamilyGroup | null): string | null => familyGroup?.id ?? null;

const guardianMemberRoleOf = (
  user: SessionUser | null,
  guardianMembers: GuardianMember[],
): GuardianMemberRole | null => {
  if (!user || user.role !== "guardian") return null;
  return guardianMembers.find((m) => m.guardianId === user.id && m.status === "ACTIVE")?.memberRole ?? null;
};

const sessionState = (user: SessionUser, opts?: SetSessionOptions) => {
  const links = opts?.links ?? [];
  const guardianMembers = opts?.guardianMembers ?? [];
  const familyGroup = opts?.familyGroup ?? null;
  return {
    user,
    isLoggedIn: true,
    role: user.role,
    name: user.name,
    userId: userIdOf(user),
    refreshToken: opts?.refreshToken ?? null,
    consentDone: opts?.consentDone ?? false,
    links,
    familyGroup,
    familyGroupId: familyGroupIdOf(familyGroup),
    guardianMemberRole: guardianMemberRoleOf(user, guardianMembers),
    guardianMembers,
    hasGuardianTab: computeHasGuardianTab(user.role, links, guardianMembers),
    // 새 세션은 온보딩 미수집 상태로 시작(온보딩 화면에서 채운다).
    birthDate: null as string | null,
    gender: null as SeniorGender | null,
    familyHistory: [] as string[],
    familyHistoryDetails: { ...EMPTY_FAMILY_HISTORY_DETAILS },
    // 클레임/로그인 등 새 세션은 기본 미완료. (elder-claim → setSession 으로 false 초기화)
    onboardingDone: opts?.onboardingDone ?? false,
  };
};

const initialState = DEV_MOCK_SESSION
  ? sessionState(DEV_MOCK_SESSION, {
      consentDone: true,
      onboardingDone: true, // DEV 자동로그인은 온보딩 게이트를 건너뛴다.
      familyGroup: DEV_MOCK_SESSION.role === "guardian" ? DEV_MOCK_FAMILY_GROUP : null,
      links: DEV_MOCK_SESSION.role === "guardian" ? DEV_MOCK_LINKS : [],
      guardianMembers: DEV_MOCK_SESSION.role === "guardian" ? DEV_MOCK_GUARDIAN_MEMBERS : [],
    })
  : loggedOutState;

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,
  hydrated: false,

  setSession: (user, opts) => set(sessionState(user, opts)),

  setLinkedElder: (elderName) =>
    set((state) => (state.user ? { user: { ...state.user, linkedElderName: elderName } } : {})),

  setLinks: (links) =>
    set((state) => ({
      links,
      hasGuardianTab: computeHasGuardianTab(state.role, links, state.guardianMembers),
    })),

  setFamilyGroup: (familyGroup) =>
    set({ familyGroup, familyGroupId: familyGroupIdOf(familyGroup) }),

  setGuardianMembers: (guardianMembers) =>
    set((state) => ({
      guardianMembers,
      guardianMemberRole: guardianMemberRoleOf(state.user, guardianMembers),
      hasGuardianTab: computeHasGuardianTab(state.role, state.links, guardianMembers),
    })),

  setFamilyState: ({ familyGroup, links, guardianMembers }) =>
    set((state) => {
      const nextLinks = links ?? state.links;
      const nextGuardianMembers = guardianMembers ?? state.guardianMembers;
      const nextFamilyGroup = familyGroup !== undefined ? familyGroup : state.familyGroup;
      return {
        familyGroup: nextFamilyGroup,
        familyGroupId: familyGroupIdOf(nextFamilyGroup),
        links: nextLinks,
        guardianMembers: nextGuardianMembers,
        guardianMemberRole: guardianMemberRoleOf(state.user, nextGuardianMembers),
        hasGuardianTab: computeHasGuardianTab(state.role, nextLinks, nextGuardianMembers),
      };
    }),

  setConsentDone: (done) => set({ consentDone: done }),

  setOnboardingBirthDate: (birthDate) => set({ birthDate }),
  setOnboardingGender: (gender) => set({ gender }),
  setOnboardingFamilyHistory: (familyHistory) => set({ familyHistory }),
  setFamilyHistoryDetails: (familyHistoryDetails) => set({ familyHistoryDetails }),
  setOnboardingDone: (done) => {
    const userId = get().user?.id;
    if (userId) void saveOnboardingDone(userId, done);
    set({ onboardingDone: done });
  },

  hydrate: async () => {
    try {
      const restored = await restoreSession();
      if (restored) {
        set({
          ...sessionState(restored.user, {
            refreshToken: restored.refreshToken,
            consentDone: restored.consentDone,
            familyGroup: restored.familyGroup,
            links: restored.links,
            guardianMembers: restored.guardianMembers,
            onboardingDone: restored.onboardingDone,
          }),
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch {
      // 세션 복원 실패해도 앱은 로그인 화면으로 부팅(크래시 방지).
      set({ hydrated: true });
    }
  },

  logout: async () => {
    await apiLogout();
    set(loggedOutState);
  },
}));

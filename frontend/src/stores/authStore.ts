import { create } from "zustand";
import { restoreSession, logout as apiLogout } from "../api/auth";

export type UserRole = "elder" | "guardian";
export type Role = UserRole;
export type LinkStatus = "PENDING" | "ACTIVE" | "REVOKED";
export type GuardianMemberRole = "OWNER" | "SUB_GUARDIAN";

export interface FamilyGroup {
  id: string;
  name: string;
  createdByGuardianId: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  updatedAt: string;
}

// Existing elder-link compatibility model. In the FamilyGroup model this maps to FamilyElderMember.
export interface FamilyLink {
  linkId: number;
  familyGroupId?: string;
  counterpartId: number;
  counterpartName: string;
  relation: UserRole;
  status: LinkStatus;
  pairingCode?: string;
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
  role: UserRole;
  token: string;
  linkedElderName?: string;
}

const MOCK_ELDER_SESSION: SessionUser = {
  id: "elder-1",
  name: "김순자",
  role: "elder",
  token: "mock-token-elder-1",
};
const MOCK_GUARDIAN_SESSION: SessionUser = {
  id: "guardian-1",
  name: "김보호",
  role: "guardian",
  token: "mock-token-guardian-1",
};
void MOCK_ELDER_SESSION;
void MOCK_GUARDIAN_SESSION;

// Switch to MOCK_ELDER_SESSION or MOCK_GUARDIAN_SESSION during demos.
const DEV_MOCK_SESSION = null as SessionUser | null;
const DEV_MOCK_FAMILY_GROUP: FamilyGroup = {
  id: "family-dev",
  name: "김순자 가족",
  createdByGuardianId: "guardian-1",
  status: "ACTIVE",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
const DEV_MOCK_LINKS: FamilyLink[] = [
  { linkId: 1, familyGroupId: "family-dev", counterpartId: 101, counterpartName: "김순자", relation: "elder", status: "ACTIVE" },
  { linkId: 2, familyGroupId: "family-dev", counterpartId: 102, counterpartName: "박무남", relation: "elder", status: "PENDING", pairingCode: "MOA-PND" },
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

const userIdOf = (user: SessionUser | null): number | null => {
  if (!user) return null;
  const digits = user.id.replace(/\D/g, "");
  const n = Number(digits);
  return Number.isFinite(n) && digits !== "" ? n : null;
};

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
}

interface AuthState {
  user: SessionUser | null;
  isLoggedIn: boolean;
  role: UserRole | null;
  name: string;

  userId: number | null;
  refreshToken: string | null;
  consentDone: boolean;
  links: FamilyLink[];
  familyGroup: FamilyGroup | null;
  familyGroupId: string | null;
  guardianMemberRole: GuardianMemberRole | null;
  guardianMembers: GuardianMember[];
  hasGuardianTab: boolean;
  hydrated: boolean;

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
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

const loggedOutState = {
  user: null as SessionUser | null,
  isLoggedIn: false,
  role: null as UserRole | null,
  name: "",
  userId: null as number | null,
  refreshToken: null as string | null,
  consentDone: false,
  links: [] as FamilyLink[],
  familyGroup: null as FamilyGroup | null,
  familyGroupId: null as string | null,
  guardianMemberRole: null as GuardianMemberRole | null,
  guardianMembers: [] as GuardianMember[],
  hasGuardianTab: false,
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
  };
};

const initialState = DEV_MOCK_SESSION
  ? sessionState(DEV_MOCK_SESSION, {
      consentDone: true,
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

  hydrate: async () => {
    const restored = await restoreSession();
    if (restored) {
      set({
        ...sessionState(restored.user, {
          refreshToken: restored.refreshToken,
          consentDone: restored.consentDone,
          familyGroup: restored.familyGroup,
          links: restored.links,
          guardianMembers: restored.guardianMembers,
        }),
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  logout: async () => {
    await apiLogout();
    set(loggedOutState);
  },
}));

import { create } from "zustand";
import { restoreSession, logout as apiLogout } from "../api/auth";

export type UserRole = "elder" | "guardian";
export type Role = UserRole; // 스펙 표기 호환 별칭

// 가족 연동 링크 (보호자 ↔ 직접사용자). 스펙 §3 기준.
export interface FamilyLink {
  linkId: number;
  counterpartId: number;
  counterpartName: string;
  relation: UserRole; // 상대방의 역할
  status: "PENDING" | "ACTIVE";
  pairingCode?: string; // PENDING 동안 재공유용(클레임되면 의미 없음)
}

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  token: string;
  linkedElderName?: string; // 보호자인 경우 담당 직접사용자 이름
}

// ── 개발용 자동 로그인 토글 ─────────────────────────────────────────────
// 기본은 비로그인 시작(→ 역할 선택 화면 노출).
// 특정 역할 화면을 바로 띄워 테스트하려면 DEV_MOCK_SESSION에 MOCK_* 중 하나를 넣는다.
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

// 개발 중 자동 로그인하려면 위 상수 중 하나로 교체. 운영/기본값은 null(비로그인).
const DEV_MOCK_SESSION: SessionUser | null = null;

// 보호자 가족 탭/대시보드를 바로 보려면 DEV_MOCK_SESSION = MOCK_GUARDIAN_SESSION으로 두고
// 아래 링크를 사용한다(ACTIVE 1 + PENDING 1로 허브·상세·대기카드·게이팅 모두 확인 가능).
const DEV_MOCK_LINKS: FamilyLink[] = [
  { linkId: 1, counterpartId: 101, counterpartName: "김순자", relation: "elder", status: "ACTIVE" },
  { linkId: 2, counterpartId: 102, counterpartName: "박무남", relation: "elder", status: "PENDING", pairingCode: "MOA-PND" },
];
void DEV_MOCK_LINKS;
// ────────────────────────────────────────────────────────────────────────

const userIdOf = (user: SessionUser | null): number | null => {
  if (!user) return null;
  const n = Number(user.id.replace(/\D/g, ""));
  return Number.isFinite(n) && user.id.replace(/\D/g, "") !== "" ? n : null;
};

const computeHasGuardianTab = (role: UserRole | null, links: FamilyLink[]): boolean =>
  role === "guardian" && links.some((l) => l.status === "ACTIVE");

interface SetSessionOptions {
  refreshToken?: string | null;
  consentDone?: boolean;
  links?: FamilyLink[];
}

interface AuthState {
  user: SessionUser | null;
  // 편의 파생값 (화면에서 user?.role 대신 바로 사용)
  isLoggedIn: boolean;
  role: UserRole | null;
  name: string;

  // 스펙 §3 필드
  userId: number | null;
  refreshToken: string | null; // 직접사용자 장수명 토큰(자동 로그인)
  consentDone: boolean;
  links: FamilyLink[];
  hasGuardianTab: boolean; // role==='guardian' && ACTIVE 링크 ≥1

  // 앱 시작 시 세션 복원이 끝났는지 (라우트 가드가 깜빡임 없이 분기하기 위함)
  hydrated: boolean;

  // 로그인/회원가입 성공 후 세션 주입 (api/auth.ts가 반환한 SessionUser).
  setSession: (user: SessionUser, opts?: SetSessionOptions) => void;
  // 온보딩에서 직접사용자 계정 생성 후 담당 직접사용자 이름 연결.
  setLinkedElder: (elderName: string) => void;
  // 가족 링크 갱신 (가족 탭 노출 여부 재계산).
  setLinks: (links: FamilyLink[]) => void;
  // 생체정보 동의 완료 표시.
  setConsentDone: (done: boolean) => void;
  // 앱 시작 시 저장된 토큰으로 세션 복원.
  hydrate: () => Promise<void>;
  logout: () => void;
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
  hasGuardianTab: false,
};

const sessionState = (user: SessionUser, opts?: SetSessionOptions) => {
  const links = opts?.links ?? [];
  return {
    user,
    isLoggedIn: true,
    role: user.role,
    name: user.name,
    userId: userIdOf(user),
    refreshToken: opts?.refreshToken ?? null,
    consentDone: opts?.consentDone ?? false,
    links,
    hasGuardianTab: computeHasGuardianTab(user.role, links),
  };
};

const initialState = DEV_MOCK_SESSION
  ? sessionState(DEV_MOCK_SESSION, {
      consentDone: true,
      links: DEV_MOCK_SESSION.role === "guardian" ? DEV_MOCK_LINKS : [],
    })
  : loggedOutState;

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,
  hydrated: false,

  setSession: (user, opts) => set(sessionState(user, opts)),

  setLinkedElder: (elderName) =>
    set((state) => (state.user ? { user: { ...state.user, linkedElderName: elderName } } : {})),

  setLinks: (links) =>
    set({ links, hasGuardianTab: computeHasGuardianTab(get().role, links) }),

  setConsentDone: (done) => set({ consentDone: done }),

  hydrate: async () => {
    const restored = await restoreSession();
    if (restored) {
      set({
        ...sessionState(restored.user, {
          refreshToken: restored.refreshToken,
          consentDone: restored.consentDone,
        }),
        hydrated: true,
      });
    } else {
      // 복원 실패: 개발용 토글이 켜져 있으면 그 세션 유지, 아니면 비로그인.
      set({ hydrated: true });
    }
  },

  logout: () => {
    void apiLogout();
    set(loggedOutState);
  },
}));

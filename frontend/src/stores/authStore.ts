import { create } from "zustand";
import { restoreSession, logout as apiLogout } from "../api/auth";

export type UserRole = "elder" | "guardian";

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  token: string;
  linkedElderName?: string; // 보호자인 경우 담당 어른 이름
}

// mock 단계: 앱 시작 시 "로그인된 어른" 상태를 기본 주입한다.
// → 어른은 로그인/PIN 관문 없이 바로 홈으로 진입 (CLAUDE.md: 어른 일상에 매일 입력 관문 금지).
// 실제 연동 시: 초기 user를 null로 두고 hydrate()의 토큰 복원 결과로만 채운다.
const MOCK_DEFAULT_ELDER: SessionUser = {
  id: "elder-1",
  name: "김순자",
  role: "elder",
  token: "mock-token-elder-1",
};

interface AuthState {
  user: SessionUser | null;
  // 편의 파생값 (화면에서 user?.role 대신 바로 사용)
  isLoggedIn: boolean;
  role: UserRole;
  name: string;

  // 로그인/회원가입 성공 후 세션 주입 (api/auth.ts가 반환한 SessionUser).
  setSession: (user: SessionUser) => void;
  // 온보딩에서 어른 계정 생성 후 담당 어른 이름 연결.
  setLinkedElder: (elderName: string) => void;
  // 앱 시작 시 저장된 토큰으로 세션 복원 (mock: 토큰 없으면 기본 어른 유지).
  hydrate: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: MOCK_DEFAULT_ELDER,
  isLoggedIn: true,
  role: MOCK_DEFAULT_ELDER.role,
  name: MOCK_DEFAULT_ELDER.name,

  setSession: (user) => set({ user, isLoggedIn: true, role: user.role, name: user.name }),

  setLinkedElder: (elderName) =>
    set((state) => (state.user ? { user: { ...state.user, linkedElderName: elderName } } : {})),

  hydrate: async () => {
    const restored = await restoreSession();
    if (restored) {
      set({ user: restored, isLoggedIn: true, role: restored.role, name: restored.name });
    }
    // mock: 복원 실패 시 기본 어른 세션 유지 (관문 없이 통과).
  },

  logout: () => {
    void apiLogout();
    set({ user: null, isLoggedIn: false, role: "elder", name: "" });
  },
}));

import { create } from "zustand";

export type UserRole = "elder" | "guardian";

interface AuthState {
  isLoggedIn: boolean;
  role: UserRole;
  // 로그인 성공 시 role 설정 후 isLoggedIn = true
  login: (role: UserRole) => void;
  // 로그아웃 시 초기화
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  role: "elder",
  login: (role) => set({ isLoggedIn: true, role }),
  logout: () => set({ isLoggedIn: false, role: "elder" }),
}));

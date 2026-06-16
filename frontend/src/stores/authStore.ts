import { create } from "zustand";

export type UserRole = "elder" | "guardian";

export interface MockUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export type AuthResult = { ok: true } | { ok: false; error: string };
export type LoginResult = { ok: true; role: UserRole } | { ok: false; error: string };

interface AuthState {
  isLoggedIn: boolean;
  role: UserRole;
  name: string;
  email: string;

  // 백엔드 연동 전까지 메모리에 보관하는 mock 가입자 저장소.
  // 앱을 새로고침하면 초기화됨 (실제 API 연동 시 이 부분 제거).
  users: MockUser[];

  register: (user: MockUser) => AuthResult;
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  role: "elder",
  name: "",
  email: "",
  users: [],

  register: (user) => {
    const email = user.email.trim().toLowerCase();
    const exists = get().users.some((u) => u.email === email);
    if (exists) {
      return { ok: false, error: "이미 가입된 이메일이에요." };
    }
    set((state) => ({ users: [...state.users, { ...user, email }] }));
    return { ok: true };
  },

  login: (email, password) => {
    const normalized = email.trim().toLowerCase();
    const found = get().users.find((u) => u.email === normalized);
    if (!found || found.password !== password) {
      return { ok: false, error: "이메일 또는 비밀번호가 올바르지 않아요." };
    }
    set({ isLoggedIn: true, role: found.role, name: found.name, email: found.email });
    return { ok: true, role: found.role };
  },

  logout: () => set({ isLoggedIn: false, role: "elder", name: "", email: "" }),
}));

// 세션 토큰 영속화.
// - access 토큰: /auth/me 세션 복원을 위해 expo-secure-store에 보관.
// - refresh 토큰: 장명(長命, 자동 로그인) → expo-secure-store에 보관.
// 웹에는 SecureStore가 없어 localStorage로 폴백한다(웹 프리뷰/개발용).
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "moa.session.token";
const REFRESH_TOKEN_KEY = "moa.session.refresh";

const isWeb = Platform.OS === "web";

async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // 무시 (프라이빗 모드 등)
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // 무시
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// ── access 토큰 (메모리 + SecureStore / 웹 localStorage) ──────────────
let memoryAccessToken: string | null = null;

export async function saveToken(token: string): Promise<void> {
  memoryAccessToken = token;
  await secureSet(ACCESS_TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (memoryAccessToken) return memoryAccessToken;
  memoryAccessToken = await secureGet(ACCESS_TOKEN_KEY);
  return memoryAccessToken;
}

// ── refresh 토큰 (SecureStore / 웹 localStorage) ───────────────────────
export async function saveRefreshToken(token: string): Promise<void> {
  await secureSet(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return secureGet(REFRESH_TOKEN_KEY);
}

export async function clearRefreshToken(): Promise<void> {
  await secureDelete(REFRESH_TOKEN_KEY);
}

// 로그아웃: access(메모리) + refresh(보관소) 모두 폐기.
export async function clearToken(): Promise<void> {
  memoryAccessToken = null;
  await secureDelete(ACCESS_TOKEN_KEY);
  await clearRefreshToken();
}

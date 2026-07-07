// 세션 토큰 영속화.
// - access 토큰: /auth/me 세션 복원을 위해 expo-secure-store에 보관.
// - refresh 토큰: 장명(長命, 자동 로그인) → expo-secure-store에 보관.
// 웹에는 SecureStore가 없어 localStorage로 폴백한다(웹 프리뷰/개발용).
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "moa.session.token";
const REFRESH_TOKEN_KEY = "moa.session.refresh";
const ONBOARDING_STATE_KEY = "moa.session.onboarding";

const isWeb = Platform.OS === "web";

// 토큰 자동 갱신(/auth/refresh) 호출용. 다른 api 모듈과 동일 기준.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

function isMockAccessToken(token: string | null | undefined): token is string {
  return Boolean(token?.startsWith("mock-token-"));
}

async function clearStoredAuthTokens(): Promise<void> {
  memoryAccessToken = null;
  await secureDelete(ACCESS_TOKEN_KEY);
  await secureDelete(REFRESH_TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  if (isMockAccessToken(token)) {
    console.warn(
      "[MOA_SESSION] 실제 로그인 토큰이 필요합니다. mock-token이 감지되어 저장하지 않고 세션 토큰을 정리합니다.",
    );
    await clearStoredAuthTokens();
    return;
  }

  memoryAccessToken = token;
  await secureSet(ACCESS_TOKEN_KEY, token);
}

function base64Decode(str: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  const cleaned = str.replace(/=+$/, "");
  for (let i = 0; i < cleaned.length; i += 4) {
    const bc1 = chars.indexOf(cleaned.charAt(i));
    const bc2 = chars.indexOf(cleaned.charAt(i + 1));
    const bc3 = i + 2 < cleaned.length ? chars.indexOf(cleaned.charAt(i + 2)) : 0;
    const bc4 = i + 3 < cleaned.length ? chars.indexOf(cleaned.charAt(i + 3)) : 0;
    const val = (bc1 << 18) | (bc2 << 12) | (bc3 << 6) | bc4;
    output += String.fromCharCode((val >> 16) & 255);
    if (bc3 !== 64 && i + 2 < cleaned.length) {
      output += String.fromCharCode((val >> 8) & 255);
    }
    if (bc4 !== 64 && i + 3 < cleaned.length) {
      output += String.fromCharCode(val & 255);
    }
  }
  return output;
}

// JWT payload 의 exp(초) → 밀리초.
function tokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = JSON.parse(base64Decode(padded)) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

// 동시 다발 갱신 방지용 in-flight 프라미스(단일 세션 가정 — 한 번에 하나만 갱신).
let refreshInFlight: Promise<string | null> | null = null;

// refresh_token 으로 새 access_token 을 발급받아 저장한다. 실패 시 토큰 정리 후 null.
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      await clearStoredAuthTokens();
      return null;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) throw new Error("REFRESH_FAILED");
      const body = (await res.json()) as {
        data?: { access_token?: string; refresh_token?: string };
      };
      const newAccess = body.data?.access_token;
      const newRefresh = body.data?.refresh_token;
      if (!newAccess) throw new Error("REFRESH_NO_TOKEN");
      await saveToken(newAccess);
      if (newRefresh) await saveRefreshToken(newRefresh);
      return newAccess;
    } catch {
      // 갱신 실패(만료·무효 refresh) → 세션 정리, 재로그인 유도
      await clearStoredAuthTokens();
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function getToken(): Promise<string | null> {
  if (!memoryAccessToken) {
    memoryAccessToken = await secureGet(ACCESS_TOKEN_KEY);
  }

  if (isMockAccessToken(memoryAccessToken)) {
    console.warn(
      "[MOA_SESSION] 실제 로그인 토큰이 필요합니다. mock-token이 감지되어 저장된 세션 토큰을 정리합니다.",
    );
    await clearStoredAuthTokens();
    return null;
  }

  if (!memoryAccessToken) return null;

  // 만료됐거나 60초 내 만료 예정이면 선제 갱신 → 모든 API 호출이 유효 토큰을 쓰게 한다.
  // exp 디코드 불가(예: atob 미지원 환경)면 갱신을 건너뛰고 저장 토큰을 그대로 반환한다.
  const expMs = tokenExpiryMs(memoryAccessToken);
  if (expMs !== null && expMs - Date.now() < 60_000) {
    return refreshAccessToken();
  }

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

async function getOnboardingState(): Promise<Record<string, boolean>> {
  const raw = await secureGet(ONBOARDING_STATE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveOnboardingDone(userId: string, done: boolean): Promise<void> {
  const state = await getOnboardingState();
  if (done) state[userId] = true;
  else delete state[userId];
  await secureSet(ONBOARDING_STATE_KEY, JSON.stringify(state));
}

export async function getOnboardingDone(userId: string): Promise<boolean> {
  const state = await getOnboardingState();
  return state[userId] === true;
}

// 로그아웃: access(메모리) + refresh(보관소) 모두 폐기.
export async function clearToken(): Promise<void> {
  await clearStoredAuthTokens();
}

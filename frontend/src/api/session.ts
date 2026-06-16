// 세션 토큰 영속화 자리.
// 실제 연동 시: expo-secure-store(SecureStore.setItemAsync 등)로 교체.
// mock 단계: 메모리에만 보관하고 항상 통과 처리 (어른 일상에 관문을 만들지 않기 위함).

const TOKEN_KEY = "moa.session.token";
let memoryToken: string | null = null;

export async function saveToken(token: string): Promise<void> {
  memoryToken = token;
  // TODO(실제): await SecureStore.setItemAsync(TOKEN_KEY, token);
  void TOKEN_KEY;
}

export async function getToken(): Promise<string | null> {
  // TODO(실제): return await SecureStore.getItemAsync(TOKEN_KEY);
  return memoryToken;
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  // TODO(실제): await SecureStore.deleteItemAsync(TOKEN_KEY);
}

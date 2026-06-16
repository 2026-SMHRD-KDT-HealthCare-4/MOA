import { useRouter } from "expo-router";
import { useWakeWordStore } from "../stores/wakeWordStore";

// FR-10 키워드 → 라우트 매핑 (docs/01_mvp_scope.md 참조)
const KEYWORD_ROUTES: [string, string][] = [
  ["모아야, 기록", "/(elder)/history"],
  ["모아야, 홈", "/(elder)/"],
  ["모아야, 설정", "/(elder)/settings"],
  ["모아야, 대화하자", "/chat"],
  ["모아야", "/chat"],
];

function matchRoute(text: string): string | null {
  const t = text.trim();
  for (const [keyword, route] of KEYWORD_ROUTES) {
    if (t.includes(keyword)) return route;
  }
  return null;
}

export function useWakeWord() {
  const router = useRouter();
  const { isActive, enable, disable } = useWakeWordStore();

  // ZDR: 호출어 감지 즉시 이동 — 확인 팝업 없음
  // mock: 실제 마이크 감지 대신 handleSpeech(text)를 외부에서 직접 호출
  // 실제 연동 시: 연속 STT 결과를 이 함수에 전달
  function handleSpeech(text: string): boolean {
    if (!isActive) return false;
    const route = matchRoute(text);
    if (!route) return false;
    router.push(route as Parameters<typeof router.push>[0]);
    return true;
  }

  return { isActive, enable, disable, handleSpeech };
}

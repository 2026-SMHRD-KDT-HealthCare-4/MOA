import { create } from "zustand";

interface ChatSessionState {
  activeSessionByUser: Record<string, string>;
  getActiveSession: (userId: string) => string | null;
  setActiveSession: (userId: string, sessionId: string) => void;
  clearActiveSession: (userId: string, expectedSessionId?: string) => void;
}

// ChatbotMain과 ChatPage가 서로 다른 useMoaChat 훅 인스턴스를 사용하더라도
// 인증 사용자별 활성 session_id는 하나를 공유한다. 앱을 새로고침하면 메모리 상태가
// 사라져 새 대화로 시작하며, 일반 화면 전환·컴포넌트 재마운트에는 유지된다.
export const useChatSessionStore = create<ChatSessionState>((set, get) => ({
  activeSessionByUser: {},

  getActiveSession: (userId) => get().activeSessionByUser[userId] ?? null,

  setActiveSession: (userId, sessionId) =>
    set((state) => ({
      activeSessionByUser: {
        ...state.activeSessionByUser,
        [userId]: sessionId,
      },
    })),

  clearActiveSession: (userId, expectedSessionId) =>
    set((state) => {
      const current = state.activeSessionByUser[userId];
      if (!current || (expectedSessionId && current !== expectedSessionId)) return state;

      const next = { ...state.activeSessionByUser };
      delete next[userId];
      return { activeSessionByUser: next };
    }),
}));

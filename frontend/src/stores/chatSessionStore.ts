// 챗봇 대화 세션 ID 전역 스토어.
//
// 문제: 세션 ID를 useMoaChat 훅 내부의 useRef 에 저장하면,
//   - ChatbotMain 과 ChatPage 가 각각 useMoaChat() 을 호출해 서로 다른 ref 를 가지고
//   - 화면 전환/재마운트 시 ref 가 null 로 초기화되어
//   한 대화가 여러 세션으로 쪼개진다(백엔드가 매 턴 새 session 생성).
//
// 해결: 세션 ID를 컴포넌트 바깥의 zustand 스토어에 두어, 어느 컴포넌트에서
//   useMoaChat 을 호출하든 같은 세션 ID를 공유하고, 재마운트되어도 유지되게 한다.
//
// 사용:
//   const { sessionId, setSessionId, clearSession } = useChatSessionStore();
//   또는 렌더 밖(콜백/비동기)에서는 useChatSessionStore.getState() 로 직접 접근.

import { create } from "zustand";

interface ChatSessionState {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  clearSession: () => void;
}

export const useChatSessionStore = create<ChatSessionState>((set) => ({
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),
  clearSession: () => set({ sessionId: null }),
}));
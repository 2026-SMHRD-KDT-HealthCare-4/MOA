// 모아 안부 대화(chat_session) 조회 API. 기록 화면(HistoryPage)에서 '모아와 대화' 기록 표시용.
import { apiFetch } from "./auth";

export interface ChatSessionSummary {
  sessionId: string;
  startedAt: string; // 서버는 타임존 표기 없는 UTC 문자열로 내려준다(파싱 시 UTC 처리 필요).
  endedAt: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  userMessageCount: number;
}

interface ChatSessionResponseDto {
  session_id: string;
  senior_id: string;
  started_at: string;
  ended_at: string | null;
  messages: { user: number; content: string; time: string }[];
  created_at: string;
}

// GET /chat/history/{seniorId} — 모아 대화 세션 목록(최근 30건). 본인 또는 연동 보호자만.
// 원문 대화 내용은 화면에 노출하지 않고, 날짜/시각/세션 수 집계에만 사용한다.
export async function listChatSessions(seniorId: string): Promise<ChatSessionSummary[]> {
  const res = await apiFetch<ChatSessionResponseDto[]>(`/chat/history/${seniorId}`, {
    method: "GET",
    auth: true,
  });
  return (res ?? []).map((s) => ({
    sessionId: s.session_id,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    lastMessageAt:
      Array.isArray(s.messages) && s.messages.length > 0
        ? s.messages[s.messages.length - 1]?.time ?? null
        : null,
    messageCount: Array.isArray(s.messages) ? s.messages.length : 0,
    userMessageCount: Array.isArray(s.messages)
      ? s.messages.filter((message) => message.user === 0).length
      : 0,
  }));
}

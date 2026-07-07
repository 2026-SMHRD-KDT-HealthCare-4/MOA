import type { BotEmotion } from "../../constants/emotionMap";

export type UserIntent =
  | "greeting"
  | "daily_talk"
  | "family_talk"
  | "meal_talk"
  | "sleep_talk"
  | "positive_mood"
  | "negative_mood"
  | "health_discomfort"
  | "loneliness"
  | "start_recording"
  | "show_result"
  | "navigate_record"
  | "medication_info"
  | "hospital_info"
  | "family_connect"
  | "wake_up"
  | "goodbye"
  | "unknown";

export type NextAction = "continue" | "finish" | "navigate" | "urgent_alert";

export interface ChatbotResponse {
  status: "success";
  data: {
    reply: string;
    user_intent: UserIntent;
    bot_emotion: BotEmotion;
    next_action: NextAction;
    chat_state: "idle" | "botSpeaking" | "listening" | "thinking" | "completed" | "error";
    should_end: boolean;
    route?: string | null;
    conversation_topic?: string | null;
    question_index?: number;
    source?: "frontend hardcoded" | "backend template" | "llm" | "rule_override" | "mock" | string | null;
    override_reason?: string | null;
    session_id?: string;
  };
}

export interface ChatbotApiParams {
  message: string;
  conversation_turn?: number;
  valid_speech_duration_ms?: number;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  current_topic?: string | null;
  question_index?: number;
  senior_id?: string;
  session_id?: string | null;
  acoustic_meta: {
    duration_ms: number;
    pause_events: number;
  };
}

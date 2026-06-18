import type { BotEmotion } from "../constants/emotionMap";

export type UserIntent =
  | "greeting"
  | "daily_talk"
  | "family_talk"
  | "meal_talk"
  | "positive_mood"
  | "negative_mood"
  | "health_discomfort"
  | "loneliness"
  | "start_recording"
  | "show_result"
  | "goodbye"
  | "unknown";

export type NextAction = "continue" | "finish";

export interface ChatbotResponse {
  status: "success";
  data: {
    reply: string;
    user_intent: UserIntent;
    bot_emotion: BotEmotion;
    next_action: NextAction;
    chat_state: "idle" | "botSpeaking" | "listening" | "thinking" | "completed" | "error";
    should_end: boolean;
  };
}

export interface ChatbotApiParams {
  message: string;
  conversation_turn?: number;
  valid_speech_duration_ms?: number;
  acoustic_meta: {
    duration_ms: number;
    pause_events: number;
  };
}

const MOCK_RESPONSES: ChatbotResponse[] = [
  {
    status: "success",
    data: {
      reply: "안녕하세요. 오늘은 어떤 하루였나요?",
      user_intent: "greeting",
      bot_emotion: "happy",
      next_action: "continue",
      chat_state: "botSpeaking",
      should_end: false,
    },
  },
  {
    status: "success",
    data: {
      reply: "와, 좋은 일이 있으셨군요. 저도 기분이 좋아요.",
      user_intent: "positive_mood",
      bot_emotion: "happy",
      next_action: "continue",
      chat_state: "botSpeaking",
      should_end: false,
    },
  },
  {
    status: "success",
    data: {
      reply: "아이고, 불편하셨겠어요. 무리하지 마시고 잠깐 쉬어 주세요.",
      user_intent: "health_discomfort",
      bot_emotion: "worried",
      next_action: "continue",
      chat_state: "botSpeaking",
      should_end: false,
    },
  },
];

let idx = 0;

export function mockChatbotApi(_params: ChatbotApiParams): Promise<ChatbotResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(MOCK_RESPONSES[idx++ % MOCK_RESPONSES.length]);
    }, 1500);
  });
}

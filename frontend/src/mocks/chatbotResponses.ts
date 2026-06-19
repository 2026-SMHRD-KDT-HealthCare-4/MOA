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

function createResponse(
  reply: string,
  user_intent: UserIntent,
  bot_emotion: BotEmotion,
  should_end = false,
): ChatbotResponse {
  return {
    status: "success",
    data: {
      reply,
      user_intent,
      bot_emotion,
      next_action: should_end ? "finish" : "continue",
      chat_state: should_end ? "completed" : "botSpeaking",
      should_end,
    },
  };
}

function pickMockResponse(message: string): ChatbotResponse {
  const text = message.replace(/\s/g, "").toLowerCase();

  if (/(안녕|하이|반가|처음)/.test(text)) {
    return createResponse("안녕하세요. 오늘은 어떤 하루였나요?", "greeting", "happy");
  }

  if (/(밥|식사|아침|점심|저녁|먹었|드셨|반찬|국|간식|배고|출출|시장)/.test(text)) {
    return createResponse("출출하셨군요. 식사는 너무 늦지 않게 챙겨 드시는 게 좋아요.", "meal_talk", "happy");
  }

  if (/(허리|무릎|어깨|머리|배아파|복통|아파|아프|통증|쑤셔|불편|어지러|힘들|피곤|피로|지쳐|기운없|기운이없|몸살)/.test(text)) {
    return createResponse(
      "아이고, 많이 지치셨겠어요. 오늘은 무리하지 마시고 물 한 잔 드신 뒤 잠깐 쉬어 주세요.",
      "health_discomfort",
      "worried",
    );
  }

  if (/(좋아|기뻐|행복|웃|산책|재밌|즐거|고마)/.test(text)) {
    return createResponse("와, 좋은 시간이 있으셨군요. 이야기만 들어도 저도 기분이 좋아져요.", "positive_mood", "happy");
  }

  if (/(외로|심심|우울|슬퍼|속상|걱정|불안|잠이안)/.test(text)) {
    return createResponse("그런 마음이 드셨군요. 제가 옆에서 조금 더 들어드릴게요.", "loneliness", "worried");
  }

  if (/(그만|끝|잘가|나중에|종료)/.test(text)) {
    return createResponse("좋아요. 오늘 이야기 들려주셔서 고마워요. 편안히 쉬세요.", "goodbye", "clapping", true);
  }

  return createResponse("그랬군요. 조금 더 자세히 이야기해 주실 수 있을까요?", "daily_talk", "default");
}

export function mockChatbotApi(params: ChatbotApiParams): Promise<ChatbotResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(pickMockResponse(params.message));
    }, 1500);
  });
}

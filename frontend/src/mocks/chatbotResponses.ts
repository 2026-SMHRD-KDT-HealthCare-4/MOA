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
  history?: Array<{ role: "user" | "assistant"; content: string }>;
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

function pickByTurn<T>(items: T[], turn = 0): T {
  return items[Math.abs(turn) % items.length];
}

function pickMockResponse(message: string, turn = 0): ChatbotResponse {
  const text = message.replace(/\s/g, "").toLowerCase();

  if (/(안녕|하이|반가|처음)/.test(text)) {
    return createResponse("안녕하세요. 오늘은 어떤 하루였나요?", "greeting", "happy");
  }

  if (/(밥|식사|아침|점심|저녁|먹었|드셨|반찬|국|간식|배고|출출|시장)/.test(text)) {
    return createResponse(
      pickByTurn([
        "식사 이야기를 들려주셔서 고마워요. 오늘 드신 것 중에 가장 맛있었던 건 무엇이었나요?",
        "잘 챙겨 드셨다니 마음이 놓여요. 다음 식사에는 무엇을 드시고 싶으세요?",
        "맛있는 식사는 하루를 든든하게 해 주지요. 식사 후에는 조금 쉬셨나요?",
      ], turn),
      "meal_talk",
      "happy",
    );
  }

  if (/(허리|무릎|어깨|머리|배아파|복통|아파|아프|통증|쑤셔|불편|어지러|힘들|피곤|피로|지쳐|기운없|기운이없|몸살)/.test(text)) {
    return createResponse(
      pickByTurn([
        "많이 불편하셨겠어요. 지금은 무리하지 말고 편한 자세로 잠깐 쉬어 주세요.",
        "그런 날도 있지요. 물을 조금 드시고, 불편함이 계속되면 가족에게도 알려 주세요.",
        "몸이 보내는 신호일 수 있어요. 오늘은 천천히 쉬면서 상태를 살펴봐요.",
      ], turn),
      "health_discomfort",
      "worried",
    );
  }

  if (/(좋아|기뻐|행복|웃|산책|재밌|즐거|고마)/.test(text)) {
    return createResponse(
      pickByTurn([
        "좋은 시간이 있으셨군요. 이야기만 들어도 저도 기분이 좋아져요. 가장 기억나는 순간은 무엇인가요?",
        "정말 반가운 하루였겠어요. 그 기분을 내일도 이어갈 수 있으면 좋겠어요.",
        "웃을 일이 있었다니 참 좋아요. 누구와 함께하셨는지 더 들려주실래요?",
      ], turn),
      "positive_mood",
      "happy",
    );
  }

  if (/(외로|심심|우울|슬퍼|속상|걱정|불안|잠이안)/.test(text)) {
    return createResponse(
      pickByTurn([
        "그런 마음이 드셨군요. 제가 옆에서 조금 더 들어드릴게요. 오늘 특히 마음에 남는 일이 있었나요?",
        "혼자 견디지 않아도 괜찮아요. 편하게 한 문장씩 더 이야기해 주세요.",
        "마음이 무거우셨겠어요. 지금 곁에 연락할 수 있는 가족이나 친구가 있나요?",
      ], turn),
      "loneliness",
      "worried",
    );
  }

  if (/(그만|끝|잘가|나중에|종료)/.test(text)) {
    return createResponse("좋아요. 오늘 이야기 들려주셔서 고마워요. 편안히 쉬세요.", "goodbye", "clapping", true);
  }

  return createResponse(
    pickByTurn([
      "그랬군요. 오늘 이야기 중에서 가장 기억에 남는 순간을 조금 더 들려주실 수 있을까요?",
      "말씀해 주셔서 고마워요. 그때 기분은 어떠셨어요?",
      "천천히 잘 들었어요. 그 다음에는 어떻게 보내셨어요?",
      "하루를 차분히 보내고 계셨군요. 지금 가장 하고 싶은 일은 무엇인가요?",
    ], turn),
    "daily_talk",
    "default",
  );
}

export function mockChatbotApi(params: ChatbotApiParams): Promise<ChatbotResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(pickMockResponse(params.message, params.conversation_turn));
    }, 1500);
  });
}

// docs/02 §5 API 규격 준수. mock 단계에서 실제 백엔드 대역.

export interface ChatbotResponse {
  status: "success";
  data: {
    intent: string;
    confidence: number;
    reply_type: "TEXT" | "TEXT_WITH_CHART";
    message: string;
    emotion_controls: {
      user_emotion: string;
      bot_emotion: string;
    };
    payload: {
      score: number;
      status: "NORMAL" | "CAUTION" | "ALERT";
    };
  };
}

export interface ChatbotApiParams {
  message: string;
  acoustic_meta: {
    duration_ms: number;
    pause_events: number;
  };
}

const GREETING: ChatbotResponse[] = [
  {
    status: "success",
    data: {
      intent: "INT_001",
      confidence: 0.92,
      reply_type: "TEXT",
      message: "오늘도 이렇게 이야기해 주셔서 기뻐요! 어떻게 지내셨어요?",
      emotion_controls: { user_emotion: "neutral", bot_emotion: "happy" },
      payload: { score: 70, status: "NORMAL" },
    },
  },
  {
    status: "success",
    data: {
      intent: "INT_001",
      confidence: 0.88,
      reply_type: "TEXT",
      message: "목소리가 참 따뜻하게 들려요. 오늘 하루도 잘 보내셨나요?",
      emotion_controls: { user_emotion: "happy", bot_emotion: "happy" },
      payload: { score: 75, status: "NORMAL" },
    },
  },
];

const STATUS: ChatbotResponse[] = [
  {
    status: "success",
    data: {
      intent: "INT_002",
      confidence: 0.94,
      reply_type: "TEXT",
      message: "요즘 목소리 패턴을 살펴보니 평소와 비슷한 좋은 흐름이에요. 잘 지내고 계신 것 같아서 참 다행이에요!",
      emotion_controls: { user_emotion: "curious", bot_emotion: "happy" },
      payload: { score: 45, status: "NORMAL" },
    },
  },
  {
    status: "success",
    data: {
      intent: "INT_002",
      confidence: 0.87,
      reply_type: "TEXT",
      message: "오늘 목소리에서 평소와 조금 다른 변화가 느껴져요. 충분히 쉬고 계시나요?",
      emotion_controls: { user_emotion: "tired", bot_emotion: "worried" },
      payload: { score: 35, status: "CAUTION" },
    },
  },
];

const GUIDE: ChatbotResponse[] = [
  {
    status: "success",
    data: {
      intent: "INT_003",
      confidence: 0.95,
      reply_type: "TEXT",
      message: "모아는 매일 목소리를 들으며 건강 변화를 함께 살펴봐요. 편하게 이야기해 주시면 돼요!",
      emotion_controls: { user_emotion: "curious", bot_emotion: "happy" },
      payload: { score: 0, status: "NORMAL" },
    },
  },
];

const ALL = [...GREETING, ...STATUS, ...GUIDE];
let idx = 0;

export function mockChatbotApi(_params: ChatbotApiParams): Promise<ChatbotResponse> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(ALL[idx++ % ALL.length]);
    }, 1500);
  });
}

import { useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";

import { mockChatbotApi, type ChatbotApiParams, type ChatbotResponse } from "../../mocks/chatbotResponses";
import { type BotEmotion } from "../../constants/emotionMap";
import { useWakeWordStore } from "../../stores/wakeWordStore";
import { getToken } from "../../api/session";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  emotion?: BotEmotion;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.EXPO_PUBLIC_OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const TTS_VOICE = "nova";

const MOA_CHATBOT_INSTRUCTIONS = `
당신은 '모아'라는 이름의 AI 돌봄 친구입니다.
노년층 사용자가 편하게 말한 한국어 문장을 이해하고, 따뜻하고 짧게 응답하세요.

규칙:
- 사용자의 표현을 키워드 하나로만 판단하지 말고 문맥과 감정을 함께 보세요.
- 답변은 1~2문장, 쉬운 한국어로 말하세요.
- 통증, 심한 피로, 어지러움, 위험 신호가 있으면 공감하고 쉬도록 안내하며 가족에게 알리라고 말하세요.
- 외로움/우울/불안은 다그치지 말고 들어주겠다고 말하세요.
- 식사/일상/좋은 일은 자연스럽게 후속 질문을 해 대화를 이어가세요.
- 의료 진단이나 처방처럼 말하지 마세요.

반드시 JSON만 반환하세요.
`;

const MOA_CHATBOT_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "moa_chatbot_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "user_intent", "bot_emotion", "next_action", "chat_state", "should_end"],
    properties: {
      reply: { type: "string" },
      user_intent: {
        type: "string",
        enum: [
          "greeting",
          "daily_talk",
          "family_talk",
          "meal_talk",
          "positive_mood",
          "negative_mood",
          "health_discomfort",
          "loneliness",
          "start_recording",
          "show_result",
          "goodbye",
          "unknown",
        ],
      },
      bot_emotion: {
        type: "string",
        enum: ["default", "listening", "thinking", "happy", "worried", "clapping"],
      },
      next_action: { type: "string", enum: ["continue", "finish"] },
      chat_state: {
        type: "string",
        enum: ["idle", "botSpeaking", "listening", "thinking", "completed", "error"],
      },
      should_end: { type: "boolean" },
    },
  },
} as const;

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunk) as unknown as number[]));
  }

  return btoa(binary);
}

async function playTTS(text: string, soundRef: React.RefObject<Audio.Sound | null>): Promise<void> {
  try {
    const token = await getToken();
    const backendResponse = await fetch(`${API_BASE_URL}/speech/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ voice: TTS_VOICE, text }),
    });

    const response = backendResponse.ok
      ? backendResponse
      : OPENAI_API_KEY
        ? await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: "tts-1", voice: TTS_VOICE, input: text }),
          })
        : backendResponse;

    if (!response.ok) return;

    let uri: string;
    let blobUrl: string | null = null;

    if (Platform.OS === "web") {
      const blob = await response.blob();
      blobUrl = URL.createObjectURL(blob);
      uri = blobUrl;
    } else {
      const buffer = await response.arrayBuffer();
      const base64 = await arrayBufferToBase64(buffer);
      uri = `data:audio/mpeg;base64,${base64}`;
    }

    const { sound } = await Audio.Sound.createAsync({ uri });
    (soundRef as React.MutableRefObject<Audio.Sound | null>).current = sound;
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        (soundRef as React.MutableRefObject<Audio.Sound | null>).current = null;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }
    });
  } catch {
    // Text response remains available even when TTS fails.
  }
}

function mapBotEmotion(rawEmotion: string): BotEmotion {
  const map: Record<string, BotEmotion> = {
    default: "default",
    listening: "listening",
    thinking: "thinking",
    happy: "happy",
    worried: "worried",
    clapping: "clapping",
  };

  return map[rawEmotion] ?? "default";
}

function extractResponseText(data: unknown): string | null {
  const response = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typeof response.output_text === "string") return response.output_text;

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") return content.text;
    }
  }

  return null;
}

function normalizeChatbotResponse(raw: unknown): ChatbotResponse {
  const data = raw as Partial<ChatbotResponse["data"]>;
  const botEmotion = mapBotEmotion(String(data.bot_emotion ?? "default"));
  const shouldEnd = Boolean(data.should_end);

  return {
    status: "success",
    data: {
      reply: typeof data.reply === "string" ? data.reply : "그랬군요. 제가 조금 더 들어드릴게요.",
      user_intent: typeof data.user_intent === "string" ? data.user_intent : "unknown",
      bot_emotion: botEmotion,
      next_action: shouldEnd ? "finish" : "continue",
      chat_state: shouldEnd ? "completed" : "botSpeaking",
      should_end: shouldEnd,
    },
  } as ChatbotResponse;
}

async function callOpenAIChatbotApi(params: ChatbotApiParams): Promise<ChatbotResponse> {
  if (!OPENAI_API_KEY) return mockChatbotApi(params);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      instructions: MOA_CHATBOT_INSTRUCTIONS,
      input: params.message,
      text: {
        format: MOA_CHATBOT_RESPONSE_FORMAT,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("LLM_REQUEST_FAILED");
  }

  const data = await response.json();
  const outputText = extractResponseText(data);

  if (!outputText) {
    throw new Error("LLM_EMPTY_RESPONSE");
  }

  return normalizeChatbotResponse(JSON.parse(outputText));
}

async function callBackendChatbotApi(params: ChatbotApiParams): Promise<ChatbotResponse> {
  const response = await fetch(`${API_BASE_URL}/chat/dev`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("BACKEND_CHAT_REQUEST_FAILED");
  }

  return (await response.json()) as ChatbotResponse;
}

async function callChatbotApi(params: ChatbotApiParams): Promise<ChatbotResponse> {
  try {
    return await callBackendChatbotApi(params);
  } catch (error) {
    console.warn("[MOA_CHATBOT_BACKEND_FALLBACK]", error);
    try {
      return await callOpenAIChatbotApi(params);
    } catch (llmError) {
      console.warn("[MOA_CHATBOT_LLM_FALLBACK]", llmError);
      return mockChatbotApi(params);
    }
  }
}

export function useMoaChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [botEmotion, setBotEmotion] = useState<BotEmotion>("default");
  const soundRef = useRef<Audio.Sound | null>(null);
  const conversationTurnRef = useRef(0);
  const validSpeechDurationRef = useRef(0);
  const { disable: disableWakeWord, enable: enableWakeWord } = useWakeWordStore();

  async function sendMessage(text: string, acousticMeta?: Partial<ChatbotApiParams["acoustic_meta"]>) {
    if (!text.trim()) return;

    disableWakeWord();

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setIsBotTyping(true);
    setBotEmotion("listening");

    try {
      const params: ChatbotApiParams = {
        message: text,
        conversation_turn: conversationTurnRef.current,
        valid_speech_duration_ms: validSpeechDurationRef.current,
        acoustic_meta: { duration_ms: 0, pause_events: 0, ...acousticMeta },
      };

      const res: ChatbotResponse = await callChatbotApi(params);
      conversationTurnRef.current += 1;
      validSpeechDurationRef.current += params.acoustic_meta.duration_ms;

      const emotion = mapBotEmotion(res.data.bot_emotion);
      setBotEmotion(emotion);

      const botMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        role: "bot",
        text: res.data.reply,
        emotion,
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsBotTyping(false);

      await playTTS(res.data.reply, soundRef);
    } catch {
      setBotEmotion("worried");
      const fallbackMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        role: "bot",
        text: "미안해요. 지금은 답을 바로 이어가기 어려워요. 잠시 후 다시 이야기해 주세요.",
        emotion: "worried",
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setIsBotTyping(false);
    } finally {
      setIsBotTyping(false);
      enableWakeWord();
    }
  }

  return { messages, isBotTyping, botEmotion, sendMessage };
}

import { useState, useRef } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import { mockChatbotApi, type ChatbotApiParams, type ChatbotResponse } from "../../mocks/chatbotResponses";
import { type BotEmotion } from "../../constants/emotionMap";
import { useWakeWordStore } from "../../stores/wakeWordStore";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  emotion?: BotEmotion;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const TTS_VOICE = "nova"; // 여자 어린이 계열 목소리

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as unknown as number[]));
  }
  return btoa(binary);
}

async function playTTS(text: string, soundRef: React.RefObject<Audio.Sound | null>): Promise<void> {
  if (!OPENAI_API_KEY) return;

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "tts-1", voice: TTS_VOICE, input: text }),
    });

    if (!response.ok) return;

    let uri: string;
    let blobUrl: string | null = null;

    if (Platform.OS === "web") {
      const blob = await response.blob();
      blobUrl = URL.createObjectURL(blob);
      uri = blobUrl;
    } else {
      // expo-file-system 없이 data URI 방식으로 재생 (iOS/Android 모두 지원)
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
        if (blobUrl) URL.revokeObjectURL(blobUrl); // web 메모리 해제
      }
    });
  } catch {
    // TTS 실패 시 텍스트 표시만 유지
  }
}

function mapBotEmotion(rawEmotion: string): BotEmotion {
  const map: Record<string, BotEmotion> = {
    happy: "happy",
    worried: "worried",
    thinking: "thinking",
    greeting: "greeting",
    listening: "listening",
  };
  return map[rawEmotion] ?? "happy";
}

export function useMoaChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [botEmotion, setBotEmotion] = useState<BotEmotion>("greeting");
  const soundRef = useRef<Audio.Sound | null>(null);

  // FR-10: UC-01b 세션 중 호출어 감지 중단
  const { disable: disableWakeWord, enable: enableWakeWord } = useWakeWordStore();

  async function sendMessage(text: string, acousticMeta?: Partial<ChatbotApiParams["acoustic_meta"]>) {
    if (!text.trim()) return;

    disableWakeWord(); // UC-01b 시작
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setIsBotTyping(true);
    setBotEmotion("listening");

    try {
      const params: ChatbotApiParams = {
        message: text,
        acoustic_meta: { duration_ms: 0, pause_events: 0, ...acousticMeta },
      };

      const res: ChatbotResponse = await mockChatbotApi(params);
      const emotion = mapBotEmotion(res.data.emotion_controls.bot_emotion);
      setBotEmotion(emotion);

      const botMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        role: "bot",
        text: res.data.message,
        emotion,
      };
      setMessages((prev) => [...prev, botMsg]);

      await playTTS(res.data.message, soundRef);
    } catch {
      // 무시
    } finally {
      setIsBotTyping(false);
      enableWakeWord(); // UC-01b 종료
    }
  }

  return { messages, isBotTyping, botEmotion, sendMessage };
}

import { useRef, useState } from "react";
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
const TTS_VOICE = "nova";

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

      const res: ChatbotResponse = await mockChatbotApi(params);
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

      await playTTS(res.data.reply, soundRef);
    } catch {
      setBotEmotion("worried");
    } finally {
      setIsBotTyping(false);
      enableWakeWord();
    }
  }

  return { messages, isBotTyping, botEmotion, sendMessage };
}

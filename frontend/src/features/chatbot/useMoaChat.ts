import { useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";

import { type ChatbotApiParams, type ChatbotResponse, type NextAction } from "./chatbotTypes";
import { type BotEmotion } from "../../constants/emotionMap";
import { useWakeWordStore } from "../../stores/wakeWordStore";
import { useAuthStore } from "../../stores/authStore";
import { getToken } from "../../api/session";
import { getAuthApiMode } from "../../api/auth";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  emotion?: BotEmotion;
  turnId?: string;
  typingDelayMs?: number;
}


// const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://101.79.22.22";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const CHAT_API_MODE = process.env.EXPO_PUBLIC_CHAT_API_MODE === "prod" ? "prod" : "dev";



async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunk) as unknown as number[]));
  }

  return btoa(binary);
}

/** Shared MOA voice playback. Both chat replies and wake prompts use this server TTS path. */
export async function playTTS(
  text: string,
  soundRef: React.RefObject<Audio.Sound | null>,
  webAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onReady?: (durationMs: number | null) => void,
): Promise<void> {
  let didNotifyReady = false;
  const notifyReady = (durationMs: number | null) => {
    if (didNotifyReady) return;
    didNotifyReady = true;
    onReady?.(durationMs);
  };

  try {
    const token = await getToken();
    const hasRealSession = Boolean(token && !token.startsWith("mock-token-"));
    const response = await fetch(
      `${API_BASE_URL}${hasRealSession ? "/speech/tts" : "/speech/dev/tts"}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(hasRealSession ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      },
    );

    if (!response?.ok) {
      console.warn("[MOA_TTS_REQUEST_FAILED]", response?.status);
      notifyReady(null);
      return;
    }

    if (Platform.OS === "web") {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const webAudio = new window.Audio(blobUrl);
      const previousWebAudio = webAudioRef.current;
      previousWebAudio?.pause();
      previousWebAudio?.onended?.(new Event("ended"));
      webAudioRef.current = webAudio;
      webAudio.preload = "auto";

      await new Promise<void>((resolve) => {
        const finish = () => {
          webAudio.onloadedmetadata = null;
          webAudio.onerror = null;
          resolve();
        };
        webAudio.onloadedmetadata = () => {
          notifyReady(Number.isFinite(webAudio.duration) ? Math.round(webAudio.duration * 1000) : null);
          finish();
        };
        webAudio.onerror = finish;
      });

      await new Promise<void>((resolve) => {
        const finish = () => {
          webAudio.onended = null;
          webAudio.onerror = null;
          if (webAudioRef.current === webAudio) webAudioRef.current = null;
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        webAudio.onended = finish;
        webAudio.onerror = finish;
        void webAudio.play().catch((error) => {
          console.warn("[MOA_TTS_PLAY_FAILED]", error);
          finish();
        });
      });
      return;
    }

    const buffer = await response.arrayBuffer();
    const base64 = await arrayBufferToBase64(buffer);
    const uri = `data:audio/mpeg;base64,${base64}`;
    if (soundRef.current) await soundRef.current.unloadAsync().catch(() => undefined);
    const { sound, status } = await Audio.Sound.createAsync({ uri });
    (soundRef as React.MutableRefObject<Audio.Sound | null>).current = sound;
    notifyReady(status.isLoaded ? status.durationMillis ?? null : null);
    await new Promise<void>((resolve) => {
      const finish = () => {
        void sound.unloadAsync();
        (soundRef as React.MutableRefObject<Audio.Sound | null>).current = null;
        resolve();
      };

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) finish();
      });
      void sound.playAsync().catch(finish);
    });
  } catch (error) {
    console.warn("[MOA_TTS_ERROR]", error);
    notifyReady(null);
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
  const envelope = raw as Partial<ChatbotResponse> & { data?: Partial<ChatbotResponse["data"]> };
  const data = (envelope.data ?? raw) as Partial<ChatbotResponse["data"]>;
  const botEmotion = mapBotEmotion(String(data.bot_emotion ?? "default"));
  const nextAction = (["continue", "finish", "navigate", "urgent_alert"].includes(String(data.next_action))
    ? data.next_action
    : undefined) as NextAction | undefined;
  const shouldEnd = Boolean(data.should_end ?? nextAction === "finish");

  return {
    status: "success",
    data: {
      reply: typeof data.reply === "string" ? data.reply : "그랬군요. 제가 조금 더 들어드릴게요.",
      user_intent: typeof data.user_intent === "string" ? data.user_intent : "unknown",
      bot_emotion: botEmotion,
      next_action: nextAction ?? (shouldEnd ? "finish" : "continue"),
      chat_state: shouldEnd ? "completed" : "botSpeaking",
      should_end: shouldEnd,
      route: typeof data.route === "string" ? data.route : null,
      conversation_topic: typeof data.conversation_topic === "string" ? data.conversation_topic : null,
      question_index: typeof data.question_index === "number" ? data.question_index : 0,
      session_id: typeof data.session_id === "string" ? data.session_id : undefined,
    },
  } as ChatbotResponse;
}

function resolveChatSeniorId(): string | undefined {
  const auth = useAuthStore.getState();
  if (auth.role === "elder") return auth.userId ?? undefined;

  if (auth.role === "guardian") {
    return auth.links.find((link) => link.status === "ACTIVE")?.counterpartId;
  }

  return undefined;
}

async function callBackendDevChatbotApi(params: ChatbotApiParams): Promise<ChatbotResponse> {
  const response = await fetch(`${API_BASE_URL}/chat/dev`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("BACKEND_DEV_CHAT_REQUEST_FAILED");
  }

  return normalizeChatbotResponse(await response.json());
}

async function callBackendProdChatbotApi(params: ChatbotApiParams): Promise<ChatbotResponse> {
  const token = await getToken();
  const seniorId = params.senior_id ?? resolveChatSeniorId();

  if (!token || token.startsWith("mock-token-")) {
    throw new Error("BACKEND_PROD_CHAT_REQUIRES_AUTH_TOKEN");
  }
  if (!seniorId) {
    throw new Error("BACKEND_PROD_CHAT_REQUIRES_SENIOR_ID");
  }

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      senior_id: seniorId,
      session_id: params.session_id ?? null,
      message: params.message,
      history: params.history ?? [],
      current_topic: params.current_topic ?? null,
      question_index: params.question_index ?? 0,
    }),
  });

  if (!response.ok) {
    throw new Error("BACKEND_PROD_CHAT_REQUEST_FAILED");
  }

  return normalizeChatbotResponse(await response.json());
}

async function callChatbotApi(params: ChatbotApiParams): Promise<ChatbotResponse> {
  const isRealMode = getAuthApiMode() === "real";
  return isRealMode
    ? await callBackendProdChatbotApi(params)
    : await callBackendDevChatbotApi(params);
}

export function useMoaChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [botEmotion, setBotEmotion] = useState<BotEmotion>("default");
  const [nextAction, setNextAction] = useState<NextAction>("continue");
  const [route, setRoute] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const sendingMessageRef = useRef(false);
  const conversationTurnRef = useRef(0);
  const validSpeechDurationRef = useRef(0);
  const conversationTopicRef = useRef<string | null>(null);
  const questionIndexRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const { disable: disableWakeWord, enable: enableWakeWord } = useWakeWordStore();

  async function speakText(text: string) {
    if (!text.trim()) return;
    setIsBotSpeaking(true);
    try {
      await playTTS(text, soundRef, webAudioRef);
    } finally {
      setIsBotSpeaking(false);
    }
  }

  async function sendMessage(text: string, acousticMeta?: Partial<ChatbotApiParams["acoustic_meta"]>) {
    if (!text.trim() || sendingMessageRef.current) return;
    sendingMessageRef.current = true;

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
        history: messages.slice(-8).map((message) => ({
          role: message.role === "user" ? "user" : "assistant",
          content: message.text,
        })),
        current_topic: conversationTopicRef.current,
        question_index: questionIndexRef.current,
        senior_id: resolveChatSeniorId(),
        session_id: sessionIdRef.current,
        acoustic_meta: { duration_ms: 0, pause_events: 0, ...acousticMeta },
      };

      const res: ChatbotResponse = await callChatbotApi(params);
      setRoute(res.data.route ?? null);
      setNextAction(res.data.next_action ?? "continue");
      conversationTurnRef.current += 1;
      validSpeechDurationRef.current += params.acoustic_meta.duration_ms;
      conversationTopicRef.current = res.data.conversation_topic ?? conversationTopicRef.current;
      questionIndexRef.current = res.data.question_index ?? questionIndexRef.current;
      sessionIdRef.current = res.data.session_id ?? sessionIdRef.current;

      const emotion = mapBotEmotion(res.data.bot_emotion);
      setBotEmotion(emotion);

      setIsBotSpeaking(true);
      setIsBotTyping(false);

      const turnId = `turn_${Date.now()}`;
      const chunks = splitIntoSentenceChunks(res.data.reply);
      const typingDelayMs = 40;
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        setMessages((prev) => [
          ...prev,
          {
            id: `b_${turnId}_${index}`,
            turnId,
            role: "bot",
            text: chunk,
            emotion,
            typingDelayMs,
          },
        ]);
        await wait(0);
        await playTTS(chunk, soundRef, webAudioRef);
      }
      setIsBotSpeaking(false);
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
      setIsBotSpeaking(false);
    } finally {
      sendingMessageRef.current = false;
      setIsBotTyping(false);
      enableWakeWord();
    }
  }

  async function sendVoiceMessage(audioUri: string, durationMs: number) {
    if (sendingMessageRef.current) return;
    sendingMessageRef.current = true;
    disableWakeWord();
    setIsBotTyping(true);
    setBotEmotion("thinking");

    try {
      const token = await getToken();
      if (!token) throw new Error("AUTH_TOKEN_MISSING");

      // 1. STT (Transcribe) 호출
      const formData = new FormData();
      if (Platform.OS === "web") {
        const res = await fetch(audioUri);
        const blob = await res.blob();
        formData.append("file", blob, "recording.webm");
      } else {
        const filename = audioUri.split("/").pop() || "recording.m4a";
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1] : "m4a";
        const type = `audio/${ext}`;

        // @ts-ignore
        formData.append("file", {
          uri: Platform.OS === "ios" ? audioUri.replace("file://", "") : audioUri,
          name: filename,
          type,
        });
      }

      const transcribeResponse = await fetch(`${API_BASE_URL}/speech/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error("TRANSCRIBE_API_FAILED");
      }

      const transcribeRes = (await transcribeResponse.json()) as { text: string };
      const userMessageText = transcribeRes.text?.trim() ?? "";

      if (!userMessageText) {
        setIsBotTyping(false);
        enableWakeWord();
        sendingMessageRef.current = false;

        const silentMsg: ChatMessage = {
          id: `b_silent_${Date.now()}`,
          role: "bot",
          text: "목소리가 잘 들리지 않았어요. 다시 한번 차분하게 말씀해 주세요.",
          emotion: "worried",
        };
        setMessages((prev) => [...prev, silentMsg]);
        void speakText("목소리가 잘 들리지 않았어요. 다시 한번 말씀해 주세요.");
        return;
      }

      // 사용자 발화 말풍선 추가
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        text: userMessageText,
      };
      setMessages((prev) => [...prev, userMsg]);

      // 2. Chat API 호출 (기존 sendMessage 파이프라인 매개변수 적용)
      const params: ChatbotApiParams = {
        message: userMessageText,
        conversation_turn: conversationTurnRef.current,
        valid_speech_duration_ms: validSpeechDurationRef.current,
        history: messages.slice(-8).map((message) => ({
          role: message.role === "user" ? "user" : "assistant",
          content: message.text,
        })),
        current_topic: conversationTopicRef.current,
        question_index: questionIndexRef.current,
        senior_id: resolveChatSeniorId(),
        session_id: sessionIdRef.current,
        acoustic_meta: { duration_ms: durationMs, pause_events: 0 },
      };

      const res: ChatbotResponse = await callChatbotApi(params);
      setRoute(res.data.route ?? null);
      setNextAction(res.data.next_action ?? "continue");
      conversationTurnRef.current += 1;
      validSpeechDurationRef.current += durationMs;
      conversationTopicRef.current = res.data.conversation_topic ?? conversationTopicRef.current;
      questionIndexRef.current = res.data.question_index ?? questionIndexRef.current;
      sessionIdRef.current = res.data.session_id ?? sessionIdRef.current;

      const emotion = mapBotEmotion(res.data.bot_emotion);
      setBotEmotion(emotion);

      setIsBotSpeaking(true);
      setIsBotTyping(false);

      const turnId = `turn_${Date.now()}`;
      const chunks = splitIntoSentenceChunks(res.data.reply);
      const typingDelayMs = 40;

      // 3. 문장 단위로 분절 후 순차적 음성 합성(TTS) 및 재생 (Pipelining)
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        setMessages((prev) => [
          ...prev,
          {
            id: `b_${turnId}_${index}`,
            turnId,
            role: "bot",
            text: chunk,
            emotion,
            typingDelayMs,
          },
        ]);
        await wait(0);
        await playTTS(chunk, soundRef, webAudioRef);
      }
      setIsBotSpeaking(false);
    } catch (err) {
      console.warn("sendVoiceMessage failed:", err);
      setBotEmotion("worried");
      const fallbackMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        role: "bot",
        text: "미안해요. 지금은 답을 바로 이어가기 어려워요. 잠시 후 다시 이야기해 주세요.",
        emotion: "worried",
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      setIsBotTyping(false);
      setIsBotSpeaking(false);
    } finally {
      sendingMessageRef.current = false;
      setIsBotTyping(false);
      enableWakeWord();
    }
  }

  return {
    messages,
    isBotTyping,
    isBotSpeaking,
    botEmotion,
    nextAction,
    route,
    clearRoute: () => setRoute(null),
    sendMessage,
    sendVoiceMessage,
    speakText,
  };
}

export function splitIntoSentenceChunks(text: string): string[] {
  const chunks = text
    .split(/\r?\n+/)
    .flatMap((line) => line.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [line])
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return chunks.length > 0 ? chunks : [text.trim()].filter(Boolean);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { useRef, useState } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";

import { type ChatbotApiParams, type ChatbotResponse, type NextAction } from "./chatbotTypes";
import { type BotEmotion } from "../../constants/emotionMap";
import { useWakeWordStore } from "../../stores/wakeWordStore";
import { useAuthStore } from "../../stores/authStore";
import { useChatSessionStore } from "../../stores/chatSessionStore";
import { getToken } from "../../api/session";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  emotion?: BotEmotion;
  turnId?: string;
  typingDelayMs?: number;
  speechDone?: boolean;
}


const getApiBaseUrl = () => {
  const envVal = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envVal) return envVal;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return `http://${hostname}:8000`;
  }
  return "http://localhost:8000";
};

const API_BASE_URL = getApiBaseUrl();
const REAL_AUTH_REQUIRED_MESSAGE =
  "실제 로그인 토큰이 필요합니다. 토큰이 없거나 mock-token이 감지되어 요청을 중단했습니다.";

function isMockToken(token: string | null | undefined): token is string {
  return Boolean(token?.startsWith("mock-token-"));
}

async function getRequiredRealToken(context: string): Promise<string> {
  const token = await getToken();

  if (!token || isMockToken(token)) {
    console.warn(`[${context}] ${REAL_AUTH_REQUIRED_MESSAGE}`);
    throw new Error("REAL_AUTH_TOKEN_REQUIRED");
  }

  return token;
}
async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunk) as unknown as number[]));
  }

  return btoa(binary);
}

function nowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function logChatTiming(label: string, ms?: number) {
  if (typeof ms === "number") {
    console.log(`[CHAT_TIMING] ${label}=${Math.round(ms)}`);
    return;
  }

  console.log(`[CHAT_TIMING] ${label}`);
}

/** Shared MOA voice playback. Both chat replies and wake prompts use this server TTS path. */
export async function playTTS(
  text: string,
  soundRef: React.RefObject<Audio.Sound | null>,
  webAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onReady?: (durationMs: number | null) => void,
  timing?: { chatResponseReceiveAt?: number },
): Promise<void> {
  let didNotifyReady = false;
  const notifyReady = (durationMs: number | null) => {
    if (didNotifyReady) return;
    didNotifyReady = true;
    onReady?.(durationMs);
  };

  try {
    const token = await getRequiredRealToken("MOA_TTS_AUTH");
    const ttsRequestStartAt = nowMs();
    if (typeof timing?.chatResponseReceiveAt === "number") {
      logChatTiming("chat_response_receive_to_tts_request_start_ms", ttsRequestStartAt - timing.chatResponseReceiveAt);
    }
    logChatTiming("tts_request_start");
    const response = await fetch(
      `${API_BASE_URL}/speech/tts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
      let ttsReadyAt = ttsRequestStartAt;

      await new Promise<void>((resolve) => {
        const finish = () => {
          webAudio.onloadedmetadata = null;
          webAudio.onerror = null;
          resolve();
        };
        webAudio.onloadedmetadata = () => {
          ttsReadyAt = nowMs();
          logChatTiming("tts_request_start_to_tts_ready_ms", ttsReadyAt - ttsRequestStartAt);
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
        const audioPlayStartAt = nowMs();
        logChatTiming("tts_ready_to_audio_play_start_ms", audioPlayStartAt - ttsReadyAt);
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
    const ttsReadyAt = nowMs();
    logChatTiming("tts_request_start_to_tts_ready_ms", ttsReadyAt - ttsRequestStartAt);
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
      const audioPlayStartAt = nowMs();
      logChatTiming("tts_ready_to_audio_play_start_ms", audioPlayStartAt - ttsReadyAt);
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

const sessionStartRequests = new Map<string, Promise<string>>();

function getChatSessionOwnerId(): string {
  const userId = useAuthStore.getState().userId;
  if (!userId) throw new Error("CHAT_SESSION_REQUIRES_USER_ID");
  return userId;
}

async function getOrStartChatSession(): Promise<string> {
  const userId = getChatSessionOwnerId();
  const store = useChatSessionStore.getState();
  const activeSessionId = store.getActiveSession(userId);
  if (activeSessionId) return activeSessionId;

  const pending = sessionStartRequests.get(userId);
  if (pending) return pending;

  const request = (async () => {
    const token = await getRequiredRealToken("MOA_CHAT_SESSION_START_AUTH");
    const response = await fetch(`${API_BASE_URL}/chat/session/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error("CHAT_SESSION_START_FAILED");

    const body = (await response.json()) as { session_id?: string };
    if (!body.session_id) throw new Error("CHAT_SESSION_START_ID_MISSING");

    useChatSessionStore.getState().setActiveSession(userId, body.session_id);
    return body.session_id;
  })().finally(() => {
    sessionStartRequests.delete(userId);
  });

  sessionStartRequests.set(userId, request);
  return request;
}

async function callBackendProdChatbotApi(
  params: ChatbotApiParams,
  timing?: { sttSuccessAt?: number; chatResponseReceiveAt?: number },
): Promise<ChatbotResponse> {
  const token = await getRequiredRealToken("MOA_CHAT_AUTH");
  const seniorId = params.senior_id ?? resolveChatSeniorId();

  console.log(`[callBackendProdChatbotApi] 🚀 /chat 호출 시도. senior_id: ${seniorId}, session_id: ${params.session_id}, message: '${params.message}', history_len: ${params.history?.length || 0}`);

  if (!seniorId) {
    console.warn("[callBackendProdChatbotApi] ⚠️ seniorId 없음");
    throw new Error("BACKEND_PROD_CHAT_REQUIRES_SENIOR_ID");
  }

  const requestBody = {
    senior_id: seniorId,
    session_id: params.session_id ?? null,
    message: params.message,
    history: params.history ?? [],
    current_topic: params.current_topic ?? null,
    question_index: params.question_index ?? 0,
  };

  const chatRequestStartAt = nowMs();
  if (typeof timing?.sttSuccessAt === "number") {
    logChatTiming("stt_success_to_chat_request_start_ms", chatRequestStartAt - timing.sttSuccessAt);
  }
  logChatTiming("chat_request_start");
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });
  const chatResponseReceiveAt = nowMs();
  timing && (timing.chatResponseReceiveAt = chatResponseReceiveAt);
  logChatTiming("chat_request_start_to_chat_response_receive_ms", chatResponseReceiveAt - chatRequestStartAt);

  if (!response.ok) {
    const responseBodyText = await response.text();
    let responseBodyForLog: unknown = responseBodyText;

    if (responseBodyText) {
      try {
        responseBodyForLog = JSON.parse(responseBodyText);
      } catch {
        responseBodyForLog = responseBodyText;
      }
    }

    console.error("[callBackendProdChatbotApi] ❌ /chat 요청 실패", {
      status: response.status,
      statusText: response.statusText,
      responseBody: responseBodyForLog,
      rawResponseBody: responseBodyText,
      request: {
        url: `${API_BASE_URL}/chat`,
        method: "POST",
        hasAuthorizationToken: Boolean(token),
        body: {
          senior_id: requestBody.senior_id,
          session_id: requestBody.session_id,
          message_length: requestBody.message.length,
          history_len: requestBody.history.length,
          current_topic: requestBody.current_topic,
          question_index: requestBody.question_index,
        },
      },
    });

    throw new Error(
      `BACKEND_PROD_CHAT_REQUEST_FAILED status=${response.status} body=${responseBodyText || "<empty>"}`,
    );
  }

  const rawJson = await response.json();
  console.log("[callBackendProdChatbotApi] 🟢 성공 응답 rawJson:", JSON.stringify(rawJson));
  return normalizeChatbotResponse(rawJson);
}

async function callChatbotApi(
  params: ChatbotApiParams,
  timing?: { sttSuccessAt?: number; chatResponseReceiveAt?: number },
): Promise<ChatbotResponse> {
  try {
    return await callBackendProdChatbotApi(params, timing);
  } catch (error) {
    console.warn("[MOA_CHATBOT_API_ERROR] 운영 /chat 요청 실패. 개발용 API로 우회하지 않습니다.", error);
    throw error;
  }
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
  const endingSessionRef = useRef<Promise<void> | null>(null);
  const { disable: disableWakeWord, enable: enableWakeWord } = useWakeWordStore();

  function resetChatSession() {
    sendingMessageRef.current = false;
    conversationTurnRef.current = 0;
    validSpeechDurationRef.current = 0;
    conversationTopicRef.current = null;
    questionIndexRef.current = 0;
    setMessages([]);
    setIsBotTyping(false);
    setIsBotSpeaking(false);
    setBotEmotion("default");
    setNextAction("continue");
    setRoute(null);
  }

  async function speakText(text: string, onReady?: () => void) {
    if (!text.trim()) return;
    setIsBotSpeaking(true);
    try {
      await playTTS(text, soundRef, webAudioRef, () => onReady?.());
    } finally {
      setIsBotSpeaking(false);
    }
  }

  function endConversationSession(): Promise<void> {
    if (endingSessionRef.current) return endingSessionRef.current;

    const userId = useAuthStore.getState().userId;
    if (!userId) return Promise.resolve();

    const sessionId = useChatSessionStore.getState().getActiveSession(userId);
    if (!sessionId) return Promise.resolve();

    const request = (async () => {
      try {
        const token = await getToken();
        if (!token || token.startsWith("mock-token-")) return;

        const response = await fetch(`${API_BASE_URL}/chat/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!response.ok) throw new Error("CHAT_SESSION_END_FAILED");
        useChatSessionStore.getState().clearActiveSession(userId, sessionId);
      } catch (error) {
        // 종료 시각 저장 실패가 결과 화면 진입을 막지는 않는다.
        console.warn("[CHAT_SESSION_END_FAILED]", error);
      }
    })().finally(() => {
      endingSessionRef.current = null;
    });

    endingSessionRef.current = request;
    return request;
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
      const activeSessionId = await getOrStartChatSession();
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
        session_id: activeSessionId,
        acoustic_meta: { duration_ms: 0, pause_events: 0, ...acousticMeta },
      };

      const res: ChatbotResponse = await callChatbotApi(params);
      setRoute(res.data.route ?? null);
      setNextAction(res.data.next_action ?? "continue");
      conversationTurnRef.current += 1;
      validSpeechDurationRef.current += params.acoustic_meta.duration_ms;
      conversationTopicRef.current = res.data.conversation_topic ?? conversationTopicRef.current;
      questionIndexRef.current = res.data.question_index ?? questionIndexRef.current;
      if (res.data.session_id !== activeSessionId) {
        throw new Error("CHAT_SESSION_ID_MISMATCH");
      }

      const emotion = mapBotEmotion(res.data.bot_emotion);
      setBotEmotion(emotion);

      setIsBotSpeaking(true);
      setIsBotTyping(false);

      const turnId = `turn_${Date.now()}`;
      const chunks = splitIntoSentenceChunks(res.data.reply);
      const typingDelayMs = 40;
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const messageId = `b_${turnId}_${index}`;
        let didShowMessage = false;
        const showMessage = () => {
          if (didShowMessage) return;
          didShowMessage = true;
          setMessages((prev) => [
            ...prev,
            {
              id: messageId,
              turnId,
              role: "bot",
              text: chunk,
              emotion,
              typingDelayMs,
              speechDone: false,
            },
          ]);
        };

        showMessage();
        await playTTS(chunk, soundRef, webAudioRef);
        showMessage();
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? { ...message, speechDone: true }
              : message,
          ),
        );
      }
      setIsBotSpeaking(false);
    } catch (err: any) {
      console.error("[sendMessage] ❌ 예외 발생 상세 로그:", err);
      setBotEmotion("worried");
      const fallbackMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        role: "bot",
        text: `미안해요. 지금은 답을 바로 이어가기 어려워요. [오류: ${err?.message || String(err)}]`,
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

  async function sendVoiceMessage(
    audioUri: string,
    durationMs: number,
    timing?: { recordingEndAt?: number },
  ) {
    if (sendingMessageRef.current) return;
    sendingMessageRef.current = true;
    disableWakeWord();
    setIsBotTyping(true);
    setBotEmotion("thinking");

    console.log("[sendVoiceMessage] >>> 시작. audioUri:", audioUri, "durationMs:", durationMs);

    try {
      const token = await getRequiredRealToken("MOA_TRANSCRIBE_AUTH");

      // 1. STT (Transcribe) 호출
      console.log("[sendVoiceMessage] 1. STT 요청 시작 (POST /speech/transcribe)");
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

      const sttRequestStartAt = nowMs();
      if (typeof timing?.recordingEndAt === "number") {
        logChatTiming("recording_end_to_stt_request_start_ms", sttRequestStartAt - timing.recordingEndAt);
      }
      logChatTiming("stt_request_start");
      const transcribeResponse = await fetch(`${API_BASE_URL}/speech/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
      });

      if (!transcribeResponse.ok) {
        console.warn("[sendVoiceMessage] 에러: STT API 요청 실패 status =", transcribeResponse.status);
        throw new Error("TRANSCRIBE_API_FAILED");
      }

      const transcribeRes = (await transcribeResponse.json()) as { text: string };
      const sttSuccessAt = nowMs();
      logChatTiming("stt_request_start_to_stt_success_ms", sttSuccessAt - sttRequestStartAt);
      const userMessageText = transcribeRes.text?.trim() ?? "";
      console.log("[sendVoiceMessage] 1. STT 요청 성공. 인식된 텍스트:", userMessageText);

      // 테스트 편의상 빈 텍스트(무음/단발음) 시 "안녕하세요"로 폴백하여 강제 테스트
      const finalUserText = userMessageText || "안녕하세요";


      if (!userMessageText) {
        console.log("[sendVoiceMessage] 경고: 인식된 음성 텍스트가 비어 있음 (무음 감지 처리)");
        setIsBotTyping(false);
        enableWakeWord();
        sendingMessageRef.current = false;

        const silentMsg: ChatMessage = {
          id: `b_silent_${Date.now()}`,
          role: "bot",
          text: "목소리가 잘 들리지 않았어요. 다시 한번 차분하게 말씀해 주세요.",
          emotion: "worried",
        };
        let didShowMessage = false;
        const showMessage = () => {
          if (didShowMessage) return;
          didShowMessage = true;
          setMessages((prev) => [...prev, silentMsg]);
        };
        void speakText("목소리가 잘 들리지 않았어요. 다시 한번 말씀해 주세요.", showMessage).finally(showMessage);
        return;
      }


      // 사용자 발화 말풍선 추가
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        text: finalUserText,
      };
      setMessages((prev) => [...prev, userMsg]);

      // 2. Chat API 호출 (기존 sendMessage 파이프라인 매개변수 적용)
      const activeSessionId = await getOrStartChatSession();
      const params: ChatbotApiParams = {
        message: finalUserText,
        conversation_turn: conversationTurnRef.current,
        valid_speech_duration_ms: validSpeechDurationRef.current,
        history: messages.slice(-8).map((message) => ({
          role: message.role === "user" ? "user" : "assistant",
          content: message.text,
        })),
        current_topic: conversationTopicRef.current,
        question_index: questionIndexRef.current,
        senior_id: resolveChatSeniorId(),
        session_id: activeSessionId,
        acoustic_meta: { duration_ms: durationMs, pause_events: 0 },
      };

      console.log("[sendVoiceMessage] 2. 챗봇 API 요청 시작 (POST /chat) params:", JSON.stringify(params));
      const chatTiming = { sttSuccessAt, chatResponseReceiveAt: undefined as number | undefined };
      const res: ChatbotResponse = await callChatbotApi(params, chatTiming);
      console.log("[sendVoiceMessage] 2. 챗봇 API 요청 성공. 응답 data:", JSON.stringify(res.data));

      setRoute(res.data.route ?? null);
      setNextAction(res.data.next_action ?? "continue");
      conversationTurnRef.current += 1;
      validSpeechDurationRef.current += durationMs;
      conversationTopicRef.current = res.data.conversation_topic ?? conversationTopicRef.current;
      questionIndexRef.current = res.data.question_index ?? questionIndexRef.current;
      if (res.data.session_id !== activeSessionId) {
        throw new Error("CHAT_SESSION_ID_MISMATCH");
      }

      const emotion = mapBotEmotion(res.data.bot_emotion);
      setBotEmotion(emotion);

      setIsBotSpeaking(true);
      setIsBotTyping(false);

      const turnId = `turn_${Date.now()}`;
      const chunks = splitIntoSentenceChunks(res.data.reply);
      const typingDelayMs = 40;

      console.log("[sendVoiceMessage] 3. TTS 합성 및 문장별 순차 재생 시작. 문장 개수:", chunks.length);

      // 3. 문장 단위로 분절 후 순차적 음성 합성(TTS) 및 재생 (Pipelining)
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        console.log(`[sendVoiceMessage] 3. TTS 재생 시도 [${index + 1}/${chunks.length}]: "${chunk}"`);
        const messageId = `b_${turnId}_${index}`;
        let didShowMessage = false;
        const showMessage = () => {
          if (didShowMessage) return;
          didShowMessage = true;
          setMessages((prev) => [
            ...prev,
            {
              id: messageId,
              turnId,
              role: "bot",
              text: chunk,
              emotion,
              typingDelayMs,
              speechDone: false,
            },
          ]);
        };

        showMessage();
        await playTTS(
          chunk,
          soundRef,
          webAudioRef,
          undefined,
          index === 0 ? { chatResponseReceiveAt: chatTiming.chatResponseReceiveAt } : undefined,
        );
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? { ...message, speechDone: true }
              : message,
          ),
        );
        console.log(`[sendVoiceMessage] 3. TTS 재생 완료 [${index + 1}/${chunks.length}]`);
      }
      setIsBotSpeaking(false);
      console.log("[sendVoiceMessage] <<< 모든 프로세스 정상 종료");
    } catch (err: any) {
      console.error("[sendVoiceMessage] ❌ 예외 발생 상세 로그:", err);
      setBotEmotion("worried");
      const fallbackMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        role: "bot",
        text: `미안해요. 지금은 답을 바로 이어가기 어려워요. [오류: ${err?.message || String(err)}]`,
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
    resetChatSession,
    sendMessage,
    sendVoiceMessage,
    speakText,
    endConversationSession,
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
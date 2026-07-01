import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Share,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Clock,
  Share2,
  ChevronRight,
  MessageCircle,
  Bell,
} from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { CharacterPlayer, type CharacterMood } from "./CharacterPlayer";
import { ResultComplete } from "./ResultComplete";
import { MicIcon } from "./icons/MicIcon";
import { Waveform } from "./Waveform";
import { useAuthStore } from "../stores/authStore";
import { useInteractionStore } from "../stores/interactionStore";
import { useWakeWordStore } from "../stores/wakeWordStore";
import * as authApi from "../api/auth";
import {
  splitIntoSentenceChunks,
  useMoaChat,
} from "../features/chatbot/useMoaChat";
import { useRecorder } from "../features/record/useRecorder";
import { detectVoiceCommand } from "../features/chatbot/wakeWord";
import { analyzeVoice } from "../api/record";

type ChatState =
  | "idle"
  | "waitingCommand"
  | "botSpeaking"
  | "listening"
  | "thinking"
  | "completed"
  | "error";

type VoiceMode = "wake" | "waitingCommand" | "conversation" | "sustainedVowel" | null;
type ChatFlowStep =
  | "IDLE"
  | "GREETING"
  | "FIRST_FREE_TALK"
  | "VOICE_CHECK_INTRO"
  | "SUSTAINED_VOWEL_RECORDING"
  | "VOICE_CHECK_DONE"
  | "NORMAL_CHAT";
type VoiceSampleType = "free_speech_intro" | "sustained_vowel" | "normal_chat";

const SHOW_STT_DEBUG =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_STT_DEBUG === "true";

const RETURN_GREETING_COOLDOWN_MS = 40 * 1000;
const SUSTAINED_VOWEL_MIN_MS = 2_500;
const SUSTAINED_VOWEL_MAX_MS = 5_000;
const BUBBLE_SENTENCE_PAUSE_MS = 120;
const BUBBLE_TEXT_MAX_CHARS = 34;

const VOICE_CHECK_PROMPTS = [
  "오늘 목소리 상태를 잠깐 확인해볼게요. '아' 소리를 3초 정도 이어서 말씀해주세요.",
  "목소리가 잘 들리는지 확인해볼게요. 편하게 '아' 소리를 이어서 말씀해주세요.",
  "마이크도 잘 들리는지 같이 확인할게요. '아' 소리를 잠깐 이어서 말씀해주세요.",
  "오늘도 목소리를 잠깐 확인해볼게요. 편하게 '아' 소리를 이어서 말씀해주세요.",
];

const VOICE_CHECK_DONE_PROMPTS = [
  "잘하셨어요! 목소리 확인이 끝났어요.",
  "감사해요. 오늘 목소리도 잘 확인했어요.",
  "좋아요! 이제 편하게 이야기 이어가 볼까요?",
  "아주 잘하셨어요. 이제 오늘 이야기를 더 들려주세요.",
];

const NORMAL_CHAT_START_PROMPTS = [
  "오늘 점심은 맛있게 드셨어요? 어떤 반찬이랑 드셨는지 궁금해요.",
  "오늘 아침이나 낮에 가볍게 동네 산책은 다녀오셨어요?",
];

type BotEmotion =
  | "default"
  | "listening"
  | "thinking"
  | "happy"
  | "worried"
  | "clapping";

function botEmotionToMood(emotion: BotEmotion): CharacterMood {
  return emotion === "default" ? "idle" : emotion;
}

function chatStateToMood(
  state: ChatState,
  botEmotion: BotEmotion,
): CharacterMood {
  switch (state) {
    case "idle":
      return "idle";
    case "listening":
    case "waitingCommand":
      return "listening";
    case "thinking":
      return "thinking";
    case "botSpeaking":
      return botEmotionToMood(botEmotion);
    case "completed":
      return "clapping";
    case "error":
      return "worried";
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chatTimingNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function splitLongBubbleText(text: string): string[] {
  if (text.length <= BUBBLE_TEXT_MAX_CHARS) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > BUBBLE_TEXT_MAX_CHARS) {
    const candidate = remaining.slice(0, BUBBLE_TEXT_MAX_CHARS + 1);
    const spaceIndex = candidate.lastIndexOf(" ");
    const splitIndex =
      spaceIndex > Math.floor(BUBBLE_TEXT_MAX_CHARS * 0.45)
        ? spaceIndex
        : BUBBLE_TEXT_MAX_CHARS;

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

function splitBubbleDisplayChunks(text: string): string[] {
  return splitIntoSentenceChunks(text).flatMap(splitLongBubbleText);
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function getTimeBasedGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    return "좋은 아침이에요. 어제 주무실 때 춥지는 않으셨어요?";
  }

  if (hour >= 11 && hour < 15) {
    return "점심 식사는 맛있게 드셨어요?";
  }

  if (hour >= 15 && hour < 18) {
    return "오늘 낮에 따뜻한 물 한 잔 드시며 편히 쉬셨나요?";
  }

  if (hour >= 18 && hour < 22) {
    return "오늘 저녁은 든든하게 챙겨드셨나요?";
  }

  return "늦은 시간이네요. 오늘 잠자리는 편안하신가요?";
}

function getTimeBasedVoiceCheckGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    return "안녕히 주무셨어요?";
  }

  if (hour >= 11 && hour < 15) {
    return "점심은 잘 드셨어요?";
  }

  if (hour >= 15 && hour < 18) {
    return "오후도 잘 보내고 계셨어요?";
  }

  if (hour >= 18 && hour < 22) {
    return "오늘도 수고하셨어요.";
  }

  return "늦은 시간이네요.";
}

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

// 상단 헤더용 현재 날짜 포맷 (예: "6월 30일 (월)").
function formatHeaderDate(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS_KO[date.getDay()]})`;
}

export default function ChatbotMain() {
  const router = useRouter();

  const {
    fromIntro,
    voiceText,
    voiceDurationMs,
    medicationReminderId,
    localMedicationId,
    medicationPrompt,
  } = useLocalSearchParams<{
    fromIntro?: string;
    voiceText?: string;
    voiceDurationMs?: string;
    medicationReminderId?: string;
    localMedicationId?: string;
    medicationPrompt?: string;
  }>();

  const startedFromIntro = String(fromIntro).toLowerCase() === "true";
  const insets = useSafeAreaInsets();

  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const links = useAuthStore((s) => s.links);
  const wakePrompt = useWakeWordStore((s) => s.wakePrompt);
  const clearWakePrompt = useWakeWordStore((s) => s.clearWakePrompt);

  const hasStoredUserInteracted = useInteractionStore(
    (s) => s.hasUserInteracted,
  );
  const hasUserInteracted = fromIntro === "true" || hasStoredUserInteracted;

  const { height: windowHeight } = useWindowDimensions();

  const [chatState, setChatState] = useState<ChatState>("idle");
  const [botEmotion, setBotEmotion] = useState<BotEmotion>("default");
  const [botReply, setBotReply] = useState<string>(getTimeBasedGreeting());
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [lastRecognizedText, setLastRecognizedText] = useState("");
  const [showConversationResult, setShowConversationResult] = useState(false);
  const [replyTypingVersion, setReplyTypingVersion] = useState(0);
  const [flowStep, setFlowStep] = useState<ChatFlowStep>("IDLE");
  const [now, setNow] = useState<Date>(() => new Date());

  const {
    messages,
    isBotTyping,
    isBotSpeaking,
    botEmotion: liveBotEmotion,
    route,
    clearRoute,
    sendMessage,
    sendVoiceMessage,
    speakText,
    endConversationSession,
    nextAction,
    resetChatSession,
  } = useMoaChat();

  const {
    state: recorderState,
    transcript,
    durationMs,
    permissionDenied,
    error: recorderError,
    noSpeechDetected,
    audioUri,
    start: startRecording,
    stop: stopRecording,
    reset: resetRecorder,
    clearAudio,
  } = useRecorder({
    autoStopOnSilence: true,
    keepAudio: true,
    skipSTT: true,
  });

  const turnCountRef = useRef(0);
  const conversationRunningRef = useRef(false);
  const conversationActiveRef = useRef(false);
  const submittingTranscriptRef = useRef(false);
  const lastBotMessageIdRef = useRef<string | null>(null);
  const activeBotTurnIdRef = useRef<string | null>(null);
  const streamedReplyRef = useRef("");
  const displayedReplyRef = useRef("");
  const typewriterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typewriterDelayRef = useRef(48);
  const bubbleDisplaySequenceRef = useRef(0);
  const bubbleDisplayInProgressRef = useRef(false);
  const botLineSpeakingRef = useRef(false);
  const isBotSpeakingRef = useRef(false);
  const isBotTypingRef = useRef(false);
  const voiceModeRef = useRef<VoiceMode>(null);
  const activeRecordingModeRef = useRef<VoiceMode>(null);
  const wakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVoiceTextRef = useRef<string | null>(null);
  const silenceRetryRef = useRef(0);
  const lastPromptRef = useRef("");
  const greetingInProgressRef = useRef(false);
  const autoStartedRef = useRef(false);
  const lastAutoGreetingRef = useRef(0);
  const medicationReminderIdRef = useRef<string | null>(null);
  const localMedicationIdRef = useRef<string | null>(null);
  const medicationAutoStartedRef = useRef<string | null>(null);
  const audioUriRef = useRef<string | null>(null);
  const recorderStateRef = useRef(recorderState);
  const finishActionPendingRef = useRef(false);
  const showConversationResultRef = useRef(false);
  const flowStepRef = useRef<ChatFlowStep>("IDLE");
  const sustainedRetryRef = useRef(0);
  const sustainedStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voiceAnalysisTargetSeniorId =
    role === "elder"
      ? user?.id
      : links.find((link) => link.status === "ACTIVE" && link.relation === "elder")
          ?.counterpartId;
  const mood = chatStateToMood(chatState, botEmotion);
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const speechBubbleText =
    chatState === "thinking"
      ? latestUserMessage
        ? "말씀을 이해하고 있어요..."
        : "생각하고 있어요..."
      : botReply;
  const recordHref =
    role === "guardian" ? "/(guardian)/record" : "/(elder)/record";
  const resultHref =
    role === "guardian" ? "/(guardian)/report" : "/(elder)/history";
  const healthHref = role === "guardian" ? "/(guardian)/report" : "/(elder)/health";
  const settingsHref =
    role === "guardian" ? "/(guardian)/settings" : "/(elder)/settings";
  const familyHref = role === "guardian" ? "/(guardian)/family" : settingsHref;

  useEffect(() => {
    audioUriRef.current = audioUri ?? null;
  }, [audioUri]);

  useEffect(() => {
    recorderStateRef.current = recorderState;
  }, [recorderState]);

  useEffect(() => {
    flowStepRef.current = flowStep;
  }, [flowStep]);

  useEffect(() => {
    isBotSpeakingRef.current = isBotSpeaking;
  }, [isBotSpeaking]);

  useEffect(() => {
    isBotTypingRef.current = isBotTyping;
  }, [isBotTyping]);

  // 상단 헤더의 날짜를 현재 날짜로 표시한다. 날짜가 바뀌는 자정 경계에서만 갱신하고,
  // 같은 날이면 setNow 가 같은 참조를 반환해 불필요한 리렌더를 피한다.
  useEffect(() => {
    const id = setInterval(() => {
      setNow((prev) => {
        const next = new Date();
        return next.toDateString() === prev.toDateString() ? prev : next;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!route) return;

    clearRoute();

    if (showConversationResultRef.current || nextAction === "finish") {
      console.log("[ROUTE_SKIP_RESULT_VISIBLE]", { route, nextAction });
      return;
    }

    switch (route) {
      case "/record":
        router.push(recordHref);
        break;
      case "/health":
        router.push(healthHref);
        break;
      case "/settings":
        router.push(settingsHref);
        break;
      case "/family":
        router.push(familyHref);
        break;
      case "/history":
      case "/report":
      default:
        router.push(resultHref);
        break;
    }
  }, [
    clearRoute,
    familyHref,
    healthHref,
    nextAction,
    recordHref,
    resultHref,
    route,
    router,
    settingsHref,
  ]);

  useEffect(() => {
    if (!wakePrompt) return;

    void speakBotLine(wakePrompt, "happy");
    clearWakePrompt();
  }, [clearWakePrompt, wakePrompt]);

  function streamReplyCharacters(onComplete?: () => void) {
    if (typewriterTimerRef.current) return;

    const writeNextCharacter = () => {
      if (displayedReplyRef.current.length >= streamedReplyRef.current.length) {
        typewriterTimerRef.current = null;
        setReplyTypingVersion((version) => version + 1);
        onComplete?.();
        return;
      }

      displayedReplyRef.current = streamedReplyRef.current.slice(
        0,
        displayedReplyRef.current.length + 1,
      );

      setBotReply(displayedReplyRef.current);

      typewriterTimerRef.current = setTimeout(
        writeNextCharacter,
        typewriterDelayRef.current,
      );
    };

    writeNextCharacter();
  }

  function typeBubbleSentence(text: string): Promise<void> {
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    streamedReplyRef.current = text;
    displayedReplyRef.current = "";
    setBotReply("");

    return new Promise((resolve) => {
      streamReplyCharacters(resolve);
    });
  }

  async function displayBubbleSentences(text: string, emotion: BotEmotion) {
    const sequenceId = bubbleDisplaySequenceRef.current + 1;
    bubbleDisplaySequenceRef.current = sequenceId;
    bubbleDisplayInProgressRef.current = true;

    const chunks = splitBubbleDisplayChunks(text);

    try {
      setBotEmotion(emotion);

      for (let index = 0; index < chunks.length; index += 1) {
        if (bubbleDisplaySequenceRef.current !== sequenceId) return;

        await typeBubbleSentence(chunks[index]);

        if (
          index < chunks.length - 1 &&
          bubbleDisplaySequenceRef.current === sequenceId
        ) {
          await wait(BUBBLE_SENTENCE_PAUSE_MS);
        }
      }
    } finally {
      if (bubbleDisplaySequenceRef.current === sequenceId) {
        bubbleDisplayInProgressRef.current = false;
        setReplyTypingVersion((version) => version + 1);
      }
    }
  }

  function routeVoiceCommand(command: ReturnType<typeof detectVoiceCommand>) {
    if (command === "record") {
      router.push(recordHref);
      return true;
    }

    if (command === "history") {
      router.push(resultHref);
      return true;
    }

    if (command === "result") {
      router.push(resultHref);
      return true;
    }

    return false;
  }

  function isCapturePending() {
    return (
      activeRecordingModeRef.current === "conversation" ||
      activeRecordingModeRef.current === "sustainedVowel" ||
      recorderStateRef.current === "recording" ||
      recorderStateRef.current === "processing" ||
      submittingTranscriptRef.current
    );
  }

  function shouldPreserveConversationActive() {
    return (
      conversationActiveRef.current ||
      conversationRunningRef.current ||
      greetingInProgressRef.current ||
      isCapturePending()
    );
  }

  function setConversationResultVisible(visible: boolean) {
    showConversationResultRef.current = visible;
    setShowConversationResult(visible);
  }

  function resetConversationSession(options: { blockAutoRestart?: boolean } = {}) {
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
    if (sustainedStopTimeoutRef.current) {
      clearTimeout(sustainedStopTimeoutRef.current);
      sustainedStopTimeoutRef.current = null;
    }
    if (wakeTimeoutRef.current) {
      clearTimeout(wakeTimeoutRef.current);
      wakeTimeoutRef.current = null;
    }

    resetChatSession();
    resetRecorder();

    turnCountRef.current = 0;
    conversationRunningRef.current = false;
    conversationActiveRef.current = false;
    submittingTranscriptRef.current = false;
    lastBotMessageIdRef.current = null;
    activeBotTurnIdRef.current = null;
    streamedReplyRef.current = "";
    displayedReplyRef.current = "";
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    lastVoiceTextRef.current = null;
    silenceRetryRef.current = 0;
    lastPromptRef.current = "";
    greetingInProgressRef.current = false;
    finishActionPendingRef.current = false;
    flowStepRef.current = "IDLE";
    sustainedRetryRef.current = 0;
    bubbleDisplaySequenceRef.current += 1;
    bubbleDisplayInProgressRef.current = false;
    botLineSpeakingRef.current = false;

    if (options.blockAutoRestart) {
      autoStartedRef.current = false;
      lastAutoGreetingRef.current = 0;
    }

    setConversationResultVisible(false);
    setIsConversationActive(false);
    setChatState("idle");
    setBotEmotion("default");
    setBotReply(getTimeBasedGreeting());
    setFlowStep("IDLE");
  }

  async function speakSingleBotLine(text: string, emotion: BotEmotion = "happy") {
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    lastPromptRef.current = text;
    typewriterDelayRef.current = 22;
    botLineSpeakingRef.current = true;

    setChatState("botSpeaking");

    try {
      const chunks = splitBubbleDisplayChunks(text);

      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        let didStartBubble = false;
        let bubblePromise: Promise<void> = Promise.resolve();
        const startBubble = () => {
          if (didStartBubble) return;
          didStartBubble = true;
          bubblePromise = displayBubbleSentences(chunk, emotion);
        };

        await speakText(chunk, startBubble);
        startBubble();
        await bubblePromise;
        await wait(100);

        if (index < chunks.length - 1) {
          await wait(BUBBLE_SENTENCE_PAUSE_MS);
        }
      }
    } finally {
      botLineSpeakingRef.current = false;
      isBotSpeakingRef.current = false;
    }
  }

  async function speakBotLine(text: string, emotion: BotEmotion = "happy") {
    // TTS는 한 호흡으로 재생하되, 화면 말풍선은 문장 단위로 순차 표시한다.
    await speakSingleBotLine(text, emotion);
  }

  function handleChatTurn(text: string, turnDurationMs: number) {
    console.log("[CHAT_TURN]", text, turnDurationMs);
    const command = detectVoiceCommand(text);

    if (routeVoiceCommand(command)) {
      voiceModeRef.current = null;
      activeRecordingModeRef.current = null;
      finishActionPendingRef.current = false;
      conversationActiveRef.current = false;
      setIsConversationActive(false);
      setChatState("idle");
      return;
    }

    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    finishActionPendingRef.current = false;
    silenceRetryRef.current = 0;
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    setChatState("thinking");

    console.log("[SEND_MESSAGE_START]");
    void sendMessage(text, { duration_ms: turnDurationMs });
    console.log("[SEND_MESSAGE_CALLED]");
  }

  useEffect(() => {
    const text = voiceText?.trim();

    if (!text || text === lastVoiceTextRef.current) return;

    lastVoiceTextRef.current = text;
    handleChatTurn(text, Number(voiceDurationMs) || 0);
  }, [voiceDurationMs, voiceText]);

  useEffect(
    () => () => {
      if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
      bubbleDisplaySequenceRef.current += 1;
      bubbleDisplayInProgressRef.current = false;
      botLineSpeakingRef.current = false;
      if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
      if (sustainedStopTimeoutRef.current) {
        clearTimeout(sustainedStopTimeoutRef.current);
      }
    },
    [],
  );

  async function handleMedicationReminderAnswer(text: string) {
    const localMedicationId = localMedicationIdRef.current;
    const reminderId = medicationReminderIdRef.current;

    if (!reminderId && !localMedicationId) return;

    greetingInProgressRef.current = true;
    setChatState("thinking");

    if (localMedicationId) {
      localMedicationIdRef.current = null;
      await speakBotLine(
        "알려주셔서 고마워요. 복약 기록 저장은 하지 않고, 알림만 도와드릴게요.",
        "happy",
      );
      greetingInProgressRef.current = false;

      if (conversationActiveRef.current) {
        beginConversationListening();
      }

      return;
    }

    if (!reminderId) return;

    medicationReminderIdRef.current = null;
    await speakBotLine(
      "알려주셔서 고마워요. 복약 기록 저장은 하지 않고, 알림만 도와드릴게요.",
      "happy",
    );
    greetingInProgressRef.current = false;

    if (conversationActiveRef.current) {
      beginConversationListening();
    }
  }

  async function saveChatbotVoiceSample(
    audioUriToSave: string | null,
    sampleType: VoiceSampleType,
    sampleStatus: "ok" | "too_short" | "failed" = "ok",
  ) {
    console.log("[CHATBOT_VOICE_SAMPLE_ENTER]", {
      audioUriToSave,
      sampleType,
      sampleStatus,
      role,
      voiceAnalysisTargetSeniorId,
      hasUser: !!user,
    });
    // 한 대화에서 여러 턴을 모두 분석하면 예측·알림이 중복된다.
    // 대화 시작 시 수집하는 첫 자유발화 한 건만 그날의 CHATBOT 목소리 날씨 근거로 사용한다.
    if (
      !audioUriToSave ||
      role !== "elder" ||
      sampleType !== "sustained_vowel" ||
      sampleStatus !== "ok" ||
      !voiceAnalysisTargetSeniorId ||
      !user
    ) {
      console.log("[CHATBOT_VOICE_SAMPLE_SKIP]", {
        noAudioUri: !audioUriToSave,
        notElder: role !== "elder",
        wrongSampleType: sampleType !== "sustained_vowel",
        wrongSampleStatus: sampleStatus !== "ok",
        noVoiceAnalysisTarget: !voiceAnalysisTargetSeniorId,
        noUser: !user,
      });
      return;
    }

    try {
      console.log("[CHATBOT_VOICE_ANALYZE_START]", {
        audioUriToSave,
        sampleType,
        sampleStatus,
        voiceAnalysisTargetSeniorId,
      });
      await analyzeVoice(audioUriToSave, "CHATBOT", sampleType, sampleStatus);
      console.log("[CHATBOT_VOICE_ANALYZE_SUCCESS]");
    } catch (error) {
      // 분석 실패가 안부 대화 자체를 막지는 않는다. 원본 오디오는 기존 ZDR 흐름대로 폐기한다.
      console.log("[CHATBOT_VOICE_ANALYZE_FAILED]", error);
    }
  }

  async function finishVoiceCheck(succeeded: boolean) {
    if (sustainedStopTimeoutRef.current) {
      clearTimeout(sustainedStopTimeoutRef.current);
      sustainedStopTimeoutRef.current = null;
    }

    greetingInProgressRef.current = true;
    flowStepRef.current = "VOICE_CHECK_DONE";
    setFlowStep("VOICE_CHECK_DONE");
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    sustainedRetryRef.current = 0;

    const donePrompt = succeeded
      ? pickRandom(VOICE_CHECK_DONE_PROMPTS)
      : "목소리 확인은 여기까지 할게요.";
    const nextPrompt = pickRandom(NORMAL_CHAT_START_PROMPTS);

    const fullText = `${donePrompt} ${nextPrompt}`;

    try {
      await speakBotLine(fullText, "happy");
    } finally {
      greetingInProgressRef.current = false;
    }
    flowStepRef.current = "NORMAL_CHAT";
    setFlowStep("NORMAL_CHAT");
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    setChatState("listening");

    beginConversationListening();
  }

  async function retrySustainedVowel() {
    sustainedRetryRef.current = 1;

    await speakBotLine("조금만 더 길게 해볼게요.", "happy");
    await speakBotLine(
      "제가 셋을 세면 '아' 소리를 3초 정도 이어서 말씀해주세요.",
      "happy",
    );
    await speakBotLine("셋. 둘. 하나.", "happy");
    beginSustainedVowelRecording();
  }

  function beginSustainedVowelRecording() {
    flowStepRef.current = "SUSTAINED_VOWEL_RECORDING";
    setFlowStep("SUSTAINED_VOWEL_RECORDING");
    voiceModeRef.current = "sustainedVowel";
    activeRecordingModeRef.current = "sustainedVowel";
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    setBotEmotion("listening");
    setChatState("listening");
    setBotReply("3초 동안 '아' 소리를 내어주세요");

    setTimeout(() => {
      if (voiceModeRef.current !== "sustainedVowel") return;

      void startRecording(900, true);

      sustainedStopTimeoutRef.current = setTimeout(() => {
        if (
          voiceModeRef.current === "sustainedVowel" &&
          recorderStateRef.current === "recording"
        ) {
          void stopRecording();
        }
      }, SUSTAINED_VOWEL_MAX_MS);
    }, 350);
  }

  async function startVoiceCheckAfterFreeTalk() {
    flowStepRef.current = "VOICE_CHECK_INTRO";
    setFlowStep("VOICE_CHECK_INTRO");
    greetingInProgressRef.current = true;

    const intro = "이야기 들려주셔서 고마워요.";
    const checkPrompt = pickRandom(VOICE_CHECK_PROMPTS);

    const fullText = `${intro} ${checkPrompt} 제가 셋을 세면 시작해볼게요. 셋. 둘. 하나.`;

    try {
      await speakBotLine(fullText, "happy");
    } finally {
      greetingInProgressRef.current = false;
    }
    beginSustainedVowelRecording();
  }

  useEffect(() => {
    const recordingMode = activeRecordingModeRef.current;
    const turnAudioUri = audioUriRef.current;

    // 녹음 상태가 'done'이거나 오디오가 준비되었을 때만 제출을 시작한다.
    if (recorderState !== "done" || !turnAudioUri) {
      return;
    }

    if (submittingTranscriptRef.current) return;
    submittingTranscriptRef.current = true;

    const recordingEndAt = chatTimingNowMs();

    const turnDurationMs = durationMs;
    const currentFlowStep = flowStepRef.current;
    const isMedicationConversation =
      !!medicationReminderIdRef.current || !!localMedicationIdRef.current;
    const sampleType: VoiceSampleType | null = isMedicationConversation
      ? null
      : recordingMode === "sustainedVowel"
        ? "sustained_vowel"
        : currentFlowStep === "FIRST_FREE_TALK"
          ? "free_speech_intro"
          : recordingMode === "conversation"
            ? "normal_chat"
            : null;
    const sampleStatus =
      recordingMode === "sustainedVowel" && turnDurationMs < SUSTAINED_VOWEL_MIN_MS
        ? "too_short"
        : "ok";

    console.log("[TURN_READY]", {
      mode: recordingMode,
      durationMs: turnDurationMs,
      audioUri: turnAudioUri,
    });

    console.log("[CHATBOT_VOICE_SAMPLE_CHECK]", {
      turnAudioUri,
      recordingMode,
      currentFlowStep,
      isMedicationConversation,
      sampleType,
      sampleStatus,
      role,
      voiceAnalysisTargetSeniorId,
      hasUser: !!user,
    });

    void (async () => {
      try {
        if (turnAudioUri && sampleType) {
          await saveChatbotVoiceSample(turnAudioUri, sampleType, sampleStatus);
        }

        // 'sustainedVowel' (아~~~ 3초 측정) 모드
        if (recordingMode === "sustainedVowel") {
          resetRecorder();
          if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);

          if (turnDurationMs < SUSTAINED_VOWEL_MIN_MS) {
            console.warn("[SUSTAINED_VOWEL_TOO_SHORT]", {
              durationMs: turnDurationMs,
              retry: sustainedRetryRef.current,
            });

            if (sustainedRetryRef.current < 1) {
              await retrySustainedVowel();
              return;
            }

            await finishVoiceCheck(false);
            return;
          }

          await finishVoiceCheck(true);
          return;
        }

        // recordingMode 가 렌더 경합/포커스 이펙트 churn 으로 null 로 유실돼도,
        // 대화가 활성이고 일반대화(NORMAL_CHAT) 흐름이면 한 턴으로 정상 전송한다.
        // 이 보강이 없으면 mode=null 인 done 오디오를 통째로 버려, 응답 없이
        // "계속 듣기만" 하는 상태(턴 유실)가 된다. (콘솔 [TURN_READY] mode:null 증상)
        const isConversationTurn =
          recordingMode === "conversation" ||
          (conversationActiveRef.current && flowStepRef.current === "NORMAL_CHAT");
        if (!isConversationTurn) {
          resetRecorder();
          return;
        }
        if (!conversationActiveRef.current) {
          resetRecorder();
          return;
        }

        if (currentFlowStep === "FIRST_FREE_TALK") {
          resetRecorder();
          await startVoiceCheckAfterFreeTalk();
          return;
        }

        // 복약 대화 및 일반 대화 모두 백엔드 단일 통합 API로 원스톱 처리!
        // [중요] 업로드 전에 resetRecorder()를 호출하면 안 된다. reset()이 clearAudio()를
        // 부르고, 웹에서는 그 안에서 URL.revokeObjectURL(turnAudioUri)로 blob URL을 즉시
        // 해제한다. 그러면 sendVoiceMessage 가 같은 URL을 fetch 할 때 깨져 매 턴 실패한다.
        // 오디오 해제·상태 초기화는 업로드가 끝난 뒤 아래 finally 의 clearAudio() 가 담당한다.
        if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);

        console.log("[CHAT_TIMING] recording_end");
        console.log("[SEND_VOICE_MESSAGE_START]", turnAudioUri);
        await sendVoiceMessage(turnAudioUri, turnDurationMs, { recordingEndAt });
        console.log("[SEND_VOICE_MESSAGE_DONE]");

        // 업로드가 끝난 뒤에 녹음기를 초기화한다(타이머·웹 VAD 모니터·autoStoppingRef
        // 리셋, 상태 idle). 그래야 다음 턴 녹음이 깔끔하게 새로 시작되고 자동정지가
        // 정상 동작한다. 전송 전에 부르면 blob URL이 revoke돼 업로드가 깨지므로 반드시 이후.
        resetRecorder();
      } catch (err) {
        console.error("[VOICE_TURN_ERROR]", err);
        resetRecorder();
      } finally {
        if (activeRecordingModeRef.current === recordingMode) {
          activeRecordingModeRef.current = null;
        }
        submittingTranscriptRef.current = false;
        // 전송 프로세스가 완료된 후 안전하게 오디오 캐시 정리
        if (turnAudioUri) {
          try {
            await clearAudio?.();
          } catch (e) {
            console.warn("clearAudio failed:", e);
          }
        }
      }
    })();
  }, [clearAudio, durationMs, resetRecorder, recorderState]);

  useEffect(() => {
    if (
      !isConversationActive ||
      !noSpeechDetected ||
      voiceModeRef.current !== "conversation"
    ) {
      return;
    }

    if (silenceRetryRef.current >= 1) {
      if (
        recorderStateRef.current === "recording" ||
        recorderStateRef.current === "processing" ||
        submittingTranscriptRef.current
      ) {
        console.log("[ACTIVE_FALSE_SKIP]", {
          reason: "no_speech_while_capture_pending",
          recorderState: recorderStateRef.current,
          submitting: submittingTranscriptRef.current,
        });
        return;
      }

      voiceModeRef.current = null;
      activeRecordingModeRef.current = null;
      conversationActiveRef.current = false;
      setChatState("idle");
      setIsConversationActive(false);
      resetRecorder();
      return;
    }

    const prompt = lastPromptRef.current || botReply;

    if (!prompt) return;

    silenceRetryRef.current = 1;
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    void speakBotLine(prompt, botEmotion);
  }, [botReply, isConversationActive, noSpeechDetected, resetRecorder, speakText]);

  useEffect(() => {
    if (
      !isConversationActive ||
      !noSpeechDetected ||
      voiceModeRef.current !== "sustainedVowel"
    ) {
      return;
    }

    if (
      recorderStateRef.current === "recording" ||
      recorderStateRef.current === "processing" ||
      submittingTranscriptRef.current
    ) {
      return;
    }

    resetRecorder();

    if (sustainedRetryRef.current < 1) {
      void retrySustainedVowel();
      return;
    }

    console.warn("[SUSTAINED_VOWEL_FAILED_AFTER_RETRY]");
    void finishVoiceCheck(false);
  }, [isConversationActive, noSpeechDetected, resetRecorder]);

  useEffect(() => {
    if (!isConversationActive) return;

    if (isBotTyping) {
      setChatState("thinking");
    }
  }, [isBotTyping, isConversationActive]);

  useEffect(() => {
    if (!isConversationActive) return;

    const lastBotMessage = [...messages]
      .reverse()
      .find((message) => message.role === "bot");

    if (!lastBotMessage || lastBotMessage.id === lastBotMessageIdRef.current) {
      return;
    }

    lastBotMessageIdRef.current = lastBotMessage.id;
    activeBotTurnIdRef.current = lastBotMessage.turnId ?? lastBotMessage.id;
    lastPromptRef.current = lastBotMessage.text;
    typewriterDelayRef.current = lastBotMessage.typingDelayMs ?? 48;

    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    setBotEmotion(lastBotMessage.emotion ?? liveBotEmotion);
    setChatState("botSpeaking");
    void displayBubbleSentences(
      lastBotMessage.text,
      lastBotMessage.emotion ?? liveBotEmotion,
    );
  }, [isConversationActive, liveBotEmotion, messages]);

  useEffect(() => {
    if (nextAction === "finish") {
      finishActionPendingRef.current = true;
    }

    const isReplyTyping =
      typewriterTimerRef.current !== null ||
      bubbleDisplayInProgressRef.current ||
      botLineSpeakingRef.current;

    console.log("[FINISH_CHECK]", {
      nextAction,
      chatState,
      isBotTyping,
      isBotSpeaking,
      isConversationActive,
      isReplyTyping,
      finishPending: finishActionPendingRef.current,
    });

    if (!isConversationActive || greetingInProgressRef.current) {
      return;
    }

    if (
      finishActionPendingRef.current &&
      !isBotTyping &&
      !isBotSpeaking &&
      !isReplyTyping
    ) {
      if (isCapturePending()) {
        console.log("[FINISH_DEFERRED]", {
          recorderState: recorderStateRef.current,
          recordingMode: activeRecordingModeRef.current,
          submitting: submittingTranscriptRef.current,
        });
        return;
      }

      finishActionPendingRef.current = false;
      console.log("[FINISH_COMPLETE_SHOW_RESULT]");
      voiceModeRef.current = null;
      activeRecordingModeRef.current = null;
      conversationActiveRef.current = false;
      void endConversationSession();
      setIsConversationActive(false);
      setChatState("completed");
      setBotEmotion("clapping");
      setConversationResultVisible(true);
      console.log("[CONVERSATION_FINISH]", {
        nextAction,
        chatState: "completed",
        showConversationResult: true,
      });
      return;
    }

    if (finishActionPendingRef.current) {
      console.log("[FINISH_WAITING_FOR_REPLY_END]", {
        isBotTyping,
        isBotSpeaking,
        isReplyTyping,
      });
      return;
    }

    if (
      chatState !== "botSpeaking" ||
      isBotTyping ||
      isBotSpeaking ||
      isReplyTyping
    ) {
      return;
    }

    setChatState("listening");
    beginConversationListening();
  }, [
    chatState,
    isBotSpeaking,
    isBotTyping,
    isConversationActive,
    nextAction,
    recorderState,
    replyTypingVersion,
  ]);

  const startFirstGreeting = useCallback(async () => {
    if (conversationRunningRef.current) return;

    conversationRunningRef.current = true;
    greetingInProgressRef.current = true;

    try {
      flowStepRef.current = "GREETING";
      setFlowStep("GREETING");
      const greeting = getTimeBasedVoiceCheckGreeting();
      const checkPrompt = pickRandom(VOICE_CHECK_PROMPTS);
      const firstReply = `${greeting} ${checkPrompt} 제가 셋을 세면 시작해볼게요. 셋. 둘. 하나.`;

      silenceRetryRef.current = 0;
      flowStepRef.current = "VOICE_CHECK_INTRO";
      setFlowStep("VOICE_CHECK_INTRO");
      await speakBotLine(firstReply, "happy");

      greetingInProgressRef.current = false;
      conversationActiveRef.current = true;
      setIsConversationActive(true);

      beginSustainedVowelRecording();
    } catch {
      setChatState("error");

      await wait(1200);

      setChatState("idle");
      conversationActiveRef.current = false;
      setIsConversationActive(false);
    } finally {
      greetingInProgressRef.current = false;
      conversationRunningRef.current = false;
    }
  }, [speakText]);

  const startReturnGreeting = useCallback(async () => {
    if (conversationRunningRef.current) return;

    conversationRunningRef.current = true;
    greetingInProgressRef.current = true;

    try {
      function getReturnGreeting() {
        const greetings = [
          "다시 오셨네요. 조금 더 이야기해볼까요?",
          "돌아오셨네요. 방금 보신 건 괜찮으셨어요?",
          "어서 오세요. 이어서 잠깐만 더 이야기해볼까요?",
          "다시 만나서 좋아요. 지금 기분은 어떠세요?",
        ];

        return greetings[Math.floor(Math.random() * greetings.length)];
      }

      const reply = getReturnGreeting();
      silenceRetryRef.current = 0;
      await speakBotLine(reply, "happy");

      greetingInProgressRef.current = false;
      conversationActiveRef.current = true;
      setIsConversationActive(true);
      setChatState("listening");

      beginConversationListening();
    } catch {
      setChatState("error");

      await wait(1200);

      setChatState("idle");
      conversationActiveRef.current = false;
      setIsConversationActive(false);
    } finally {
      greetingInProgressRef.current = false;
      conversationRunningRef.current = false;
    }
  }, [speakText]);

  useFocusEffect(
    useCallback(() => {
      if (showConversationResultRef.current) {
        console.log("[RESULT_RESET_SKIP]", {
          reason: "conversation_result_visible",
          showConversationResult: showConversationResultRef.current,
        });
        return () => {
          console.log("[RESULT_CLEANUP_SKIP]", {
            reason: "conversation_result_visible",
          });
        };
      }

      const preserveActive = shouldPreserveConversationActive();

      if (preserveActive) {
        console.log("[ACTIVE_RESET_SKIP]", {
          reason: "conversation_turn_in_flight",
          recorderState: recorderStateRef.current,
          recordingMode: activeRecordingModeRef.current,
          submitting: submittingTranscriptRef.current,
        });
        conversationActiveRef.current = true;
        setIsConversationActive(true);
      } else {
        resetConversationSession();
      }

      const hasMedicationTrigger = !!(medicationReminderId || localMedicationId);
      const now = Date.now();
      const canReturnGreeting =
        autoStartedRef.current &&
        !preserveActive &&
        !hasMedicationTrigger &&
        now - lastAutoGreetingRef.current > RETURN_GREETING_COOLDOWN_MS;

      if (canReturnGreeting) {
        lastAutoGreetingRef.current = now;

        conversationActiveRef.current = true;
        setIsConversationActive(true);

        void startReturnGreeting();
      }

      return () => {
        if (shouldPreserveConversationActive()) {
          console.log("[ACTIVE_CLEANUP_SKIP]", {
            reason: "conversation_turn_in_flight",
            recorderState: recorderStateRef.current,
            recordingMode: activeRecordingModeRef.current,
            submitting: submittingTranscriptRef.current,
          });
          return;
        }

        voiceModeRef.current = null;
        activeRecordingModeRef.current = null;
        conversationRunningRef.current = false;
        conversationActiveRef.current = false;
        submittingTranscriptRef.current = false;
        flowStepRef.current = "IDLE";
        setFlowStep("IDLE");
      };
    }, [
      localMedicationId,
      medicationReminderId,
    ]),
  );

  const startMedicationReminderConversation = useCallback(async () => {
    const reminderId =
      typeof medicationReminderId === "string" ? medicationReminderId : undefined;
    const localId =
      typeof localMedicationId === "string" ? localMedicationId : undefined;

    if ((!reminderId && !localId) || conversationRunningRef.current) return;

    conversationRunningRef.current = true;
    greetingInProgressRef.current = true;
    medicationReminderIdRef.current = reminderId ?? null;
    localMedicationIdRef.current = localId ?? null;

    const prompt =
      typeof medicationPrompt === "string" && medicationPrompt.trim()
        ? medicationPrompt
        : "8시에 드시기로 한 약은 드셨나요?";

    try {
      silenceRetryRef.current = 0;
      await speakBotLine(prompt, "happy");

      greetingInProgressRef.current = false;

      beginConversationListening();
    } catch {
      setChatState("error");
      setIsConversationActive(false);
      conversationActiveRef.current = false;
    } finally {
      greetingInProgressRef.current = false;
      conversationRunningRef.current = false;
    }
  }, [localMedicationId, medicationPrompt, medicationReminderId, speakText]);

  useEffect(() => {
    const triggerId = medicationReminderId ?? localMedicationId;

    if (!triggerId || medicationAutoStartedRef.current === triggerId) return;

    resetConversationSession();

    medicationAutoStartedRef.current = triggerId;
    conversationActiveRef.current = true;
    setIsConversationActive(true);

    void startMedicationReminderConversation();
  }, [
    localMedicationId,
    medicationReminderId,
    startMedicationReminderConversation,
  ]);

  useEffect(() => {
    if (!startedFromIntro || autoStartedRef.current) return;

    resetConversationSession();

    autoStartedRef.current = true;
    lastAutoGreetingRef.current = Date.now();

    conversationActiveRef.current = true;
    setIsConversationActive(true);

    void startFirstGreeting();
  }, [startFirstGreeting, startedFromIntro]);

  function handleStartConversation() {
    console.log("[START_BUTTON_CLICKED]");

    resetConversationSession();

    autoStartedRef.current = true;
    lastAutoGreetingRef.current = Date.now();

    conversationActiveRef.current = true;
    setIsConversationActive(true);

    void startFirstGreeting();
  }

  function beginConversationListening() {
    console.log("[BEGIN_LISTEN]", {
      active: conversationActiveRef.current,
      recorderState,
      isBotSpeaking: isBotSpeakingRef.current,
      isBotTyping: isBotTypingRef.current,
      bubbleSpeaking: bubbleDisplayInProgressRef.current,
      botLineSpeaking: botLineSpeakingRef.current,
    });

    if (!conversationActiveRef.current) {
      console.log("[LISTEN_SKIP] not active");  // ← 이게 찍히면?
      return;
    }
    if (
      isBotSpeakingRef.current ||
      isBotTypingRef.current ||
      bubbleDisplayInProgressRef.current ||
      botLineSpeakingRef.current
    ) {
      console.log("[LISTEN_SKIP] bot speaking");
      return;
    }
    if (recorderState === "recording" || recorderState === "processing") {
      console.log("[LISTEN_SKIP] recorder busy:", recorderState);  // ← 이게 찍히면?
      return;
    }

    voiceModeRef.current = "conversation";
    console.log("[VOICE_MODE_SET]", voiceModeRef.current);
    activeRecordingModeRef.current = "conversation";
    console.log("[RECORDING_MODE_SET]", activeRecordingModeRef.current);

    setBotEmotion("listening");
    setChatState("listening");

    setTimeout(() => {
      if (
        !conversationActiveRef.current ||
        voiceModeRef.current !== "conversation" ||
        isBotSpeakingRef.current ||
        isBotTypingRef.current ||
        bubbleDisplayInProgressRef.current ||
        botLineSpeakingRef.current
      ) {
        console.log("[START_RECORDING_SKIP] bot still speaking or inactive");
        return;
      }

      console.log("[START_RECORDING]", voiceModeRef.current);
      void startRecording(1500);
    }, 350);
  }

  function handleConversationVoice() {
    if (
      chatState !== "botSpeaking" &&
      chatState !== "thinking" &&
      recorderState !== "recording" &&
      !isBotSpeakingRef.current &&
      !isBotTypingRef.current &&
      !bubbleDisplayInProgressRef.current &&
      !botLineSpeakingRef.current
    ) {
      beginConversationListening();
    }
  }

  function handleGoToRecord() {
    void endConversationSession();
    conversationRunningRef.current = false;
    setChatState("idle");
    setBotEmotion("default");
    conversationActiveRef.current = false;
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    finishActionPendingRef.current = false;
    setIsConversationActive(false);
    setConversationResultVisible(false);
    flowStepRef.current = "IDLE";
    setFlowStep("IDLE");
    resetRecorder();

    router.push(recordHref);
  }

  function handleResultHome() {
    void endConversationSession();
    resetConversationSession({ blockAutoRestart: true });
  }

  const showGuardianNotice = false;

  const [pendingInvites, setPendingInvites] = useState<
    authApi.PendingInvite[]
  >([]);

  useEffect(() => {
    if (role !== "guardian" || !user) return;

    let alive = true;

    authApi.getPendingInvites(user.id).then((res) => {
      if (alive) setPendingInvites(res.data);
    });

    return () => {
      alive = false;
    };
  }, [role, user]);

  async function reshareInvite(invite: authApi.PendingInvite) {
    const who = invite.seniorName ? `${invite.seniorName}님 ` : "";

    await Share.share({
      message: `MOA 초대 코드: ${invite.token}\n${who}기기에서 이 코드를 입력해 연결을 완료해 주세요.`,
    });
  }

  useEffect(() => {
    if (!isConversationActive || !permissionDenied) return;

    setBotEmotion("worried");
    setBotReply("마이크 사용을 허용해 주시면 목소리로 이야기할 수 있어요");
    setChatState("listening");
  }, [isConversationActive, permissionDenied]);

  useEffect(() => {
    if (!isConversationActive || !recorderError) return;

    setBotEmotion("worried");
    setBotReply(recorderError);
    setChatState("listening");
  }, [isConversationActive, recorderError]);

  const H = windowHeight;
  const v = H / 900;

  const headerTop = insets.top + Math.round(42 * v);
  const bubbleTop = insets.top + Math.round(94 * v);
  const characterTop = insets.top + Math.round(184 * v);
  const navTopGap = Math.max(
    92 + insets.bottom,
    Math.round(92 * v) + insets.bottom,
  );
  const characterHeight = H - characterTop - navTopGap;
  const recordBottom = Math.max(9, Math.round(9 * v));
  const topFadeHeight = characterTop + Math.round(74 * v);
  const topFadeStop = characterTop / topFadeHeight;
  const characterVideoTopOffset = Math.round(170 * v);
  const recordingInstruction =
    flowStep === "SUSTAINED_VOWEL_RECORDING"
      ? "3초 동안 '아~~~' 하고 말해주세요"
      : null;

  if (showConversationResult) {
    console.log("[RESULT_COMPLETE_RENDER]", {
      type: "conversation",
      showConversationResult,
      chatState,
    });
    return <ResultComplete type="conversation" onHome={handleResultHome} />;
  }

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={["#F7D6AC", "#FFF2DE", "#F8CFA4"]}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={[
          "rgba(247,214,172,0)",
          "rgba(247,214,172,0.72)",
          "#F7D6AC",
        ]}
        locations={[0, 0.58, 1]}
        style={[styles.navBackdrop, { pointerEvents: "none" }]}
      />

      <View style={[styles.header, { top: headerTop }]}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>{formatHeaderDate(now)}</Text>
        </View>

        {role === "elder" && (
          <Pressable
            style={styles.notificationButton}
            onPress={() => router.push("/(elder)/notifications")}
            accessibilityRole="button"
            accessibilityLabel="알림센터 열기"
          >
            <Bell size={25} color="#173F73" strokeWidth={2.4} />
          </Pressable>
        )}
      </View>

      {showGuardianNotice ? (
        <View style={[styles.noticeWrap, { top: bubbleTop }]}>
          {pendingInvites.map((invite) => {
            const who = invite.seniorName ?? "부모님";

            return (
              <View key={invite.token} style={styles.noticeCard}>
                <View style={styles.noticeHead}>
                  <Clock size={20} color="#E8943A" strokeWidth={2.4} />
                  <Text style={styles.noticePendTitle}>
                    {`${who} 초대 대기`}
                  </Text>
                </View>

                <Text style={styles.noticeCode}>{invite.token}</Text>

                <Pressable
                  style={styles.noticeReshareBtn}
                  onPress={() => reshareInvite(invite)}
                  accessibilityRole="button"
                >
                  <Share2 size={18} color="#FF7955" />
                  <Text style={styles.noticeReshareText}>
                    초대 코드 재공유
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={[styles.speechBubbleWrap, { top: bubbleTop }]}>
          <Pressable
            style={styles.speechBubble}
            onPress={handleConversationVoice}
            disabled={
              !isConversationActive ||
              recorderState === "processing" ||
              chatState === "botSpeaking" ||
              chatState === "thinking"
            }
            accessibilityRole={isConversationActive ? "button" : undefined}
            accessibilityLabel={
              isConversationActive
                ? "모아가 듣고 있어요. 말씀을 마치면 자동으로 전송됩니다"
                : undefined
            }
          >
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={[styles.speechBubbleShape, { pointerEvents: "none" }]}
            >
              <Path
                d="M 12 0 H 88 C 94.6 0 100 13.5 100 30 V 64 C 100 79.5 94.6 92 88 92 H 60 C 56 92 55 97 50 97 C 45 97 44 92 40 92 H 12 C 5.4 92 0 79.5 0 64 V 30 C 0 13.5 5.4 0 12 0 Z"
                fill="#FFFCF8"
              />
            </Svg>

            <Svg
              width={18}
              height={18}
              viewBox="0 0 18 18"
              style={[
                styles.speechSparkle,
                styles.speechSparkleLeft,
                { pointerEvents: "none" },
              ]}
            >
              <Path
                d="M 9 0 V 7 M 2 3 L 7 7 M 16 3 L 11 7"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </Svg>

            <Svg
              width={18}
              height={18}
              viewBox="0 0 18 18"
              style={[
                styles.speechSparkle,
                styles.speechSparkleRight,
                { pointerEvents: "none" },
              ]}
            >
              <Path
                d="M 9 0 V 7 M 2 3 L 7 7 M 16 3 L 11 7"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </Svg>

            <Text
              style={styles.speechText}
            >
              {speechBubbleText}
            </Text>
          </Pressable>

          {isConversationActive && !!latestUserMessage?.text && (
            <View style={styles.userSpeechStatusBar}>
              <Text style={styles.userSpeechStatusLabel}>들은 말</Text>
              <Text style={styles.userSpeechStatusText} numberOfLines={2}>
                {latestUserMessage.text}
              </Text>
            </View>
          )}

          {recorderState === "recording" && (
            <View style={styles.recordingStatusBar}>
              <Waveform color="#6F9C62" animated />
              <Text style={styles.recordingTime}>
                {recordingInstruction
                  ? `${recordingInstruction} · ${formatDuration(durationMs)}`
                  : formatDuration(durationMs)}
              </Text>
            </View>
          )}

          {SHOW_STT_DEBUG && !!lastRecognizedText && (
            <View style={styles.sttDebugBar}>
              <Text style={styles.sttDebugLabel}>인식한 말</Text>
              <Text style={styles.sttDebugText}>{lastRecognizedText}</Text>
            </View>
          )}
        </View>
      )}

      <View
        style={[
          styles.characterWrap,
          {
            left: 0,
            right: 0,
            top: characterTop,
            height: characterHeight,
            pointerEvents: "none",
          },
        ]}
      >
        <CharacterPlayer
          mood={mood}
          hasUserInteracted={hasUserInteracted}
          bottomFadeColor="#F7D6AC"
          containerStyle={{
            left: 0,
            right: 0,
            top: -characterVideoTopOffset,
            bottom: 0,
          }}
        />
      </View>

      <LinearGradient
        colors={[
          "#F7D6AC",
          "rgba(247,214,172,0.92)",
          "rgba(247,214,172,0)",
        ]}
        locations={[0, topFadeStop, 1]}
        style={[
          styles.characterTopFade,
          {
            height: topFadeHeight,
            pointerEvents: "none",
          },
        ]}
      />

      <Pressable
        style={({ pressed }) => [
          styles.recordButton,
          { bottom: recordBottom },
          pressed && styles.pressed,
        ]}
        onPress={handleGoToRecord}
        accessibilityRole="button"
        accessibilityLabel="녹음하러 가기"
      >
        <View style={styles.recordIconWrap}>
          <MicIcon color="#5B4636" size={34} />
        </View>

        <View style={styles.recordTextWrap}>
          <Text style={styles.recordTitle}>녹음하러 가기</Text>
        </View>

        <ChevronRight
          style={styles.buttonChevron}
          size={26}
          color="#5B4636"
          strokeWidth={2.2}
        />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.conversationButton,
          { bottom: recordBottom + 90 },
          pressed && !isConversationActive && styles.pressed,
          isConversationActive && styles.conversationButtonDisabled,
        ]}
        onPress={handleStartConversation}
        disabled={isConversationActive}
        accessibilityRole="button"
        accessibilityLabel={
          isConversationActive ? "모아가 듣고 있어요" : "모아와 대화 시작하기"
        }
      >
        <View style={styles.conversationIconWrap}>
          <MessageCircle
            size={32}
            color="#FFFFFF"
            fill="#FFFFFF"
            strokeWidth={1.8}
          />

          <View style={styles.conversationIconDots}>
            <View style={styles.conversationIconDot} />
            <View style={styles.conversationIconDot} />
            <View style={styles.conversationIconDot} />
          </View>
        </View>

        <View style={styles.conversationTextWrap}>
          <Text style={styles.conversationTitle}>
            {isConversationActive ? "듣고 있어요..." : "모아와 대화 시작하기"}
          </Text>
        </View>

        <ChevronRight
          style={styles.buttonChevron}
          size={26}
          color="#FFFFFF"
          strokeWidth={2.2}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: "hidden",
  },
  navBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
    zIndex: 6,
  },
  header: {
    position: "absolute",
    left: 53,
    right: 32,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateBlock: {
    gap: 0,
  },
  dateText: {
    fontFamily: "Pretendard-ExtraBold",
    color: "#3B2318",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  speechBubbleWrap: {
    position: "absolute",
    left: 62,
    right: 62,
    zIndex: 7,
    overflow: "visible",
  },
  notificationButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,252,248,0.66)",
  },
  speechBubble: {
    width: "100%",
    minHeight: 70,
    borderRadius: 26,
    backgroundColor: "#FFFCF8",
    borderWidth: 1,
    borderColor: "rgba(117,76,42,0.10)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 18,
    overflow: "visible",
  },
  speechBubbleShape: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  speechSparkle: {
    position: "absolute",
  },
  speechSparkleLeft: {
    top: -15,
    left: -24,
  },
  speechSparkleRight: {
    top: -15,
    right: -24,
  },
  speechText: {
    fontFamily: "Jua",
    color: "#3B2318",
    fontSize: 24,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    maxHeight: 68,
  },
  recordingStatusBar: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(255,253,248,0.38)",
  },
  recordingTime: {
    color: "#668D5F",
    fontSize: 14,
    fontWeight: "800",
  },
  userSpeechStatusBar: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "88%",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(255,253,248,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  userSpeechStatusLabel: {
    color: "#6F9C62",
    fontSize: 13,
    fontWeight: "900",
  },
  userSpeechStatusText: {
    flexShrink: 1,
    color: "#3B2318",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  sttDebugBar: {
    alignSelf: "center",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(59, 35, 24, 0.08)",
  },
  sttDebugLabel: {
    color: "#765E52",
    fontSize: 12,
    fontWeight: "800",
  },
  sttDebugText: {
    flexShrink: 1,
    color: "#3B2318",
    fontSize: 13,
    fontWeight: "700",
  },
  noticeWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 8,
    gap: 12,
  },
  noticeCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    padding: 18,
    gap: 10,
    boxShadow: "0 18px 38px rgba(95, 55, 30, 0.12)",
  },
  noticeTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#3B2318",
  },
  noticeBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#765E52",
  },
  noticePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 15,
    backgroundColor: "#FF7955",
    marginTop: 2,
  },
  noticePrimaryText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  noticeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticePendTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#9A6B25",
  },
  noticeCode: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 3,
    color: "#342C28",
  },
  noticeReshareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD3C6",
    backgroundColor: "white",
  },
  noticeReshareText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FF7955",
  },
  characterWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  characterTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
  },
  recordButton: {
    position: "absolute",
    left: 36,
    right: 36,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#F7EFE4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 15,
    paddingVertical: 8,
    gap: 11,
    zIndex: 15,
    overflow: "hidden",
    boxShadow: "0 8px 16px rgba(91, 70, 54, 0.13)",
  },
  conversationButton: {
    position: "absolute",
    left: 36,
    right: 36,
    height: 86,
    borderRadius: 16,
    backgroundColor: "#173F73",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 15,
    paddingVertical: 8,
    gap: 11,
    zIndex: 15,
    overflow: "hidden",
    boxShadow: "0 8px 16px rgba(53, 90, 138, 0.22)",
  },
  conversationButtonDisabled: {
    opacity: 0.7,
  },
  conversationTitle: {
    fontFamily: "Pretendard-ExtraBold",
    color: "#FFFFFF",
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
  },
  conversationSub: {
    fontFamily: "Pretendard-Bold",
    color: "#FFFFFF",
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
  },
  recordIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#EFE1D0",
    alignItems: "center",
    justifyContent: "center",
  },
  recordTextWrap: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 1,
  },
  recordTitle: {
    fontFamily: "Pretendard-ExtraBold",
    color: "#5B4636",
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
  },
  recordSub: {
    fontFamily: "Pretendard-Bold",
    color: "#5B4636",
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "700",
    opacity: 1,
  },
  conversationIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  conversationIconDots: {
    position: "absolute",
    flexDirection: "row",
    gap: 2,
  },
  conversationIconDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#173F73",
  },
  conversationTextWrap: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 1,
  },
  buttonChevron: {
    marginLeft: "auto",
  },
});

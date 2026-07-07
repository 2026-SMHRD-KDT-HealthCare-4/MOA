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
  appendAssistantMessage,
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
const SUSTAINED_VOWEL_MIN_MEANINGFUL_MS = 500;
const SUSTAINED_VOWEL_SILENCE_MS = 3_000;
// 통과 기준(감지 발성 길이). 안내 문구 "3초"에 맞추되, VAD 감지시간은 실제 발성보다
// 짧게 잡히므로 2.5초로 완화해 정상적인 3초 발성이 반복 실패하지 않게 한다.
const SUSTAINED_VOWEL_TARGET_MS = 2_500;
const SUSTAINED_VOWEL_MAX_MS = 7_000;
const FREE_TALK_MIN_MS = 1_200; // 자유대화 최소 발화 길이(ms) — 노이즈성 단답 컷용, 임시값
// 재시도 상한: 이 횟수를 넘으면 음성검사를 종료(finishVoiceCheck(false))하고 일반 대화로 넘어간다.
// (상한이 없으면 기준 미달 시 "'아' 소리 내주세요"가 무한 반복됨)
// 한 번 감지 실패하면 임계값을 낮춰 재시도 1회만 하고, 그것도 실패하면 다음 과정으로 넘어간다.
const SUSTAINED_VOWEL_MAX_RETRIES = 1;
// 지속모음 발화 감지(web VAD) RMS 임계값. 첫 시도는 raw 기본값(0.02)으로 감지하고,
// 감지 실패로 재시도할 때는 0.01로 낮춰 다음 '아'가 더 쉽게 통과되게 한다.
// 재시도 횟수(sustainedRetryRef)는 검사 종료·이탈 시 0으로 리셋되므로 임계값도 자동 원복된다.
const SUSTAINED_VOWEL_BASE_RMS = 0.02;
const SUSTAINED_VOWEL_RETRY_RMS = 0.01;
const BUBBLE_SENTENCE_PAUSE_MS = 120;
const BUBBLE_TEXT_MAX_CHARS = 34;

// Currently unused; startFirstGreeting builds the voice-check intro directly.
const VOICE_CHECK_PROMPTS = [
  "목소리만 잠깐 확인할게요.",
  "'아' 소리 3초만 해주세요.",
  "짧게 목소리 확인할게요.",
];

const VOICE_CHECK_DONE_PROMPTS = [
  "잘하셨어요! 목소리 확인이 끝났어요.",
  "감사해요. 오늘 목소리도 잘 확인했어요.",
  "좋아요! 이제 편하게 이야기 이어가 볼까요?",
  "아주 잘하셨어요. 이제 오늘 이야기를 더 들려주세요.",
];

// 안부 대화 시작 질문 후보. 매일 사용해도 식상하지 않도록 주제를 넓게 두고,
// 직전에 쓴 질문은 피해서(pickNextStartPrompt) 연속 반복을 막는다.
// 규칙: 진단/처방/치료 표현 금지, "어르신" 미사용, 따뜻한 시니어 톤의 열린 질문.
const NORMAL_CHAT_START_PROMPTS = [
  "오늘 점심은 뭘 드셨어요? 맛있게 드셨는지 궁금해요.",
  "오늘 아침은 든든하게 챙겨 드셨어요?",
  "오늘 동네 산책이나 마실은 다녀오셨어요?",
  "오늘 날씨는 어떤가요? 바깥 공기는 좀 쐬셨어요?",
  "요즘 밤에 잠은 잘 주무세요?",
  "요즘 즐겨 보시는 TV 프로그램이나 드라마가 있으세요?",
  "요즘 자주 듣는 노래나 트로트가 있으세요?",
  "가족들 소식은 좀 들으셨어요? 다들 잘 지내죠?",
  "오늘은 어떤 기분으로 하루를 시작하셨어요?",
  "요즘 키우는 화분이나 텃밭은 잘 자라고 있나요?",
  "가까이 지내는 친구나 이웃은 자주 만나세요?",
  "오늘은 어떤 음식이 드시고 싶으세요?",
  "따뜻한 물이나 차 한 잔 하셨어요?",
  "요즘 시장이나 마트에는 다녀오셨어요?",
  "오늘 하루는 어떻게 보내고 계세요?",
  "옛날에 좋아하시던 음식이나 추억, 하나 들려주실래요?",
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

// 안부 시작 질문 선택 — 직전에 쓴 질문은 피해 연속 반복을 막는다.
// (앱 세션 내 기억. 후보 풀이 넓어 날짜가 바뀌어도 같은 질문이 이어질 확률은 낮다.)
let lastStartPromptIndex = -1;
function pickNextStartPrompt(): string {
  const prompts = NORMAL_CHAT_START_PROMPTS;
  if (prompts.length <= 1) return prompts[0] ?? "";
  let index = Math.floor(Math.random() * prompts.length);
  if (index === lastStartPromptIndex) index = (index + 1) % prompts.length;
  lastStartPromptIndex = index;
  return prompts[index];
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
  const disableWakeWord = useWakeWordStore((s) => s.disable);
  const enableWakeWord = useWakeWordStore((s) => s.enable);

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
    stopSpeaking,
    endConversationSession,
    nextAction,
    resetChatSession,
  } = useMoaChat({ restoreWakeWordAfterTurn: false });

  const {
    state: recorderState,
    transcript,
    durationMs,
    permissionDenied,
    error: recorderError,
    noSpeechDetected,
    speechDetectedDuringRecording,
    detectedSpeechDurationMs,
    audioUri,
    start: startRecording,
    stop: stopRecording,
    reset: resetRecorder,
    clearAudio,
  } = useRecorder({
    autoStopOnSilence: true,
    manageWakeWord: false,
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
  const normalChatStartedRef = useRef(false);
  const sustainedVowelCompletedThisSessionRef = useRef(false);
  const sustainedRetryRef = useRef(0);
  const sustainedStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sustainedCompletionStopRequestedRef = useRef(false);
  const sustainedRetryInProgressRef = useRef(false);
  const listeningStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningStartPendingRef = useRef(false);
  const silenceHandlingRef = useRef(false);

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

  useEffect(() => {
    if (isConversationActive) {
      disableWakeWord();
    } else {
      enableWakeWord();
    }
  }, [disableWakeWord, enableWakeWord, isConversationActive]);

  useEffect(
    () => () => {
      enableWakeWord();
    },
    [enableWakeWord],
  );

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

    // GlobalWakeWordListener가 호출어 안내 TTS를 이미 재생한다.
    // 여기서 다시 speakBotLine을 호출하면 같은 안내가 중복 재생되고
    // botSpeaking 상태가 실제 재생 상태와 어긋날 수 있으므로 화면만 갱신한다.
    setBotReply(wakePrompt);
    setBotEmotion("happy");
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
      void endConversationSession();
      resetConversationSession({ blockAutoRestart: true });
      router.push(recordHref);
      return true;
    }

    if (command === "history") {
      void endConversationSession();
      resetConversationSession({ blockAutoRestart: true });
      router.push(resultHref);
      return true;
    }

    if (command === "result") {
      void endConversationSession();
      resetConversationSession({ blockAutoRestart: true });
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

  function completeConversationAndShowResult(source: "voice" | "button") {
    void stopSpeaking();
    finishActionPendingRef.current = false;
    console.log("[FINISH_COMPLETE_SHOW_RESULT]", { source });
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    conversationActiveRef.current = false;
    normalChatStartedRef.current = false;
    conversationRunningRef.current = false;
    void endConversationSession();
    setIsConversationActive(false);
    setChatState("completed");
    setBotEmotion("clapping");
    setConversationResultVisible(true);
    console.log("[CONVERSATION_FINISH]", {
      source,
      nextAction,
      chatState: "completed",
      showConversationResult: true,
    });
  }

  function resetConversationSession(options: { blockAutoRestart?: boolean } = {}) {
    void stopSpeaking();

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
    if (listeningStartTimeoutRef.current) {
      clearTimeout(listeningStartTimeoutRef.current);
      listeningStartTimeoutRef.current = null;
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
    normalChatStartedRef.current = false;
    sustainedRetryRef.current = 0;
    listeningStartPendingRef.current = false;
    silenceHandlingRef.current = false;
    sustainedRetryInProgressRef.current = false;
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
    const canSpeak = () =>
      !showConversationResultRef.current &&
      (conversationActiveRef.current ||
        conversationRunningRef.current ||
        greetingInProgressRef.current);

    if (!canSpeak()) return;

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
        if (!canSpeak()) return;

        const chunk = chunks[index];
        let didStartBubble = false;
        let bubblePromise: Promise<void> = Promise.resolve();
        const startBubble = () => {
          if (didStartBubble) return;
          didStartBubble = true;
          bubblePromise = displayBubbleSentences(chunk, emotion);
        };

        await speakText(chunk, startBubble);
        if (!canSpeak()) return;
        startBubble();
        await bubblePromise;
        if (!canSpeak()) return;
        await wait(100);
        if (!canSpeak()) return;

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
    if (showConversationResultRef.current) return;

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

  function handleSilentConversationTurn() {
    if (!conversationActiveRef.current || silenceHandlingRef.current) return;

    silenceHandlingRef.current = true;
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    listeningStartPendingRef.current = false;
    if (listeningStartTimeoutRef.current) {
      clearTimeout(listeningStartTimeoutRef.current);
      listeningStartTimeoutRef.current = null;
    }
    resetRecorder();

    if (silenceRetryRef.current >= 1) {
      conversationActiveRef.current = false;
      silenceRetryRef.current = 0;
      greetingInProgressRef.current = true;

      void (async () => {
        try {
          await speakBotLine(
            "잘 안 들렸네요. 필요하시면 모아야 하고 다시 불러주세요.",
            "happy",
          );
        } finally {
          await endConversationSession();
          greetingInProgressRef.current = false;
          silenceHandlingRef.current = false;
          finishActionPendingRef.current = false;
          setIsConversationActive(false);
          setChatState("completed");
          setBotEmotion("clapping");
          setConversationResultVisible(true);
          console.log("[SILENCE_COMPLETE_SHOW_RESULT]");
        }
      })();
      return;
    }

    silenceRetryRef.current = 1;
    greetingInProgressRef.current = true;

    void speakBotLine(
      "잘 안 들렸어요. 다시 한번 말씀해 주세요.",
      "worried",
    ).finally(() => {
      greetingInProgressRef.current = false;
      silenceHandlingRef.current = false;

      if (conversationActiveRef.current) {
        beginConversationListening();
      }
    });
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
      if (listeningStartTimeoutRef.current) {
        clearTimeout(listeningStartTimeoutRef.current);
      }
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
    // 직접사용자 발화는 샘플 종류별로 /analyze에 저장한다.
    // 보호자 음성, 실패/너무 짧은 샘플, 사용자 정보가 없는 경우만 제외한다.
    if (
      !audioUriToSave ||
      role !== "elder" ||
      sampleStatus !== "ok" ||
      !voiceAnalysisTargetSeniorId ||
      !user
    ) {
      console.log("[CHATBOT_VOICE_SAMPLE_SKIP]", {
        noAudioUri: !audioUriToSave,
        notElder: role !== "elder",
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

    if (succeeded) {
      sustainedVowelCompletedThisSessionRef.current = true;
    }

    greetingInProgressRef.current = true;
    flowStepRef.current = "VOICE_CHECK_DONE";
    setFlowStep("VOICE_CHECK_DONE");
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    sustainedRetryRef.current = 0;
    sustainedRetryInProgressRef.current = false;

    const donePrompt = succeeded
      ? pickRandom(VOICE_CHECK_DONE_PROMPTS)
      : "목소리 확인은 여기까지 할게요.";
    const nextPrompt = pickNextStartPrompt();

    const fullText = `${donePrompt} ${nextPrompt}`;

    try {
      await speakBotLine(fullText, "happy");
    } catch (error) {
      console.warn("[VOICE_CHECK_DONE_SPEAK_FAILED]", error);
      if (succeeded) throw error;
    } finally {
      greetingInProgressRef.current = false;
    }

    // 오프닝 질문(대화 유도)만 세션 대화기록에 남겨 LLM이 다음 턴에 반복하지 않게 한다(비차단).
    // 검사 종료 안내(donePrompt)는 제외하고, 실제 질문(nextPrompt)만 저장한다.
    void appendAssistantMessage(nextPrompt);

    flowStepRef.current = "NORMAL_CHAT";
    normalChatStartedRef.current = true;
    console.log("[VOICE_CHECK_DEBUG] flowStep NORMAL_CHAT", {
      succeeded,
      detectedSpeechDurationMs,
    });
    setFlowStep("NORMAL_CHAT");
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    setChatState("listening");

    const didStartListening = beginConversationListening();
    if (!succeeded && !didStartListening) {
      setTimeout(() => {
        if (
          flowStepRef.current === "NORMAL_CHAT" &&
          conversationActiveRef.current &&
          voiceModeRef.current !== "conversation" &&
          recorderStateRef.current !== "recording" &&
          recorderStateRef.current !== "processing"
        ) {
          beginConversationListening();
        }
      }, 700);
    }
  }

  function shouldSkipSustainedVowelForSession() {
    return sustainedVowelCompletedThisSessionRef.current;
  }

  async function startNormalChatWithoutSustainedVowel() {
    if (sustainedStopTimeoutRef.current) {
      clearTimeout(sustainedStopTimeoutRef.current);
      sustainedStopTimeoutRef.current = null;
    }

    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    sustainedRetryRef.current = 0;
    sustainedRetryInProgressRef.current = false;
    flowStepRef.current = "NORMAL_CHAT";
    normalChatStartedRef.current = true;
    setFlowStep("NORMAL_CHAT");
    conversationActiveRef.current = true;
    setIsConversationActive(true);

    const nextPrompt = pickNextStartPrompt();

    try {
      greetingInProgressRef.current = true;
      await speakBotLine(nextPrompt, "happy");
    } finally {
      greetingInProgressRef.current = false;
    }

    // Store only the assistant opening question so the next user answer has context.
    void appendAssistantMessage(nextPrompt);

    setChatState("listening");
    beginConversationListening();
  }

  async function retrySustainedVowel(reason: "noSpeech" | "tooShort" = "tooShort") {
    if (showConversationResultRef.current || !conversationActiveRef.current) return;
    if (sustainedRetryInProgressRef.current) return;

    // 재시도 상한 초과 → 무한 반복 대신 음성검사를 종료하고 일반 대화로 넘어간다.
    if (sustainedRetryRef.current >= SUSTAINED_VOWEL_MAX_RETRIES) {
      console.warn("[SUSTAINED_VOWEL_GIVE_UP]", {
        retry: sustainedRetryRef.current,
        reason,
      });
      await finishVoiceCheck(false);
      return;
    }

    sustainedRetryInProgressRef.current = true;
    sustainedRetryRef.current += 1;
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    if (sustainedStopTimeoutRef.current) {
      clearTimeout(sustainedStopTimeoutRef.current);
      sustainedStopTimeoutRef.current = null;
    }

    const retryPrompt =
      reason === "noSpeech"
        ? "목소리가 잘 들리지 않았어요. 준비되시면 ‘아’ 소리를 길게 이어서 말씀해주세요."
        : "조금 더 길게 들려주시면 좋아요. ‘아’ 소리를 3초 정도 이어서 말씀해주세요.";

    try {
      resetRecorder();
      await speakBotLine(retryPrompt, "happy");
      beginSustainedVowelRecording();
    } finally {
      sustainedRetryInProgressRef.current = false;
    }
  }

  function beginSustainedVowelRecording() {
    if (sustainedStopTimeoutRef.current) {
      clearTimeout(sustainedStopTimeoutRef.current);
      sustainedStopTimeoutRef.current = null;
    }

    resetRecorder();
    flowStepRef.current = "SUSTAINED_VOWEL_RECORDING";
    setFlowStep("SUSTAINED_VOWEL_RECORDING");
    voiceModeRef.current = "sustainedVowel";
    activeRecordingModeRef.current = "sustainedVowel";
    sustainedCompletionStopRequestedRef.current = false;
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    setBotEmotion("listening");
    setChatState("listening");
    setBotReply("3초 동안 '아' 소리를 내어주세요");

    setTimeout(() => {
      if (voiceModeRef.current !== "sustainedVowel") return;

      // 지속모음('아…')은 raw 오디오로 녹음한다: 노이즈억제/자동게인을 꺼서
      // 갤럭시(안드로이드 크롬)에서 지속모음이 배경소음으로 깎여 감지 실패하는
      // 문제를 막고, 가공 안 된 원본으로 음성분석 품질도 확보한다.
      // 첫 시도는 기본 임계값(0.02), 감지 실패 후 재시도는 0.01로 낮춰 더 쉽게 통과되게 한다.
      // 검사 종료 시 재시도(sustainedRetryRef)가 0으로 리셋되면서 임계값도 기본값으로 자동 원복된다.
      const speechRmsThreshold =
        sustainedRetryRef.current > 0 ? SUSTAINED_VOWEL_RETRY_RMS : SUSTAINED_VOWEL_BASE_RMS;
      void startRecording(SUSTAINED_VOWEL_SILENCE_MS, false, true, speechRmsThreshold);

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
    if (shouldSkipSustainedVowelForSession()) {
      await startNormalChatWithoutSustainedVowel();
      return;
    }

    flowStepRef.current = "VOICE_CHECK_INTRO";
    setFlowStep("VOICE_CHECK_INTRO");
    greetingInProgressRef.current = true;

    const fullText = "고마워요, '아' 소리 3초만 해볼게요, 셋, 둘, 하나.";

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
    const sustainedVowelHasMeaningfulSpeech =
  recordingMode !== "sustainedVowel" ||
  (speechDetectedDuringRecording &&
    detectedSpeechDurationMs >= SUSTAINED_VOWEL_MIN_MEANINGFUL_MS);
const sustainedVowelHasEnoughSpeech =
  recordingMode !== "sustainedVowel" ||
  detectedSpeechDurationMs >= SUSTAINED_VOWEL_TARGET_MS;
const isFreeTalkTurn =
  recordingMode === "conversation" || currentFlowStep === "FIRST_FREE_TALK";
const sampleStatus =
  recordingMode === "sustainedVowel" && !sustainedVowelHasMeaningfulSpeech
    ? "failed"
    : recordingMode === "sustainedVowel" && !sustainedVowelHasEnoughSpeech
      ? "too_short"
      : isFreeTalkTurn && turnDurationMs < FREE_TALK_MIN_MS
        ? "too_short"
        : "ok";

    if (recordingMode === "sustainedVowel") {
      console.log("[VOICE_CHECK_DEBUG] sustained done duration", {
        recorderState,
        durationMs: turnDurationMs,
        detectedSpeechDurationMs,
        sampleStatus,
        activeRecordingMode: activeRecordingModeRef.current,
        voiceMode: voiceModeRef.current,
        flowStep: currentFlowStep,
        shouldSkipSustainedVowelForSession: shouldSkipSustainedVowelForSession(),
        speechDetectedDuringRecording,
        sustainedVowelHasMeaningfulSpeech,
        sustainedVowelHasEnoughSpeech,
      });
    }

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
      speechDetectedDuringRecording,
      detectedSpeechDurationMs,
      role,
      voiceAnalysisTargetSeniorId,
      hasUser: !!user,
    });

    void (async () => {
      try {
        const saveSamplePromise =
          recordingMode === "sustainedVowel" && turnAudioUri && sampleType
            ? saveChatbotVoiceSample(turnAudioUri, sampleType, sampleStatus)
            : Promise.resolve();

        if (recordingMode !== "sustainedVowel" && turnAudioUri && sampleType) {
          await saveChatbotVoiceSample(turnAudioUri, sampleType, sampleStatus);
        }

        // 'sustainedVowel' (아~~~ 3초 측정) 모드
        if (recordingMode === "sustainedVowel") {
          resetRecorder();
          if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);

          if (!sustainedVowelHasMeaningfulSpeech) {
            console.warn("[SUSTAINED_VOWEL_NO_SPEECH]", {
              durationMs: turnDurationMs,
              detectedSpeechDurationMs,
              retry: sustainedRetryRef.current,
            });

            await retrySustainedVowel("noSpeech");
            return;
          }

          if (!sustainedVowelHasEnoughSpeech) {
            console.warn("[SUSTAINED_VOWEL_TOO_SHORT]", {
              durationMs: turnDurationMs,
              detectedSpeechDurationMs,
              retry: sustainedRetryRef.current,
            });

            await retrySustainedVowel("tooShort");
            return;
          }

          console.log("[VOICE_CHECK_DEBUG] finishVoiceCheck(true) before call", {
            durationMs: turnDurationMs,
            detectedSpeechDurationMs,
          });
          void saveSamplePromise;
          await finishVoiceCheck(true);
          return;
        }

        // recordingMode 가 렌더 경합/포커스 이펙트 churn 으로 null 로 유실돼도,
        // 대화가 활성이고 일반대화(NORMAL_CHAT) 흐름이면 한 턴으로 정상 전송한다.
        // 이 보강이 없으면 mode=null 인 done 오디오를 통째로 버려, 응답 없이
        // "계속 듣기만" 하는 상태(턴 유실)가 된다. (콘솔 [TURN_READY] mode:null 증상)
        // recordingMode 가 직전 턴 cleanup(아래 finally)으로 null 로 churn 돼도, 대화 중이면
        // 턴을 살린다. voiceModeRef 는 finally 가 건드리지 않아 churn 과 무관하게 '대화 턴'을
        // 신뢰성 있게 식별한다(홈 화면 대화처럼 flowStep 이 IDLE 로 남는 경로도 포함).
        // sustainedVowel 턴은 이 지점 위에서 이미 처리되므로 여기 걸리지 않는다.
        const isConversationTurn =
          recordingMode === "conversation" ||
          (conversationActiveRef.current &&
            (voiceModeRef.current === "conversation" ||
              flowStepRef.current === "NORMAL_CHAT"));
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
        const result = await sendVoiceMessage(turnAudioUri, turnDurationMs, { recordingEndAt });
        console.log("[SEND_VOICE_MESSAGE_DONE]", result);

        // 업로드가 끝난 뒤에 녹음기를 초기화한다(타이머·웹 VAD 모니터·autoStoppingRef
        // 리셋, 상태 idle). 그래야 다음 턴 녹음이 깔끔하게 새로 시작되고 자동정지가
        // 정상 동작한다. 전송 전에 부르면 blob URL이 revoke돼 업로드가 깨지므로 반드시 이후.
        resetRecorder();

        if (result === "empty") {
          handleSilentConversationTurn();
        } else if (result === "ok") {
          silenceRetryRef.current = 0;
        }
      } catch (err) {
        console.error("[VOICE_TURN_ERROR]", err);
        resetRecorder();
      } finally {
        const isSustainedRetryRecording =
          recordingMode === "sustainedVowel" &&
          voiceModeRef.current === "sustainedVowel";

        if (
          activeRecordingModeRef.current === recordingMode &&
          !isSustainedRetryRecording
        ) {
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
  }, [
    clearAudio,
    detectedSpeechDurationMs,
    durationMs,
    resetRecorder,
    recorderState,
    speechDetectedDuringRecording,
  ]);

  useEffect(() => {
    if (
      activeRecordingModeRef.current !== "sustainedVowel" ||
      recorderState !== "recording" ||
      detectedSpeechDurationMs < SUSTAINED_VOWEL_TARGET_MS ||
      sustainedCompletionStopRequestedRef.current
    ) {
      return;
    }

    console.log("[VOICE_CHECK_DEBUG] detectedSpeechDurationMs target reached", {
      detectedSpeechDurationMs,
      recorderState,
      flowStep: flowStepRef.current,
    });
    sustainedCompletionStopRequestedRef.current = true;
    if (sustainedStopTimeoutRef.current) {
      clearTimeout(sustainedStopTimeoutRef.current);
      sustainedStopTimeoutRef.current = null;
    }
    console.log("[VOICE_CHECK_DEBUG] stopRecording before call", {
      detectedSpeechDurationMs,
      recorderState,
    });
    void stopRecording();
  }, [detectedSpeechDurationMs, recorderState, stopRecording]);

  useEffect(() => {
    if (
      !isConversationActive ||
      !noSpeechDetected ||
      showConversationResultRef.current ||
      chatState === "completed" ||
      voiceModeRef.current !== "conversation"
    ) {
      return;
    }

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

    handleSilentConversationTurn();
  }, [botReply, isConversationActive, noSpeechDetected, resetRecorder, speakText]);

  useEffect(() => {
    if (
      !isConversationActive ||
      !noSpeechDetected ||
      showConversationResultRef.current ||
      chatState === "completed" ||
      voiceModeRef.current !== "sustainedVowel" ||
      sustainedRetryInProgressRef.current
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

    void retrySustainedVowel("noSpeech");
  }, [chatState, isConversationActive, noSpeechDetected, resetRecorder]);

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

      completeConversationAndShowResult("voice");
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

    console.log("[NEXT_LISTEN_AFTER_BOT]");
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
      if (shouldSkipSustainedVowelForSession()) {
        await startNormalChatWithoutSustainedVowel();
        return;
      }

      flowStepRef.current = "GREETING";
      setFlowStep("GREETING");
      const greeting = getTimeBasedVoiceCheckGreeting();
      const firstReply = `${greeting} '아' 소리 3초만 해볼게요, 셋, 둘, 하나.`;

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

      // 복귀 인사(대화 유도)도 세션 대화기록에 남긴다(비차단).
      void appendAssistantMessage(reply);

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
        console.log("[CHATBOT_SCREEN_CLEANUP]", {
          recorderState: recorderStateRef.current,
          recordingMode: activeRecordingModeRef.current,
          submitting: submittingTranscriptRef.current,
        });
        void endConversationSession();
        resetConversationSession({ blockAutoRestart: true });
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
    if (role !== "elder" || !hasUserInteracted || autoStartedRef.current) return;

    resetConversationSession();

    autoStartedRef.current = true;
    lastAutoGreetingRef.current = Date.now();

    conversationActiveRef.current = true;
    setIsConversationActive(true);

    void startFirstGreeting();
  }, [hasUserInteracted, startFirstGreeting, role]);

  async function handleStartConversation() {
    console.log("[START_BUTTON_CLICKED]");

    await endConversationSession();
    resetConversationSession();

    autoStartedRef.current = true;
    lastAutoGreetingRef.current = Date.now();

    conversationActiveRef.current = true;
    setIsConversationActive(true);

    void startFirstGreeting();
  }

  function handleEndConversationByButton() {
    if (
      !isConversationActive ||
      voiceModeRef.current === "sustainedVowel" ||
      activeRecordingModeRef.current === "sustainedVowel" ||
      flowStepRef.current === "SUSTAINED_VOWEL_RECORDING"
    ) {
      return;
    }

    console.log("[END_CONVERSATION_BUTTON_CLICKED]", {
      recorderState: recorderStateRef.current,
      flowStep: flowStepRef.current,
    });

    void stopSpeaking();
    conversationActiveRef.current = false;
    conversationRunningRef.current = false;
    voiceModeRef.current = null;
    activeRecordingModeRef.current = null;
    finishActionPendingRef.current = false;
    silenceRetryRef.current = 0;
    sustainedRetryInProgressRef.current = false;

    if (wakeTimeoutRef.current) {
      clearTimeout(wakeTimeoutRef.current);
      wakeTimeoutRef.current = null;
    }
    if (sustainedStopTimeoutRef.current) {
      clearTimeout(sustainedStopTimeoutRef.current);
      sustainedStopTimeoutRef.current = null;
    }
    if (listeningStartTimeoutRef.current) {
      clearTimeout(listeningStartTimeoutRef.current);
      listeningStartTimeoutRef.current = null;
    }
    listeningStartPendingRef.current = false;

    if (recorderStateRef.current === "recording") {
      void stopRecording().catch((error) => {
        console.warn("[END_CONVERSATION_STOP_RECORDING_FAILED]", error);
      });
    }

    resetRecorder();
    completeConversationAndShowResult("button");
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
      return false;
    }
    if (listeningStartPendingRef.current) {
      console.log("[LISTEN_SKIP] start already pending");
      return false;
    }
    if (
      isBotSpeakingRef.current ||
      isBotTypingRef.current ||
      bubbleDisplayInProgressRef.current ||
      botLineSpeakingRef.current
    ) {
      console.log("[LISTEN_SKIP] bot speaking");
      return false;
    }
    if (
      recorderStateRef.current === "recording" ||
      recorderStateRef.current === "processing"
    ) {
      console.log("[LISTEN_SKIP] recorder busy:", recorderStateRef.current);
      return false;
    }

    listeningStartPendingRef.current = true;
    voiceModeRef.current = "conversation";
    console.log("[VOICE_MODE_SET]", voiceModeRef.current);
    activeRecordingModeRef.current = "conversation";
    console.log("[RECORDING_MODE_SET]", activeRecordingModeRef.current);

    setBotEmotion("listening");
    setChatState("listening");

    listeningStartTimeoutRef.current = setTimeout(() => {
      listeningStartTimeoutRef.current = null;

      if (
        !conversationActiveRef.current ||
        voiceModeRef.current !== "conversation" ||
        recorderStateRef.current === "recording" ||
        recorderStateRef.current === "processing" ||
        isBotSpeakingRef.current ||
        isBotTypingRef.current ||
        bubbleDisplayInProgressRef.current ||
        botLineSpeakingRef.current
      ) {
        listeningStartPendingRef.current = false;
        console.log("[START_RECORDING_SKIP] bot still speaking or inactive");
        return;
      }

      console.log("[START_RECORDING]", voiceModeRef.current);
      void startRecording(1500).finally(() => {
        listeningStartPendingRef.current = false;
      });
    }, 350);
    return true;
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
    void stopSpeaking();
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
    normalChatStartedRef.current = false;
    setFlowStep("IDLE");
    resetRecorder();

    router.push(recordHref);
  }

  function handleResultHome() {
    void endConversationSession();
    resetConversationSession({ blockAutoRestart: true });
  }

  const showGuardianNotice = false;
  const isSustainedVowelUi =
    flowStep === "SUSTAINED_VOWEL_RECORDING" ||
    flowStepRef.current === "SUSTAINED_VOWEL_RECORDING" ||
    voiceModeRef.current === "sustainedVowel" ||
    activeRecordingModeRef.current === "sustainedVowel";
  const isVoiceCheckUi =
    flowStep === "GREETING" ||
    flowStep === "VOICE_CHECK_INTRO" ||
    flowStep === "VOICE_CHECK_DONE" ||
    flowStepRef.current === "GREETING" ||
    flowStepRef.current === "VOICE_CHECK_INTRO" ||
    flowStepRef.current === "VOICE_CHECK_DONE" ||
    isSustainedVowelUi;
  const showEndConversationButton =
    isConversationActive &&
    !showConversationResult &&
    chatState !== "completed" &&
    chatState !== "error" &&
    !isVoiceCheckUi;

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
  // 하단 탭바(BottomNav) 영역 위에 버튼들이 오도록 충분히 bottom 오프셋 설정 (마진 상향)
  const recordBottom = navTopGap + Math.max(24, Math.round(24 * v));
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
          pressed && (!isConversationActive || showEndConversationButton) && styles.pressed,
          isConversationActive &&
            !showEndConversationButton &&
            styles.conversationButtonDisabled,
        ]}
        onPress={
          showEndConversationButton
            ? handleEndConversationByButton
            : handleStartConversation
        }
        disabled={isConversationActive && !showEndConversationButton}
        accessibilityRole="button"
        accessibilityLabel={
          showEndConversationButton
            ? "대화 종료"
            : isConversationActive
              ? "모아가 듣고 있어요"
              : "모아와 대화 시작하기"
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
            {showEndConversationButton
              ? "대화 종료"
              : isConversationActive
                ? "듣고 있어요..."
                : "모아와 대화 시작하기"}
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
    right: 0,
    bottom: 0,
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
    alignSelf: "stretch",
    fontFamily: "Jua",
    color: "#3B2318",
    fontSize: 24,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    flexWrap: "wrap",
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
    zIndex: 25,
    elevation: 25,
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
    zIndex: 25,
    elevation: 25,
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

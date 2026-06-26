import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Share } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, Share2, ChevronRight, MessageCircle, Bell } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { CharacterPlayer, type CharacterMood } from "./CharacterPlayer";
import { ResultComplete } from "./ResultComplete";
import { MicIcon } from "./icons/MicIcon";
import { Waveform } from "./Waveform";
import { useAuthStore } from "../stores/authStore";
import { useInteractionStore } from "../stores/interactionStore";
import { useWakeWordStore } from "../stores/wakeWordStore";
import * as authApi from "../api/auth";
import { replyToMedicationReminder } from "../api/medication";
import { useMedicationStore } from "../stores/medicationStore";
import * as Notifications from "expo-notifications";
import { useMoaChat } from "../features/chatbot/useMoaChat";
import { useRecorder } from "../features/record/useRecorder";
import { detectVoiceCommand } from "../features/chatbot/wakeWord";

type ChatState =
  | "idle"
  | "waitingCommand"
  | "botSpeaking"
  | "listening"
  | "thinking"
  | "completed"
  | "error";

type VoiceMode = "wake" | "waitingCommand" | "conversation" | null;

const SHOW_STT_DEBUG =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_STT_DEBUG === "true";

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

function chatStateToMood(state: ChatState, botEmotion: BotEmotion): CharacterMood {
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

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
  const wakePrompt = useWakeWordStore((s) => s.wakePrompt);
  const clearWakePrompt = useWakeWordStore((s) => s.clearWakePrompt);

  const hasStoredUserInteracted = useInteractionStore((s) => s.hasUserInteracted);
  const hasUserInteracted = fromIntro === "true" || hasStoredUserInteracted;
  const respondToLocalMedication = useMedicationStore((s) => s.respond);

  const { height: windowHeight } = useWindowDimensions();

  const [chatState, setChatState] = useState<ChatState>("idle");
  const [botEmotion, setBotEmotion] = useState<BotEmotion>("default");
  const [botReply, setBotReply] = useState<string>("오늘은 어떤 하루였나요?");
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [lastRecognizedText, setLastRecognizedText] = useState("");
  const [showConversationResult, setShowConversationResult] = useState(false);

  const {
    messages,
    isBotTyping,
    isBotSpeaking,
    botEmotion: liveBotEmotion,
    route,
    clearRoute,
    sendMessage,
    speakText,
    nextAction,
  } = useMoaChat();

  const {
    state: recorderState,
    transcript,
    durationMs,
    permissionDenied,
    error: recorderError,
    noSpeechDetected,
    start: startRecording,
    reset: resetRecorder,
  } = useRecorder({ autoStopOnSilence: true });

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
  const voiceModeRef = useRef<VoiceMode>(null);
  const wakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVoiceTextRef = useRef<string | null>(null);
  const silenceRetryRef = useRef(0);
  const lastPromptRef = useRef("");
  const greetingInProgressRef = useRef(false);
  const autoStartedRef = useRef(false);
  const medicationReminderIdRef = useRef<string | null>(null);
  const localMedicationIdRef = useRef<string | null>(null);
  const medicationAutoStartedRef = useRef<string | null>(null);

  const mood = chatStateToMood(chatState, botEmotion);
  const recordHref = role === "guardian" ? "/(guardian)/record" : "/(elder)/record";
  const resultHref = role === "guardian" ? "/(guardian)/report" : "/(elder)/history";

  useEffect(() => {
    if (!route) return;
    clearRoute();
    if (route === "/record") router.push(recordHref);
    else router.push(resultHref);
  }, [clearRoute, recordHref, resultHref, route, router]);

  useEffect(() => {
    if (!wakePrompt) return;
    setBotReply(wakePrompt);
    setBotEmotion("happy");
    clearWakePrompt();
  }, [clearWakePrompt, wakePrompt]);

  function streamReplyCharacters() {
    if (typewriterTimerRef.current) return;

    const writeNextCharacter = () => {
      if (displayedReplyRef.current.length >= streamedReplyRef.current.length) {
        typewriterTimerRef.current = null;
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

  function handleChatTurn(text: string, turnDurationMs: number) {
    const command = detectVoiceCommand(text);

    if (routeVoiceCommand(command)) {
      voiceModeRef.current = null;
      conversationActiveRef.current = false;
      setIsConversationActive(false);
      setChatState("idle");
      return;
    }

    voiceModeRef.current = null;
    silenceRetryRef.current = 0;
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    setChatState("thinking");
    void sendMessage(text, { duration_ms: turnDurationMs });
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
      if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
    },
    [],
  );

 useFocusEffect(
  useCallback(() => {
    conversationRunningRef.current = false;
    conversationActiveRef.current = false;
    submittingTranscriptRef.current = false;
    turnCountRef.current = 0;

    setIsConversationActive(false);
    setChatState("idle");
    setBotEmotion("default");
    setBotReply("오늘은 어떤 하루였나요?");
    setShowConversationResult(false);

    return () => {
      voiceModeRef.current = null;
      conversationRunningRef.current = false;
      conversationActiveRef.current = false;
      submittingTranscriptRef.current = false;
    };
  }, []),
);

  async function handleMedicationReminderAnswer(text: string) {
    const localMedicationId = localMedicationIdRef.current;
    const reminderId = medicationReminderIdRef.current;

    if (!reminderId && !localMedicationId) return;

    greetingInProgressRef.current = true;
    setChatState("thinking");

    if (localMedicationId) {
      const outcome = respondToLocalMedication(localMedicationId, text);

      const reply =
        outcome === "completed"
          ? "잘하셨어요. 체크해둘게요."
          : outcome === "reminder_scheduled"
            ? "그럼 약 드시고 말씀해주세요. 10분 뒤에 한 번 더 알려드릴게요."
            : "드셨는지 아직 못 드셨는지만 말씀해주세요.";

      if (outcome === "reminder_scheduled") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "복약 재알림",
            body: "약 드실 시간이에요. 드셨으면 모아에게 말씀해주세요.",
            data: {
              localMedicationId,
              isRetry: true,
              medicationPrompt:
                "약 드실 시간이에요. 드셨으면 모아에게 말씀해주세요.",
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 600,
            repeats: false,
          },
        });
      }

      lastPromptRef.current = reply;
      setBotReply(reply);
      setBotEmotion(outcome === "completed" ? "happy" : "default");
      setChatState("botSpeaking");

      await speakText(reply);

      if (outcome === "completed") localMedicationIdRef.current = null;

      greetingInProgressRef.current = false;

      if (conversationActiveRef.current) beginConversationListening();

      return;
    }

    if (!reminderId) return;

    try {
      const result = await replyToMedicationReminder(reminderId, text);

      lastPromptRef.current = result.reply;
      setBotReply(result.reply);
      setBotEmotion(result.status === "COMPLETED" ? "happy" : "default");
      setChatState("botSpeaking");

      await speakText(result.reply);

      if (result.status === "COMPLETED") {
        medicationReminderIdRef.current = null;
      }
    } catch {
      medicationReminderIdRef.current = null;
      handleChatTurn(text, durationMs);
      return;
    } finally {
      greetingInProgressRef.current = false;
    }

    if (conversationActiveRef.current) beginConversationListening();
  }

  useEffect(() => {
    const text = transcript?.trim();

    if (!text) {
      submittingTranscriptRef.current = false;
      return;
    }

    if (submittingTranscriptRef.current) return;

    submittingTranscriptRef.current = true;

    if (SHOW_STT_DEBUG) setLastRecognizedText(text);

    resetRecorder();

    const mode = voiceModeRef.current;

    if (mode === "conversation") {
      if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);

      if (medicationReminderIdRef.current || localMedicationIdRef.current) {
        void handleMedicationReminderAnswer(text);
        return;
      }

      handleChatTurn(text, durationMs);
      return;
    }

    submittingTranscriptRef.current = false;
  }, [durationMs, resetRecorder, transcript]);

  useEffect(() => {
    if (
      !isConversationActive ||
      !noSpeechDetected ||
      voiceModeRef.current !== "conversation"
    ) {
      return;
    }

    if (silenceRetryRef.current >= 1) {
      voiceModeRef.current = null;
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
    setBotReply(prompt);
    setChatState("botSpeaking");
    void speakText(prompt);
  }, [botReply, isConversationActive, noSpeechDetected, resetRecorder, speakText]);

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
    streamedReplyRef.current = lastBotMessage.text;
    lastPromptRef.current = lastBotMessage.text;
    displayedReplyRef.current = "";
    typewriterDelayRef.current = lastBotMessage.typingDelayMs ?? 48;

    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    setBotReply("");
    setBotEmotion(lastBotMessage.emotion ?? liveBotEmotion);
    streamReplyCharacters();
    setChatState("botSpeaking");
  }, [isConversationActive, liveBotEmotion, messages]);

  useEffect(() => {
    if (
      !isConversationActive ||
      chatState !== "botSpeaking" ||
      isBotTyping ||
      isBotSpeaking ||
      greetingInProgressRef.current
    ) {
      return;
    }

    if (nextAction === "finish") {
      voiceModeRef.current = null;
      conversationActiveRef.current = false;
      setIsConversationActive(false);
      setChatState("completed");
      setBotEmotion("clapping");
      setShowConversationResult(true);
      return;
    }

    setChatState("listening");
    beginConversationListening();
  }, [chatState, isBotSpeaking, isBotTyping, isConversationActive, nextAction]);

  const startFirstGreeting = useCallback(async () => {
    if (conversationRunningRef.current) return;

    conversationRunningRef.current = true;
    greetingInProgressRef.current = true;

    try {
      const firstReply = "안녕하세요. 오늘은 어떤 하루였나요?";

      silenceRetryRef.current = 0;
      lastPromptRef.current = firstReply;
      setBotReply(firstReply);
      setBotEmotion("happy");
      setChatState("botSpeaking");

      await speakText(firstReply);

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
      lastPromptRef.current = prompt;
      setBotReply(prompt);
      setBotEmotion("happy");
      setChatState("botSpeaking");

      await speakText(prompt);

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

    medicationAutoStartedRef.current = triggerId;
    voiceModeRef.current = null;
    resetRecorder();
    conversationActiveRef.current = true;
    setIsConversationActive(true);

    void startMedicationReminderConversation();
  }, [
    localMedicationId,
    medicationReminderId,
    resetRecorder,
    startMedicationReminderConversation,
  ]);

  useEffect(() => {
    if (!startedFromIntro || autoStartedRef.current) return;

    autoStartedRef.current = true;
    voiceModeRef.current = null;
    resetRecorder();
    conversationActiveRef.current = true;
    setIsConversationActive(true);

    void startFirstGreeting();
  }, [resetRecorder, startFirstGreeting, startedFromIntro]);

  function handleStartConversation() {
    voiceModeRef.current = null;
    resetRecorder();
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    setShowConversationResult(false);

    void startFirstGreeting();
  }

  function beginConversationListening() {
    console.log("[LISTEN] active:", conversationActiveRef.current, "recorder:", recorderState);

    if (!conversationActiveRef.current) return;
    if (recorderState === "recording" || recorderState === "processing") return;

    voiceModeRef.current = "conversation";
    resetRecorder();
    setBotEmotion("listening");
    setChatState("listening");

    setTimeout(() => {
      void startRecording();
    }, 80);
  }

  function handleConversationVoice() {
    if (
      chatState !== "botSpeaking" &&
      chatState !== "thinking" &&
      recorderState !== "recording"
    ) {
      beginConversationListening();
    }
  }

  function handleGoToRecord() {
    conversationRunningRef.current = false;
    setChatState("idle");
    setBotEmotion("default");
    conversationActiveRef.current = false;
    setIsConversationActive(false);
    setShowConversationResult(false);
    resetRecorder();
    router.push(recordHref);
  }

  function handleResultHome() {
    conversationRunningRef.current = false;
    conversationActiveRef.current = false;
    submittingTranscriptRef.current = false;
    voiceModeRef.current = null;
    setShowConversationResult(false);
    setIsConversationActive(false);
    setChatState("idle");
    setBotEmotion("default");
    setBotReply("오늘은 어떤 하루였나요?");
    resetRecorder();
  }

  const showGuardianNotice = false;

  const [pendingInvites, setPendingInvites] = useState<authApi.PendingInvite[]>([]);

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

  if (showConversationResult) {
    return (
      <ResultComplete
        type="conversation"
        onHome={handleResultHome}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={["#F7D6AC", "#FFF2DE", "#F8CFA4"]}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={["rgba(247,214,172,0)", "rgba(247,214,172,0.72)", "#F7D6AC"]}
        locations={[0, 0.58, 1]}
        style={[styles.navBackdrop, { pointerEvents: 'none' }]}
      />

      <View style={[styles.header, { top: headerTop }]}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>6월 17일 (화)</Text>
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
              style={[styles.speechBubbleShape, { pointerEvents: 'none' }]}
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
              style={[styles.speechSparkle, styles.speechSparkleLeft, { pointerEvents: 'none' }]}
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
              style={[styles.speechSparkle, styles.speechSparkleRight, { pointerEvents: 'none' }]}
            >
              <Path
                d="M 9 0 V 7 M 2 3 L 7 7 M 16 3 L 11 7"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </Svg>

            <Text style={styles.speechText}>{botReply}</Text>
          </Pressable>

          {recorderState === "recording" && (
            <View style={styles.recordingStatusBar}>
              <Waveform color="#6F9C62" animated />
              <Text style={styles.recordingTime}>
                {formatDuration(durationMs)}
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
            pointerEvents: 'none',
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
        colors={["#F7D6AC", "rgba(247,214,172,0.92)", "rgba(247,214,172,0)"]}
        locations={[0, topFadeStop, 1]}
        style={[styles.characterTopFade, { height: topFadeHeight, pointerEvents: 'none' }]}
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

import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Share } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserPlus, Clock, Share2, ChevronRight, MessageCircle } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { CharacterPlayer, type CharacterMood } from "./CharacterPlayer";
import { MicIcon } from "./icons/MicIcon";
import { Waveform } from "./Waveform";
import { useAuthStore } from "../stores/authStore";
import { useInteractionStore } from "../stores/interactionStore";
import * as authApi from "../api/auth";
import { useMoaChat } from "../features/chatbot/useMoaChat";
import { useRecorder } from "../features/record/useRecorder";
import { detectVoiceCommand } from "../features/chatbot/wakeWord";

type ChatState = "idle" | "waitingCommand" | "botSpeaking" | "listening" | "thinking" | "completed" | "error";
type VoiceMode = "wake" | "waitingCommand" | "conversation" | null;

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
  const { fromIntro, voiceText, voiceDurationMs } = useLocalSearchParams<{
    fromIntro?: string;
    voiceText?: string;
    voiceDurationMs?: string;
  }>();
  const insets = useSafeAreaInsets();

  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const links = useAuthStore((s) => s.links);

  const hasStoredUserInteracted = useInteractionStore((s) => s.hasUserInteracted);
  const hasUserInteracted = fromIntro === "true" || hasStoredUserInteracted;

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [chatState, setChatState] = useState<ChatState>("idle");
  const [botEmotion, setBotEmotion] = useState<BotEmotion>("default");
  const [botReply, setBotReply] = useState<string>("오늘은 어떤 하루였나요?");
  const [isConversationActive, setIsConversationActive] = useState(false);
  const { messages, isBotTyping, isBotSpeaking, botEmotion: liveBotEmotion, route, clearRoute, sendMessage, speakText } = useMoaChat();
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

  const mood = chatStateToMood(chatState, botEmotion);
  const recordHref = role === "guardian" ? "/(guardian)/record" : "/(elder)/record";
  const resultHref = role === "guardian" ? "/(guardian)/report" : "/(elder)/history";

  useEffect(() => {
    if (!route) return;
    clearRoute();
    if (route === "/record") router.push(recordHref);
    else router.push(resultHref);
  }, [clearRoute, recordHref, resultHref, route, router]);

  function streamReplyCharacters() {
    if (typewriterTimerRef.current) return;

    const writeNextCharacter = () => {
      if (displayedReplyRef.current.length >= streamedReplyRef.current.length) {
        typewriterTimerRef.current = null;
        return;
      }
      displayedReplyRef.current = streamedReplyRef.current.slice(0, displayedReplyRef.current.length + 1);
      setBotReply(displayedReplyRef.current);
      typewriterTimerRef.current = setTimeout(writeNextCharacter, typewriterDelayRef.current);
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

  // The app-level listener routes ordinary wake-word speech here so it uses the existing chat/TTS flow.
  useEffect(() => {
    const text = voiceText?.trim();
    if (!text || text === lastVoiceTextRef.current) return;
    lastVoiceTextRef.current = text;
    handleChatTurn(text, Number(voiceDurationMs) || 0);
  }, [voiceDurationMs, voiceText]);

  useEffect(() => () => {
    if (typewriterTimerRef.current) clearTimeout(typewriterTimerRef.current);
    if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
  }, []);

  // 탭 화면은 기록 화면으로 이동해도 메모리에 남아 있을 수 있다.
  // 홈으로 다시 돌아올 때는 언제나 기본 홈 상태로 복원해 대화 시작 버튼을 다시 보여 준다.
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
      resetRecorder();
      return () => {
        voiceModeRef.current = null;
        resetRecorder();
      };
    }, []),
  );

  useEffect(() => {
    const text = transcript?.trim();
    if (!text) {
      // 녹음기를 초기화한 뒤 다음 발화를 전송할 수 있게 잠금을 푼다.
      if (!text) submittingTranscriptRef.current = false;
      return;
    }
    // sendMessage/resetRecorder의 참조가 렌더마다 바뀌어도 동일 전사는 한 번만 보낸다.
    if (submittingTranscriptRef.current) return;
    submittingTranscriptRef.current = true;

    resetRecorder();
    const mode = voiceModeRef.current;
    if (mode === "conversation") {
      if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
      handleChatTurn(text, durationMs);
      return;
    }
    submittingTranscriptRef.current = false;
  }, [durationMs, resetRecorder, transcript]);

  useEffect(() => {
    if (!isConversationActive || !noSpeechDetected || voiceModeRef.current !== "conversation") return;

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

    const lastBotMessage = [...messages].reverse().find((message) => message.role === "bot");
    if (!lastBotMessage || lastBotMessage.id === lastBotMessageIdRef.current) return;

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
    if (!isConversationActive || chatState !== "botSpeaking" || isBotTyping || isBotSpeaking) return;
    setChatState("listening");
    beginConversationListening();
  }, [chatState, isBotSpeaking, isBotTyping, isConversationActive]);

  const startFirstGreeting = useCallback(async () => {
    if (conversationRunningRef.current) return;

    conversationRunningRef.current = true;

    try {
      const firstReply = "안녕하세요. 오늘은 어떤 하루였나요?";

      silenceRetryRef.current = 0;
      lastPromptRef.current = firstReply;
      setBotReply(firstReply);
      setBotEmotion("happy");
      setChatState("botSpeaking");

      await wait(3500);

      setChatState("listening");
      beginConversationListening();
    } catch {
      setChatState("error");
      await wait(1200);
      setChatState("idle");
      conversationActiveRef.current = false;
      setIsConversationActive(false);
    } finally {
      conversationRunningRef.current = false;
    }
  }, []);

  function handleStartConversation() {
    voiceModeRef.current = null;
    resetRecorder();
    conversationActiveRef.current = true;
    setIsConversationActive(true);
    void startFirstGreeting();
  }

  function beginConversationListening() {
    if (!conversationActiveRef.current) return;
    if (recorderState === "recording" || recorderState === "processing") return;

    voiceModeRef.current = "conversation";
    resetRecorder();
    setBotEmotion("listening");
    setChatState("listening");
    void startRecording();
  }

  function handleConversationVoice() {
    // 대화 모드에서는 자동으로 듣기와 전송이 이어진다. 권한 오류 뒤 재시도할 때만 누른다.
    if (chatState !== "botSpeaking" && chatState !== "thinking" && recorderState !== "recording") {
      beginConversationListening();
    }
  }

  function handleGoToRecord() {
    conversationRunningRef.current = false;
    setChatState("idle");
    setBotEmotion("default");
    conversationActiveRef.current = false;
    setIsConversationActive(false);
    resetRecorder();
    router.push(recordHref);
  }

  // ACTIVE 연결이 없을 때는 아직 사용되지 않은 직접사용자 초대 코드를 안내한다.
  const hasActive = links.some((l) => l.status === "ACTIVE");
  // 챗봇 메인은 보호자·직접사용자 모두 동일한 대화 화면을 사용한다.
  // 초대/연결 관리는 가족 및 설정 화면에서 처리한다.
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

  const W = Math.min(windowWidth, 430);
  const H = windowHeight;
  const v = H / 900;

  const headerTop = insets.top + Math.round(42 * v);
  const bubbleTop = insets.top + Math.round(94 * v);
  const characterTop = insets.top + Math.round(184 * v);
  const navTopGap = Math.max(92 + insets.bottom, Math.round(92 * v) + insets.bottom);
  const characterHeight = H - characterTop - navTopGap;
  const recordBottom = Math.max(9, Math.round(9 * v));
  const topFadeHeight = characterTop + Math.round(74 * v);
  const topFadeStop = characterTop / topFadeHeight;
  const characterVideoTopOffset = Math.round(170 * v);

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={["#F7D6AC", "#FFF2DE", "#F8CFA4"]}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(247,214,172,0)", "rgba(247,214,172,0.72)", "#F7D6AC"]}
        locations={[0, 0.58, 1]}
        style={styles.navBackdrop}
      />

      <View style={[styles.header, { top: headerTop }]}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>6월 17일 (화)</Text>
        </View>
      </View>

      {showGuardianNotice ? (
        <View style={[styles.noticeWrap, { top: bubbleTop }]}>
          {pendingInvites.length === 0 ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>부모님을 연결해 주세요</Text>
              <Text style={styles.noticeBody}>
                등록 후 초대 코드를 전달하면 가족 탭에서 함께 살펴볼 수 있어요.
              </Text>

              <Pressable
                style={styles.noticePrimaryBtn}
                onPress={() => router.push("/onboarding")}
                accessibilityRole="button"
              >
                <UserPlus size={20} color="#FFFFFF" />
                <Text style={styles.noticePrimaryText}>부모님 연결하기</Text>
              </Pressable>
            </View>
          ) : (
            pendingInvites.map((invite) => {
              const who = invite.seniorName ?? "부모님";

              return (
                <View key={invite.token} style={styles.noticeCard}>
                  <View style={styles.noticeHead}>
                    <Clock size={20} color="#E8943A" strokeWidth={2.4} />
                    <Text style={styles.noticePendTitle}>{who} 초대 대기</Text>
                  </View>

                  <Text style={styles.noticeCode}>{invite.token}</Text>

                  <Pressable
                    style={styles.noticeReshareBtn}
                    onPress={() => reshareInvite(invite)}
                    accessibilityRole="button"
                  >
                    <Share2 size={18} color="#FF7955" />
                    <Text style={styles.noticeReshareText}>초대 코드 재공유</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      ) : (
        <View style={[styles.speechBubbleWrap, { top: bubbleTop }]}>
          <Pressable
            style={styles.speechBubble}
            onPress={handleConversationVoice}
            disabled={!isConversationActive || recorderState === "processing" || chatState === "botSpeaking" || chatState === "thinking"}
            accessibilityRole={isConversationActive ? "button" : undefined}
            accessibilityLabel={isConversationActive ? "모아가 듣고 있어요. 말씀을 마치면 자동으로 전송됩니다" : undefined}
          >
          <Svg
            pointerEvents="none"
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={styles.speechBubbleShape}
          >
            <Path
              d="M 12 0 H 88 C 94.6 0 100 13.5 100 30 V 64 C 100 79.5 94.6 92 88 92 H 60 C 56 92 55 97 50 97 C 45 97 44 92 40 92 H 12 C 5.4 92 0 79.5 0 64 V 30 C 0 13.5 5.4 0 12 0 Z"
              fill="#FFFCF8"
            />
          </Svg>
          <Svg pointerEvents="none" width={18} height={18} viewBox="0 0 18 18" style={[styles.speechSparkle, styles.speechSparkleLeft]}>
            <Path d="M 9 0 V 7 M 2 3 L 7 7 M 16 3 L 11 7" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
          </Svg>
          <Svg pointerEvents="none" width={18} height={18} viewBox="0 0 18 18" style={[styles.speechSparkle, styles.speechSparkleRight]}>
            <Path d="M 9 0 V 7 M 2 3 L 7 7 M 16 3 L 11 7" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
          </Svg>
            <Text style={styles.speechText}>{botReply}</Text>
          </Pressable>
          {recorderState === "recording" && (
            <View style={styles.recordingStatusBar}>
              <Waveform color="#6F9C62" animated />
              <Text style={styles.recordingTime}>{formatDuration(durationMs)}</Text>
            </View>
          )}
        </View>
      )}

      <View
        pointerEvents="none"
        style={[
          styles.characterWrap,
          {
            left: 0,
            right: 0,
            top: characterTop,
            height: characterHeight,
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
        pointerEvents="none"
        colors={["#F7D6AC", "rgba(247,214,172,0.92)", "rgba(247,214,172,0)"]}
        locations={[0, topFadeStop, 1]}
        style={[styles.characterTopFade, { height: topFadeHeight }]}
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
        <ChevronRight style={styles.buttonChevron} size={26} color="#5B4636" strokeWidth={2.2} />
      </Pressable>

      {!isConversationActive && (
        <Pressable
          style={({ pressed }) => [
            styles.conversationButton,
            { bottom: recordBottom + 90 },
            pressed && styles.pressed,
          ]}
          onPress={handleStartConversation}
          accessibilityRole="button"
          accessibilityLabel="모아와 대화 시작하기"
        >
          <View style={styles.conversationIconWrap}>
            <MessageCircle size={32} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.8} />
            <View style={styles.conversationIconDots}>
              <View style={styles.conversationIconDot} />
              <View style={styles.conversationIconDot} />
              <View style={styles.conversationIconDot} />
            </View>
          </View>
          <View style={styles.conversationTextWrap}>
            <Text style={styles.conversationTitle}>모아와 대화 시작하기</Text>
          </View>
          <ChevronRight style={styles.buttonChevron} size={26} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      )}
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
  speechBubble: {
    width: "100%",
    minHeight: 70,
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
    backgroundColor: "#355A8A",
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
    backgroundColor: "#355A8A",
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

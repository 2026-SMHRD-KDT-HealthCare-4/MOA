import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Send } from "lucide-react-native";
import { BellIcon } from "../components/icons/BellIcon";
import { useMoaChat, type ChatMessage } from "../features/chatbot/useMoaChat";
import { useRecorder } from "../features/record/useRecorder";
import { MoaAvatar } from "../components/MoaAvatar";
import type { BotEmotion } from "../constants/emotionMap";

const INTRO_GREETING_MS = 2500;
const THINKING_MIN_MS = 2000;
const THINKING_MAX_MS = 3000;
const BOT_TALKING_MIN_MS = 3000;
const BOT_TALKING_MAX_MS = 4500;

type AvatarState = {
  emotion: BotEmotion;
  isTalking: boolean;
};

function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{text}</Text>
      </View>
    </View>
  );
}

function BotBubble({ text, emotion = "default" }: { text: string; emotion?: BotEmotion }) {
  const isWorried = emotion === "worried";
  const isHappy = emotion === "happy" || emotion === "clapping";

  return (
    <View style={styles.botRow}>
      <View
        style={[
          styles.botBubble,
          isWorried && styles.botBubbleWorried,
          isHappy && styles.botBubbleHappy,
        ]}
      >
        <Text style={[styles.botText, isWorried && styles.botTextWorried]}>{text}</Text>
      </View>
    </View>
  );
}

function TypingDots() {
  return (
    <View style={styles.botRow}>
      <View style={[styles.botBubble, styles.typingBubble]}>
        <Text style={styles.typingText}>모아가 생각하고 있어요…</Text>
      </View>
    </View>
  );
}

function estimateTalkingMs(text: string) {
  return Math.min(9000, Math.max(3200, text.length * 95));
}

export default function ChatPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // 아바타를 화면 절반 정도 크기로 — 너비 60% 기준, 높이 40%로 상한.
  const avatarSize = Math.round(Math.min(Math.min(windowWidth, 430) * 0.6, windowHeight * 0.4));
  // ── 챗봇 로직 (변경 금지) ──────────────────────────────
  const { messages, isBotTyping, botEmotion, sendMessage } = useMoaChat();
  const { state: recorderState } = useRecorder();
  const [input, setInput] = useState("");
  const [showIntroGreeting, setShowIntroGreeting] = useState(true);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingMinElapsed, setThinkingMinElapsed] = useState(false);
  const [isBotTalking, setIsBotTalking] = useState(false);
  const [talkingMinElapsed, setTalkingMinElapsed] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastBotMessageIdRef = useRef<string | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTalkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTalkingFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  }
  // ──────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setShowIntroGreeting(false), INTRO_GREETING_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isBotTyping) {
      setShowThinking(true);
      setThinkingMinElapsed(false);

      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
      }
      if (thinkingFallbackTimerRef.current) {
        clearTimeout(thinkingFallbackTimerRef.current);
      }
      thinkingTimerRef.current = setTimeout(() => {
        setThinkingMinElapsed(true);
        thinkingTimerRef.current = null;
      }, THINKING_MIN_MS);
      thinkingFallbackTimerRef.current = setTimeout(() => {
        setShowThinking(false);
        thinkingFallbackTimerRef.current = null;
      }, THINKING_MAX_MS);
    }
  }, [isBotTyping]);

  useEffect(() => {
    if (!showThinking || isBotTyping || !thinkingMinElapsed) return;
    setShowThinking(false);
  }, [isBotTyping, showThinking, thinkingMinElapsed]);

  useEffect(() => {
    const lastBotMessage = [...messages].reverse().find((message) => message.role === "bot");
    if (!lastBotMessage || lastBotMessage.id === lastBotMessageIdRef.current) return;

    lastBotMessageIdRef.current = lastBotMessage.id;
    setShowThinking(false);
    setThinkingMinElapsed(false);
    setIsBotTalking(true);
    setTalkingMinElapsed(false);

    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    if (thinkingFallbackTimerRef.current) {
      clearTimeout(thinkingFallbackTimerRef.current);
      thinkingFallbackTimerRef.current = null;
    }
    if (botTalkingTimerRef.current) {
      clearTimeout(botTalkingTimerRef.current);
    }
    if (botTalkingFallbackTimerRef.current) {
      clearTimeout(botTalkingFallbackTimerRef.current);
    }
    const talkingMs = estimateTalkingMs(lastBotMessage.text);

    botTalkingTimerRef.current = setTimeout(() => {
      setTalkingMinElapsed(true);
      botTalkingTimerRef.current = null;
    }, Math.min(BOT_TALKING_MIN_MS, talkingMs));
    botTalkingFallbackTimerRef.current = setTimeout(() => {
      setIsBotTalking(false);
      botTalkingFallbackTimerRef.current = null;
    }, Math.max(BOT_TALKING_MAX_MS, talkingMs));
  }, [messages]);

  useEffect(() => {
    if (!isBotTalking || !talkingMinElapsed) return;
    setIsBotTalking(false);
  }, [isBotTalking, talkingMinElapsed]);

  useEffect(() => {
    return () => {
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
      }
      if (thinkingFallbackTimerRef.current) {
        clearTimeout(thinkingFallbackTimerRef.current);
      }
      if (botTalkingTimerRef.current) {
        clearTimeout(botTalkingTimerRef.current);
      }
      if (botTalkingFallbackTimerRef.current) {
        clearTimeout(botTalkingFallbackTimerRef.current);
      }
    };
  }, []);

  function handleActiveVideoLoop(state: AvatarState) {
    if (state.emotion === "thinking" && !state.isTalking && thinkingMinElapsed) {
      setShowThinking(false);
    }
    if (state.isTalking && talkingMinElapsed) {
      setIsBotTalking(false);
    }
  }

  function resolveAvatarState(): AvatarState {
    if (recorderState === "recording") {
      return { emotion: "listening", isTalking: false };
    }
    if (isBotTalking) {
      return { emotion: botEmotion, isTalking: true };
    }
    if (showThinking) {
      return { emotion: "thinking", isTalking: false };
    }
    if (showIntroGreeting && messages.length === 0) {
      return { emotion: "default", isTalking: false };
    }
    if (messages.length === 0) {
      return { emotion: "default", isTalking: false };
    }
    return { emotion: botEmotion, isTalking: false };
  }

  const renderItem = ({ item }: { item: ChatMessage }) =>
    item.role === "user" ? (
      <UserBubble text={item.text} />
    ) : (
      <BotBubble text={item.text} emotion={item.emotion} />
    );
  const avatarState = resolveAvatarState();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={["#FFF9F1", "#FFFDF9"]} style={StyleSheet.absoluteFill} />

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityLabel="뒤로 가기"
        >
          <ArrowLeft size={22} color="#39302C" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={styles.spark} />
          <Text style={styles.topTitle}>오늘의 대화</Text>
          <View style={styles.spark} />
        </View>
        <View style={styles.iconBtn}>
          <BellIcon />
        </View>
      </View>

      {/* 아바타 */}
      <View style={styles.avatarSection}>
        <MoaAvatar
          emotion={avatarState.emotion}
          isTalking={avatarState.isTalking}
          size={avatarSize}
          showOnlineDot={false}
          onActiveVideoLoop={handleActiveVideoLoop}
        />
        <Text style={styles.avatarName}>모아</Text>
      </View>

      {/* 메시지 목록 */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={styles.msgList}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          messages.length === 0 ? (
            <View style={styles.welcomeWrap}>
              <Text style={styles.welcomeText}>
                안녕하세요!{"\n"}오늘 어떻게 지내셨나요?{"\n"}편하게 이야기해 주세요 😊
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={isBotTyping ? <TypingDots /> : null}
      />

      {/* 입력 바 */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="메시지를 입력해 주세요"
          placeholderTextColor="#9A887D"
          multiline
          maxLength={200}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnOff]}
          onPress={handleSend}
          disabled={!input.trim()}
          activeOpacity={0.8}
          accessibilityLabel="메시지 보내기"
        >
          <Send size={22} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    height: 72,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  iconBtn: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  spark: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#F3AE62",
  },
  topTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#39302C",
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(99,78,67,0.16)",
  },
  avatarName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#40332D",
  },
  msgList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    flexGrow: 1,
  },
  welcomeWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  welcomeText: {
    fontSize: 20,
    color: "#765E52",
    textAlign: "center",
    lineHeight: 32,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  userBubble: {
    maxWidth: "78%",
    backgroundColor: "#93B878",
    borderRadius: 23,
    borderBottomRightRadius: 7,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  userText: {
    fontSize: 18,
    color: "#FFFFFF",
    lineHeight: 25,
    fontWeight: "700",
  },
  botRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  botBubble: {
    maxWidth: "78%",
    backgroundColor: "#FFFFFF",
    borderRadius: 23,
    borderBottomLeftRadius: 7,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: "#715346",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  botBubbleHappy: {
    backgroundColor: "#FFF6DE",
    borderWidth: 1,
    borderColor: "#F5D38B",
  },
  botBubbleWorried: {
    backgroundColor: "#FFF3F0",
    borderWidth: 1,
    borderColor: "#F2B8AA",
  },
  botText: {
    fontSize: 18,
    color: "#342C28",
    lineHeight: 25,
    fontWeight: "700",
    textAlign: "center",
  },
  botTextWorried: {
    color: "#6F342C",
  },
  typingBubble: { opacity: 0.75 },
  typingText: {
    fontSize: 16,
    color: "#765E52",
    fontStyle: "italic",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(99,78,67,0.16)",
    backgroundColor: "rgba(255,253,250,0.98)",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 56,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#E6D9D2",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: "#342C28",
    backgroundColor: "white",
  },
  sendBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D65738",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnOff: {
    backgroundColor: "#E6D9D2",
    shadowOpacity: 0,
    elevation: 0,
  },
});

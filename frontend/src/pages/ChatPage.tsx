import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Send } from "lucide-react-native";
import { BellIcon } from "../components/icons/BellIcon";
import { useMoaChat, type ChatMessage } from "../features/chatbot/useMoaChat";
import { MoaAvatar } from "../components/MoaAvatar";

function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{text}</Text>
      </View>
    </View>
  );
}

function BotBubble({ text }: { text: string }) {
  return (
    <View style={styles.botRow}>
      <View style={styles.botBubble}>
        <Text style={styles.botText}>{text}</Text>
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

export default function ChatPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // ── 챗봇 로직 (변경 금지) ──────────────────────────────
  const { messages, isBotTyping, botEmotion, sendMessage } = useMoaChat();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  }
  // ──────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: ChatMessage }) =>
    item.role === "user" ? <UserBubble text={item.text} /> : <BotBubble text={item.text} />;

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
        <MoaAvatar emotion={botEmotion} size={80} showOnlineDot={false} />
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
  botText: {
    fontSize: 18,
    color: "#342C28",
    lineHeight: 25,
    fontWeight: "700",
    textAlign: "center",
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

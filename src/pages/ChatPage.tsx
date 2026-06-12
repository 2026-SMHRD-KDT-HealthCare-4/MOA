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
import { ArrowLeft, Send } from "lucide-react-native";
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
  const { messages, isBotTyping, botEmotion, sendMessage } = useMoaChat();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  }

  const renderItem = ({ item }: { item: ChatMessage }) =>
    item.role === "user" ? <UserBubble text={item.text} /> : <BotBubble text={item.text} />;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityLabel="뒤로 가기"
        >
          <ArrowLeft size={22} color="#756a66" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>모아와 대화하기</Text>
        <View style={styles.iconBtn} />
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
          placeholderTextColor="#c4b5ae"
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
    backgroundColor: "#FAF7F2",
  },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e2",
  },
  iconBtn: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4d403b",
    letterSpacing: 0.5,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e2",
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff7f4",
    borderWidth: 2,
    borderColor: "#ffd4d1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 44,
  },
  avatarName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4d403b",
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
    color: "#a18f88",
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
    backgroundColor: "#FF706D",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userText: {
    fontSize: 18,
    color: "white",
    lineHeight: 26,
  },
  botRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 8,
  },
  botBubble: {
    maxWidth: "78%",
    backgroundColor: "white",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  botText: {
    fontSize: 18,
    color: "#362b27",
    lineHeight: 26,
  },
  typingBubble: {
    opacity: 0.75,
  },
  typingText: {
    fontSize: 16,
    color: "#a18f88",
    fontStyle: "italic",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0e8e2",
    backgroundColor: "#FAF7F2",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 56,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#e8ddd9",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: "#292321",
    backgroundColor: "white",
  },
  sendBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FF706D",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnOff: {
    backgroundColor: "#e8ddd9",
    shadowOpacity: 0,
    elevation: 0,
  },
});

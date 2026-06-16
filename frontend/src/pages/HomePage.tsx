import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, MessageCircle } from "lucide-react-native";
import { CharacterPlayer } from "../components/CharacterPlayer";
import { MicIcon } from "../components/icons/MicIcon";

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const W = Math.min(windowWidth, 430);
  const H = windowHeight;
  const s = W / 430;
  const v = H / 900;

  const bubbleTop = insets.top + Math.round(118 * v);
  const characterTop = insets.top + Math.round(126 * v);
  const characterSize = Math.round(Math.min(W * 1.68, 700) * Math.max(0.98, Math.min(1.08, v)));
  const recordBottom = Math.max(52, Math.round(54 * v));
  const chatBottom = -Math.round(7 * v);

  return (
    <View style={styles.fill}>
      <LinearGradient colors={["#FFF3DD", "#FFF8EE", "#FFF1DA"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 22 }]}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>6월 17일 (화)</Text>
          <Text style={styles.greetingText}>오늘도 잘 부탁드려요! </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="알림 없음"
        >
          <Bell size={22} color="#3B2318" strokeWidth={2.2} />
          <Text style={styles.noticeText}>알림 없음</Text>
        </Pressable>
      </View>

      <View style={[styles.speechBubble, { top: bubbleTop }]}>
        <View style={styles.speechHighlight} />
        <View style={styles.speechShade} />
        <Text style={styles.speechText}>오늘도{"\n"}목소리 들려주세요</Text>
        <View style={styles.speechTail} />
        <View style={styles.speechTailShade} />
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.characterWrap,
          {
            top: characterTop,
            width: characterSize,
            height: characterSize,
            marginLeft: -characterSize / 2,
          },
        ]}
      >
        <CharacterPlayer mood="idle" size={characterSize} circular={false} />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.recordButton,
          { bottom: recordBottom },
          pressed && styles.pressed,
        ]}
        onPress={() => router.push("/(elder)/record")}
        accessibilityRole="button"
        accessibilityLabel="녹음하기, 오늘의 문장 읽기 30초"
      >
        <View style={styles.recordButtonHighlight} />
        <View style={styles.recordButtonShade} />
        <View style={styles.recordIconWrap}>
          <MicIcon color="#FFFFFF" size={31} />
        </View>
        <View style={styles.recordTextWrap}>
          <Text style={styles.recordTitle}>녹음하기</Text>
          <Text style={styles.recordSub}>오늘의 문장 읽기 (30초)</Text>
        </View>
      </Pressable>

      <View style={[styles.chatWrap, { bottom: chatBottom }]}>
        <Pressable
          style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
          onPress={() => router.push("/chat")}
          accessibilityRole="button"
          accessibilityLabel="모아와 대화하기"
        >
          <View style={styles.chatButtonHighlight} />
          <MessageCircle size={34} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.chatDots}>•••</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    zIndex: 10,
  },
  dateBlock: {
    flex: 1,
    gap: 8,
  },
  dateText: {
    color: "#3B2318",
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
  },
  greetingText: {
    color: "#668D5F",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  noticeButton: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.64)",
    borderWidth: 1.5,
    borderColor: "rgba(117,76,42,0.18)",
    boxShadow: "0 8px 20px rgba(83, 46, 24, 0.08)",
  },
  noticeText: {
    color: "#3B2318",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  speechBubble: {
    position: "absolute",
    left: 74,
    right: 74,
    minHeight: 74,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 5,
    overflow: "visible",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    boxShadow: "0 18px 32px rgba(100, 56, 31, 0.14)",
  },
  speechHighlight: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 8,
    height: 22,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.58)",
  },
  speechShade: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 5,
    height: 14,
    borderRadius: 14,
    backgroundColor: "rgba(120,71,38,0.035)",
  },
  speechText: {
    color: "#3B2318",
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "900",
    textAlign: "center",
  },
  speechTail: {
    position: "absolute",
    left: 92,
    bottom: -11,
    width: 24,
    height: 24,
    borderBottomLeftRadius: 8,
    backgroundColor: "rgba(255,255,255,0.94)",
    transform: [{ rotate: "45deg" }],
  },
  speechTailShade: {
    position: "absolute",
    left: 94,
    bottom: -13,
    width: 24,
    height: 24,
    borderBottomLeftRadius: 8,
    backgroundColor: "rgba(120,71,38,0.035)",
    transform: [{ rotate: "45deg" }],
    zIndex: -1,
  },
  characterWrap: {
    position: "absolute",
    left: "50%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  recordButton: {
    position: "absolute",
    left: 54,
    right: 54,
    height: 72,
    borderRadius: 29,
    backgroundColor: "#FF7657",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    zIndex: 8,
    overflow: "hidden",
    boxShadow: "0 13px 22px rgba(214, 87, 56, 0.24)",
  },
  recordButtonHighlight: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 6,
    height: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  recordButtonShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 7,
    backgroundColor: "rgba(185,61,36,0.18)",
  },
  recordIconWrap: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  recordTextWrap: {
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 5,
  },
  recordTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "900",
  },
  recordSub: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    opacity: 0.96,
  },
  chatWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 20,
  },
  chatButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#78A56F",
    borderWidth: 5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxShadow: "0 9px 17px rgba(72, 106, 63, 0.24)",
  },
  chatButtonHighlight: {
    position: "absolute",
    top: 6,
    left: 10,
    right: 10,
    height: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  chatDots: {
    position: "absolute",
    color: "#78A56F",
    fontSize: 12,
    lineHeight: 12,
    fontWeight: "900",
    marginTop: 4,
  },
});

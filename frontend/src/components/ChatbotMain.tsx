import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CharacterPlayer } from "./CharacterPlayer";
import { MicIcon } from "./icons/MicIcon";
import { useAuthStore } from "../stores/authStore";

// 음성 챗봇 메인 — 직접사용자/보호자 공통(스펙 §2: 메인 챗봇 화면 공통 컴포넌트).
// 보호자도 같은 화면에서 자기 음성 체크인을 한다.
// 역할별로 녹음 화면 경로만 분기(나머지 동작은 동일, 회귀 없음).
export default function ChatbotMain() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const recordHref = role === "guardian" ? "/(guardian)/record" : "/(elder)/record";

  const W = Math.min(windowWidth, 430);
  const H = windowHeight;
  const s = W / 430;
  const v = H / 900;

  const headerTop = insets.top + Math.round(42 * v);
  const bubbleTop = insets.top + Math.round(134 * v);
  const characterTop = insets.top + Math.round(176 * v);
  const navTopGap = Math.max(92 + insets.bottom, Math.round(92 * v) + insets.bottom);
  const characterHeight = H - characterTop - navTopGap;
  const recordBottom = Math.max(9, Math.round(9 * v));
  const topFadeHeight = characterTop + Math.round(74 * v);
  const topFadeStop = characterTop / topFadeHeight;

  return (
    <View style={styles.fill}>
      <LinearGradient colors={["#F7D6AC", "#FFF2DE", "#F8CFA4"]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(247,208,164,0)", "rgba(247,208,164,0.78)", "#FFF0DD"]}
        locations={[0, 0.52, 1]}
        style={styles.navBackdrop}
      />

      <View style={[styles.header, { top: headerTop }]}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>6월 17일 (화)</Text>
          <Text style={styles.greetingText}>오늘도 모아와 함께해요</Text>
        </View>
      </View>

      <View style={[styles.speechBubble, { top: bubbleTop }]}>
        <Text style={styles.speechText}>오늘도{"\n"}목소리 들려주세요</Text>
        <View style={styles.speechTail} />
      </View>

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
          mood="idle"
          containerStyle={{
            left: 0,
            right: 0,
            top: 0,
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
        onPress={() => router.push(recordHref)}
        accessibilityRole="button"
        accessibilityLabel="녹음하러가기, 오늘의 목소리를 남겨요"
      >
        <View style={styles.recordButtonHighlight} />
        <View style={styles.recordIconWrap}>
          <MicIcon color="#FFFFFF" size={32} />
        </View>
        <View style={styles.recordTextWrap}>
          <Text style={styles.recordTitle}>녹음하러가기</Text>
          <Text style={styles.recordSub}>오늘의 목소리를 남겨요</Text>
        </View>
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
    height: 220,
    zIndex: 6,
  },
  header: {
    position: "absolute",
    left: 53,
    right: 32,
    zIndex: 10,
  },
  dateBlock: {
    gap: 7,
  },
  dateText: {
    color: "#3B2318",
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
  },
  greetingText: {
    color: "#668D5F",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  speechBubble: {
    position: "absolute",
    left: 62,
    right: 62,
    minHeight: 86,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.87)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    zIndex: 7,
    overflow: "visible",
    boxShadow: "0 18px 38px rgba(95, 55, 30, 0.09)",
  },
  speechText: {
    color: "#3B2318",
    fontSize: 24,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  speechTail: {
    position: "absolute",
    left: 47,
    bottom: -13,
    width: 27,
    height: 27,
    borderBottomLeftRadius: 5,
    backgroundColor: "rgba(255,255,255,0.87)",
    transform: [{ rotate: "45deg" }],
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
    left: 70,
    right: 70,
    height: 68,
    borderRadius: 25,
    backgroundColor: "#FF765A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    zIndex: 15,
    overflow: "hidden",
    boxShadow: "0 15px 26px rgba(214, 87, 56, 0.22)",
  },
  recordButtonHighlight: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 6,
    height: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  recordIconWrap: {
    width: 39,
    height: 39,
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
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
  },
  recordSub: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "700",
    opacity: 0.96,
  },
});

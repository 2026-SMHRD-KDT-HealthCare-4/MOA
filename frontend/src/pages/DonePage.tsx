import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CharacterPlayer } from "../components/CharacterPlayer";
import { SunIcon } from "../components/icons/SunIcon";
import { MicIcon } from "../components/icons/MicIcon";
import { useAuthStore } from "../stores/authStore";

export default function DonePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // 녹음은 직접사용자/보호자 공통 → 역할별 경로로 복귀.
  const recordHref = role === "guardian" ? "/(guardian)/record" : "/(elder)/record";
  const homeHref = role === "guardian" ? "/(guardian)/" : "/(elder)/";

  const W = Math.min(windowWidth, 430);
  const H = windowHeight;
  const s = W / 430;
  const v = H / 900;

  const charLeft         = Math.round(40 * s);
  const charTop          = Math.round(70  * v) + insets.top;
  const charHeight       = Math.round(390 * v);
  const charBorderRadius = Math.round(160 * s);
  const cardBottom       = Math.round(118 * v) + insets.bottom;

  return (
    <View style={styles.fill}>
      <LinearGradient colors={["#FFF9F1", "#FFFDF9", "#F9E6D4"]} style={StyleSheet.absoluteFill} />

      {/* 제목 */}
      <Text style={[styles.resultTitle, { marginTop: insets.top + 28 }]}>오늘의 결과</Text>

      {/* 하트 장식 */}
      <Text style={[styles.heart, { top: Math.round(150 * v) + insets.top }]}>♥</Text>

      {/* 캐릭터 */}
      <CharacterPlayer
        mood="happy"
        containerStyle={{
          left:         charLeft,
          right:        charLeft,
          top:          charTop,
          height:       charHeight,
          borderRadius: charBorderRadius,
        }}
      />

      {/* 피드백 카드 */}
      <View style={[styles.feedbackCard, { bottom: cardBottom }]}>
        <View style={styles.feedbackHeadline}>
          <SunIcon />
          <Text style={styles.feedbackText}>오늘 목소리는{"\n"}맑은 편이에요!</Text>
        </View>
        <Text style={styles.feedbackSub}>
          오늘 목소리를 들려주셔서 고마워요.{"\n"}내일도 이야기해 주실 거죠?
        </Text>
      </View>

      {/* 녹음 다시 하기 */}
      <Pressable
        style={({ pressed }) => [
          styles.recordAgainBtn,
          { bottom: cardBottom - 74, left: 18, right: 18 },
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
        onPress={() => router.replace(recordHref)}
        accessibilityLabel="다시 녹음하기"
      >
        <MicIcon color="#FFFFFF" size={28} />
        <Text style={styles.recordAgainText}>다시 녹음하기</Text>
      </Pressable>

      {/* 처음으로 */}
      <Pressable
        style={[styles.restartBtn, { top: insets.top + 24, right: 18 }]}
        onPress={() => router.replace(homeHref)}
        accessibilityRole="button"
      >
        <Text style={styles.restartText}>처음으로</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  resultTitle: {
    color: "#3D342F",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    zIndex: 2,
  },
  heart: {
    position: "absolute",
    left: 28,
    color: "#FF7B64",
    fontSize: 34,
    zIndex: 3,
  },

  feedbackCard: {
    position: "absolute",
    left: 22, right: 22,
    minHeight: 145,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 20,
    shadowColor: "#6A4B3C",
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  feedbackHeadline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  feedbackText: {
    color: "#3B332F",
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "900",
  },
  feedbackSub: {
    marginTop: 12,
    color: "#71625A",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },

  recordAgainBtn: {
    position: "absolute",
    height: 74,
    borderRadius: 23,
    backgroundColor: "#FF7955",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    shadowColor: "#D65738",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  recordAgainText: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
  },

  restartBtn: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 4,
  },
  restartText: {
    color: "#8D796D",
    fontSize: 13,
    fontWeight: "700",
  },
});

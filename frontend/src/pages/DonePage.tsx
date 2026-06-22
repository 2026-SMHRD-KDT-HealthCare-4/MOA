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
  const charTop          = Math.round(76  * v) + insets.top;
  const charHeight       = Math.round(350 * v);
  const charBorderRadius = Math.round(132 * s);
  const cardBottom       = Math.round(225 * v) + insets.bottom;
  // TODO: replace with record-history comparison from the report API.
  const resultDetails = "지난 검사와 비슷해요.\n특별한 변화는 없어요.\n내일도 모아와 이야기해요.";
  const comparisonText = "";
  const recordStatusText = "처음으로 가기";

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
          <View>
            <Text style={styles.feedbackPrimary}>오늘 목소리는</Text>
            <Text style={styles.feedbackAccent}>맑은 편이에요!</Text>
          </View>
          <Text style={styles.feedbackText}>오늘 목소리는{"\n"}맑은 편이에요!</Text>
        </View>
        <Text style={styles.feedbackSub}>
          오늘 목소리를 들려주셔서 고마워요.{"\n"}내일도 이야기해 주실 거죠?
        </Text>
        <Text style={styles.resultDetails}>{resultDetails}</Text>
        <Text style={styles.comparisonText}>{comparisonText}</Text>
        <Text style={styles.completeText}>오늘 음성 분석이 정상적으로 완료되었어요.</Text>
      </View>

      {/* 녹음 다시 하기 */}
      <Pressable
        style={({ pressed }) => [
          styles.recordAgainBtn,
          { bottom: cardBottom - 92, left: 18, right: 18 },
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
        accessibilityLabel="홈으로 돌아가기"
      >
        <Text style={styles.statusLabel}>{recordStatusText}</Text>
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
    left: 16, right: 16,
    minHeight: 225,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 28,
    paddingVertical: 24,
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
    display: "none",
    color: "#3B332F",
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "900",
  },
  feedbackPrimary: {
    color: "#3B332F",
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
  },
  feedbackAccent: {
    color: "#FF765A",
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "900",
  },
  feedbackSub: {
    display: "none",
    marginTop: 12,
    color: "#71625A",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "600",
  },
  comparisonText: {
    display: "none",
    marginTop: 9,
    color: "#668D5F",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  completeText: {
    display: "none",
    marginTop: 8,
    color: "#9A887D",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  resultDetails: {
    marginTop: 22,
    color: "#5B4B43",
    fontSize: 18,
    lineHeight: 33,
    fontWeight: "700",
    textAlign: "center",
  },

  recordAgainBtn: {
    position: "absolute",
    height: 80,
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
    display: "none",
    fontSize: 13,
    fontWeight: "700",
  },
  statusLabel: {
    color: "#8D796D",
    fontSize: 14,
    fontWeight: "700",
  },
});

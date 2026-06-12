import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../src/stores/authStore";
import { CharacterPlayer } from "../src/components/CharacterPlayer";
import { TouchIcon } from "../src/components/icons/TouchIcon";

export default function IntroScreen() {
  const router = useRouter();
  const { isLoggedIn, role } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // team_design 기준치 430×900 대비 비율로 동적 계산
  const W = Math.min(windowWidth, 430);
  const H = windowHeight;
  const s = W / 430;
  const v = H / 900;

  const charLeft         = Math.round(38 * s);
  const charTop          = Math.round(205 * v) + insets.top;
  const charHeight       = Math.round(390 * v);
  const charBorderRadius = Math.round(160 * s);
  const bubbleBottom     = Math.round(114 * v) + insets.bottom;
  const hintBottom       = Math.round(28 * v)  + insets.bottom;
  const logoPaddingTop   = Math.round(64 * v)  + insets.top;

  function handleTouch() {
    if (isLoggedIn) {
      router.replace(role === "guardian" ? "/(guardian)/" : "/(elder)/");
    } else {
      router.push("/(auth)/login");
    }
  }

  return (
    <Pressable
      style={styles.fill}
      onPress={handleTouch}
      accessibilityRole="button"
      accessibilityLabel="화면을 터치하면 대화를 시작해요"
    >
      <LinearGradient colors={["#FFF8EE", "#FFFDF9", "#F8E5D2"]} style={StyleSheet.absoluteFill} />

      {/* 로고 */}
      <View style={[styles.logoWrap, { paddingTop: logoPaddingTop }]}>
        <Text style={styles.logo}>MOA</Text>
        <Text style={styles.tagline}>목소리로 돌보는 오늘의 나</Text>
      </View>

      {/* 캐릭터 */}
      <CharacterPlayer
        mood="idle"
        containerStyle={{
          left:         charLeft,
          right:        charLeft,
          top:          charTop,
          height:       charHeight,
          borderRadius: charBorderRadius,
        }}
      />

      {/* 말풍선 */}
      <View style={[styles.introBubble, { bottom: bubbleBottom }]}>
        <Text style={styles.introGreeting}>안녕하세요.</Text>
        <Text style={styles.introQuestion}>오늘은 어떤 하루였나요?</Text>
      </View>

      {/* 터치 힌트 */}
      <View style={[styles.touchHint, { bottom: hintBottom }]}>
        <Text style={styles.touchText}>화면을 터치하면{"\n"}대화를 시작해요</Text>
        <TouchIcon />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill:    { flex: 1 },
  logoWrap: { alignItems: "center", zIndex: 3 },
  logo:    { color: "#513329", fontSize: 54, fontWeight: "900", letterSpacing: 3 },
  tagline: { color: "#765E52", fontSize: 15, fontWeight: "600", marginTop: 2 },

  introBubble: {
    position: "absolute",
    left: 24, right: 24,
    paddingVertical: 22,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    shadowColor: "#7C513B",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  introGreeting: { color: "#40332D", fontSize: 19, fontWeight: "800", marginBottom: 7 },
  introQuestion: { color: "#40332D", fontSize: 21, fontWeight: "800" },

  touchHint: {
    position: "absolute",
    left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  touchText: {
    color: "#5E5048",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "600",
  },
});

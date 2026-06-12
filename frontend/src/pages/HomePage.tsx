import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CharacterPlayer } from "../components/CharacterPlayer";
import { Waveform } from "../components/Waveform";
import { MicIcon } from "../components/icons/MicIcon";
import { BellIcon } from "../components/icons/BellIcon";

const GREETING = "오늘 하루는\n어떠셨어요?";

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const W = Math.min(windowWidth, 430);
  const H = windowHeight;
  const s = W / 430;
  const v = H / 900;

  const charLeft         = Math.round(22 * s);
  const charTop          = Math.round(190 * v) + insets.top;
  const charBottom       = Math.round(14  * v);
  const charBorderRadius = Math.round(150 * s);
  const bubbleTop        = insets.top + Math.round(92 * v);
  const cardBottom       = Math.round(102 * v);

  return (
    <View style={styles.fill}>
      <LinearGradient colors={["#FFF9F1", "#FFFDF9"]} style={StyleSheet.absoluteFill} />

      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTitleRow}>
          <View style={styles.spark} />
          <Text style={styles.headerTitle}>오늘의 대화</Text>
          <View style={styles.spark} />
        </View>
        <BellIcon />
      </View>

      {/* 인사 말풍선 (우상단) */}
      <View style={[styles.welcomeBubble, { top: bubbleTop }]}>
        <Text style={styles.welcomeText}>{GREETING}</Text>
        <View style={styles.bubbleTail} />
      </View>

      {/* 캐릭터 */}
      <CharacterPlayer
        mood="idle"
        containerStyle={{
          left:         charLeft,
          right:        charLeft,
          top:          charTop,
          bottom:       charBottom,
          borderRadius: charBorderRadius,
        }}
      />

      {/* 듣는 중 카드 */}
      <View style={[styles.listeningCard, { bottom: cardBottom }]}>
        <Waveform color="#76A96C" />
        <Text style={styles.listeningText}>모아와 대화해요</Text>
      </View>

      {/* 녹음하기 버튼 */}
      <Pressable
        style={({ pressed }) => [
          styles.recordBtn,
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
        onPress={() => router.push("/(elder)/record")}
        accessibilityLabel="녹음하기"
      >
        <MicIcon color="#FFFFFF" size={34} />
        <Text style={styles.recordBtnText}>녹음하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
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
  headerTitle: {
    color: "#39302C",
    fontSize: 17,
    fontWeight: "800",
  },

  welcomeBubble: {
    position: "absolute",
    right: 26,
    width: 190,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    zIndex: 4,
    shadowColor: "#715346",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  welcomeText: {
    color: "#342C28",
    fontSize: 22,
    lineHeight: 32,
    fontWeight: "800",
    textAlign: "center",
  },
  bubbleTail: {
    position: "absolute",
    right: 18,
    bottom: -10,
    width: 22, height: 22,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "45deg" }],
  },

  listeningCard: {
    position: "absolute",
    left: 56, right: 56,
    height: 62,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    zIndex: 6,
    shadowColor: "#715346",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  listeningText: {
    color: "#5A504A",
    fontSize: 14,
    fontWeight: "700",
  },

  recordBtn: {
    position: "absolute",
    left: 18, right: 18,
    bottom: 14,
    height: 74,
    borderRadius: 23,
    backgroundColor: "#FF7955",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    zIndex: 8,
    shadowColor: "#D65738",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  recordBtnText: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
  },
});

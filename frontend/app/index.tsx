import { View, Text, TouchableWithoutFeedback, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/stores/authStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoaAvatar } from "../src/components/MoaAvatar";

export default function IntroScreen() {
  const router = useRouter();
  const { isLoggedIn, role } = useAuthStore();
  const insets = useSafeAreaInsets();

  function handleTouch() {
    if (isLoggedIn) {
      // 로그인 상태 → 역할별 홈으로 이동
      router.replace(role === "guardian" ? "/(guardian)/" : "/(elder)/");
    } else {
      // 비로그인 → 로그인 화면으로 이동
      router.push("/(auth)/login");
    }
  }

  return (
    <TouchableWithoutFeedback onPress={handleTouch} accessibilityLabel="화면을 터치해 주세요">
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* 상단 로고 */}
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>moa</Text>
        </View>

        {/* 중앙 아바타 */}
        <View style={styles.avatarArea}>
          <MoaAvatar emotion="greeting" size={220} />
          <Text style={styles.avatarName}>모아</Text>
          <Text style={styles.tagline}>목소리로 건강을 기록하는{"\n"}따뜻한 친구</Text>
        </View>

        {/* 하단 힌트 */}
        <View style={styles.hintArea}>
          <Text style={styles.hint}>화면을 터치해 주세요</Text>
          <Text style={styles.hintDots}>• • •</Text>
        </View>

      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  logoArea: {
    paddingTop: 24,
    alignItems: "center",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FF706D",
    letterSpacing: 4,
  },
  avatarArea: {
    alignItems: "center",
    gap: 16,
  },
  avatarCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#fff7f4",
    borderWidth: 3,
    borderColor: "#ffd4d1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#c97a6e",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 40,
    elevation: 8,
  },
  avatarEmoji: {
    fontSize: 100,
  },
  onlineDot: {
    position: "absolute",
    bottom: 18,
    left: 18,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2ECC71",
    borderWidth: 3,
    borderColor: "white",
  },
  avatarName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#362b27",
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 18,
    color: "#a18f88",
    textAlign: "center",
    lineHeight: 28,
  },
  hintArea: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 24,
  },
  hint: {
    fontSize: 16,
    color: "#c4b5ae",
    fontWeight: "500",
  },
  hintDots: {
    fontSize: 12,
    color: "#d9cdc9",
    letterSpacing: 6,
  },
});

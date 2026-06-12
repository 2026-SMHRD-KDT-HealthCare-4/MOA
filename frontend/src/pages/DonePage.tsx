import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoaAvatar } from "../components/MoaAvatar";
import { Home } from "lucide-react-native";

export default function DonePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>

      <View style={styles.body}>
        <MoaAvatar emotion="happy" size={180} showOnlineDot={false} />

        <View style={styles.textArea}>
          <Text style={styles.title}>잘 기록됐어요! ☀️</Text>
          <Text style={styles.subtitle}>
            오늘 목소리를 들려주셔서 고마워요.{"\n"}내일도 이야기해 주실 거죠?
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.replace("/(elder)/")}
        activeOpacity={0.85}
        accessibilityLabel="홈으로 돌아가기"
      >
        <Home size={22} color="white" />
        <Text style={styles.homeBtnText}>홈으로 돌아가기</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  textArea: {
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#362b27",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 20,
    color: "#a18f88",
    textAlign: "center",
    lineHeight: 32,
  },
  homeBtn: {
    height: 64,
    borderRadius: 18,
    backgroundColor: "#FF706D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  homeBtnText: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
  },
});

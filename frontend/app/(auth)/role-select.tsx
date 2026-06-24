import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeartHandshake, User } from "lucide-react-native";

export default function RoleSelectPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleElder() {
    router.push("/(auth)/elder-consent");
  }

  function handleGuardian() {
    router.push("/(auth)/register");
  }

  function handleLogin() {
    router.push("/(auth)/login");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>moa</Text>
        <Text style={styles.subtitle}>역할을 선택해 주세요</Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.cardElder]}
          onPress={handleElder}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="본인 사용으로 시작하기"
        >
          <View style={[styles.iconWrap, styles.iconWrapElder]}>
            <User size={34} color="#FF7955" strokeWidth={2.2} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>직접 사용</Text>
            <Text style={styles.cardDesc}>목소리로 건강을 기록해요</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardGuardian]}
          onPress={handleGuardian}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="보호자로 시작하기"
        >
          <View style={[styles.iconWrap, styles.iconWrapGuardian]}>
            <HeartHandshake size={34} color="#E8943A" strokeWidth={2.2} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>보호자</Text>
            <Text style={styles.cardDesc}>부모님을 함께 돌봐요</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerHint}>이미 계정이 있으신가요?</Text>
        <TouchableOpacity onPress={handleLogin} activeOpacity={0.7} accessibilityRole="button">
          <Text style={styles.loginLink}>보호자 로그인</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  header: { alignItems: "center", gap: 8, marginTop: 8 },
  logo: { fontSize: 20, fontWeight: "800", color: "#FF7955", letterSpacing: 4, marginBottom: 8 },
  subtitle: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: "#5a4d46" },
  cards: { gap: 18 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    minHeight: 104,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#FFFDFB",
  },
  cardElder: { borderColor: "#F2D9CE" },
  cardGuardian: { borderColor: "#F1DFCB" },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapElder: { backgroundColor: "#FFE9E6" },
  iconWrapGuardian: { backgroundColor: "#FDECDD" },
  cardTextWrap: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#342C28" },
  cardDesc: { fontSize: 16, color: "#765E52", lineHeight: 22 },
  footer: { alignItems: "center", gap: 10 },
  footerDivider: { height: 1, alignSelf: "stretch", backgroundColor: "#EFE3DA", marginBottom: 4 },
  footerHint: { fontSize: 15, color: "#9A887D" },
  loginLink: { fontSize: 16, fontWeight: "800", color: "#FF7955" },
});

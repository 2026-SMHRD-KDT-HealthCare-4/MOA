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

  function handleGuardianInvite() {
    router.push("/(auth)/guardian-invite");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>moa</Text>
        <Text style={styles.title}>어떻게 사용하실까요?</Text>
        <Text style={styles.subtitle}>역할을 선택해 주세요</Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.cardElder]}
          onPress={handleElder}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="직접사용자로 시작하기"
        >
          <View style={[styles.iconWrap, styles.iconWrapElder]}>
            <User size={34} color="#4F5A60" strokeWidth={2.2} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>직접사용자</Text>
            <Text style={styles.cardDesc}>초대 코드를 입력해 가족과 연결해요</Text>
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
            <HeartHandshake size={34} color="#667178" strokeWidth={2.2} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>보호자</Text>
            <Text style={styles.cardDesc}>부모님을 등록하고 함께 돌봐요</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={handleLogin} activeOpacity={0.7}>
          <Text style={styles.loginLink}>
            이미 계정이 있으신가요? <Text style={styles.loginLinkHighlight}>로그인</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleGuardianInvite} activeOpacity={0.7}>
          <Text style={styles.inviteLink}>보호자 초대 코드를 받았어요</Text>
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
  logo: { fontSize: 20, fontWeight: "800", color: "#4F5A60", letterSpacing: 4, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: "#342C28" },
  subtitle: { fontSize: 18, color: "#765E52" },
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
    backgroundColor: "white",
  },
  cardElder: { borderColor: "#CBD5DC", backgroundColor: "#F8FAFC" },
  cardGuardian: { borderColor: "#D8DEE3", backgroundColor: "#FFFFFF" },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapElder: { backgroundColor: "#EEF1F3" },
  iconWrapGuardian: { backgroundColor: "#F3F5F6" },
  cardTextWrap: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#342C28" },
  cardDesc: { fontSize: 16, color: "#765E52", lineHeight: 22 },
  footerLinks: { gap: 10 },
  loginLink: { textAlign: "center", fontSize: 16, color: "#765E52" },
  loginLinkHighlight: { color: "#4F5A60", fontWeight: "700" },
  inviteLink: { textAlign: "center", fontSize: 15, color: "#765E52", fontWeight: "700" },
});

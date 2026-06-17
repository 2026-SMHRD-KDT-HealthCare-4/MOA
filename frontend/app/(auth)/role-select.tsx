import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeartHandshake, User } from "lucide-react-native";

// 앱 최초 진입 역할 선택 (스펙 §4 role-select).
// 큰 버튼 2개 · 색+아이콘+텍스트 병행(색각 이상 대응) · 빨강 미사용.
export default function RoleSelectPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 직접사용자: 생체정보 동의 → 초대코드 클레임 흐름으로 진입.
  function handleElder() {
    router.push("/(auth)/elder-consent");
  }

  // 보호자: 회원가입.
  function handleGuardian() {
    router.push("/(auth)/register");
  }

  // 이미 계정이 있는 경우(보호자 재로그인 등).
  function handleLogin() {
    router.push("/(auth)/login");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>moa</Text>
        <Text style={styles.title}>어떻게 사용하실까요?</Text>
        <Text style={styles.subtitle}>역할을 선택해 주세요</Text>
      </View>

      <View style={styles.cards}>
        {/* 직접사용자 */}
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
            <Text style={styles.cardDesc}>매일 목소리로 건강을 기록해요</Text>
          </View>
        </TouchableOpacity>

        {/* 보호자 */}
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
            <Text style={styles.cardDesc}>가족의 오늘을 곁에서 살펴봐요</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleLogin} activeOpacity={0.7}>
        <Text style={styles.loginLink}>
          이미 계정이 있으신가요?{" "}
          <Text style={styles.loginLinkHighlight}>로그인</Text>
        </Text>
      </TouchableOpacity>
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

  loginLink: { textAlign: "center", fontSize: 16, color: "#765E52" },
  loginLinkHighlight: { color: "#FF7955", fontWeight: "700" },
});

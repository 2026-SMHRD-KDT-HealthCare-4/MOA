import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeartHandshake, User, ChevronRight } from "lucide-react-native";

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
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.panel}>
        <Image
          source={require("../../assets/images/moa-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>역할을 선택해 주세요</Text>
        <Text style={styles.subtitle}>당신의 목소리가 의미가 됩니다</Text>

        <View style={styles.cards}>
          <TouchableOpacity
            style={styles.card}
            onPress={handleElder}
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="본인 사용으로 시작하기"
          >
            <View style={[styles.iconWrap, styles.iconElder]}>
              <User size={36} color="#FF7D68" strokeWidth={2.2} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>직접 사용</Text>
              <Text style={styles.cardDesc}>목소리로 건강을{"\n"}기록해요</Text>
            </View>
            <ChevronRight size={26} color="#FF7D68" strokeWidth={2.2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={handleGuardian}
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="보호자로 시작하기"
          >
            <View style={[styles.iconWrap, styles.iconGuardian]}>
              <HeartHandshake size={36} color="#E8943A" strokeWidth={2.2} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>보호자</Text>
              <Text style={styles.cardDesc}>부모님을 함께{"\n"}돌봐요</Text>
            </View>
            <ChevronRight size={26} color="#E8943A" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <Image
          source={require("../../assets/images/role-select-bg.png")}
          style={styles.waveBg}
          resizeMode="stretch"
        />

        <Image
          source={require("../../assets/images/mascot-wave.png")}
          style={styles.mascot}
          resizeMode="contain"
        />

        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerHint}>이미 계정이 있으신가요?</Text>
          <TouchableOpacity onPress={handleLogin} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.loginLink}>보호자 로그인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFF6ED",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  panel: {
    width: "100%",
    maxWidth: 390,
    minHeight: "100%",
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FAD9CC",
    backgroundColor: "#FFF8F3",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 24,
    alignSelf: "center",
  },
  logo: {
    width: 420,
    height: 280,
    alignSelf: "center",
    marginHorizontal: -37,
    marginTop: -44,
    marginBottom: -30,
  },
  title: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "800",
    color: "#3A2E2A",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B5D57",
    textAlign: "center",
    marginBottom: 28,
  },
  cards: {
    zIndex: 3,
    gap: 15,
  },
  card: {
    height: 116,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F8DED2",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  iconWrap: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconElder: {
    backgroundColor: "#FFE9E4",
  },
  iconGuardian: {
    backgroundColor: "#FFF3E2",
  },
  cardTextWrap: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    color: "#3A2E2A",
  },
  cardDesc: {
    fontSize: 16,
    lineHeight: 24,
    color: "#6B5D57",
  },
  waveBg: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 132,
    width: "100%",
    height: 176,
    zIndex: 1,
  },
  mascot: {
    position: "absolute",
    right: -12,
    bottom: 26,
    width: 270,
    height: 405,
    zIndex: 2,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 43,
    alignItems: "center",
    gap: 7,
    zIndex: 4,
  },
  footerDivider: {
    width: "80%",
    height: 1,
    backgroundColor: "#F1D9CF",
    opacity: 0.8,
    marginBottom: 2,
  },
  footerHint: {
    fontSize: 17,
    lineHeight: 24,
    color: "#9A8B84",
  },
  loginLink: {
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "700",
    color: "#FF7D68",
    textDecorationLine: "underline",
  },
});

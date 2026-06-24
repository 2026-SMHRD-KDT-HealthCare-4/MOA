import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, IdCard, Smartphone } from "lucide-react-native";

// "직접 사용" 진입 허브 — 신규 가입(회원 정보 입력) vs 기존 사용자 재연결을 고른다.
// 음성 데이터 동의는 회원 정보 입력 화면(elder-claim)에서 함께 받는다.
export default function ElderConsentPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ inviteToken?: string }>();

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/role-select");
    }
  }

  function handleStart() {
    router.push({
      pathname: "/(auth)/elder-claim",
      params: { inviteToken: params.inviteToken },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="뒤로 가기">
          <ArrowLeft size={24} color="#756a66" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/moa-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>처음{"\n"}오셨나요?</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleStart}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <IdCard size={22} color="white" strokeWidth={2.2} />
            <Text style={styles.primaryBtnText}>회원 정보 입력하기</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            기존 사용자 또는 기기 변경 시{"\n"}아래를 눌러주세요
          </Text>

          <TouchableOpacity
            style={styles.subBtn}
            onPress={() => router.push("/(auth)/elder-reconnect")}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Smartphone size={20} color="#FF7955" strokeWidth={2.2} />
            <Text style={styles.subBtnText}>재연결 코드 입력하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9F2", overflow: "hidden" },
  topBar: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  backBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  // 상단 정렬로 로고·제목·버튼을 위쪽에 모음.
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "flex-start", gap: 28 },
  header: { alignItems: "center", gap: 8 },
  // 비율 1.5(1536×1024) 고정 크기. marginHorizontal 음수로 화면 폭 넘침 흡수, 위아래 음수로 여백 정리.
  // (aspectRatio 는 rn-web 에서 레이아웃이 깨져 사용하지 않음)
  logo: { width: 420, height: 280, marginHorizontal: -24, marginTop: -16, marginBottom: -16 },
  title: { fontSize: 30, lineHeight: 40, fontWeight: "800", color: "#342C28", textAlign: "center" },
  actions: { gap: 16 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#FF7955",
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtnText: { fontSize: 21, fontWeight: "800", color: "white" },
  hint: { fontSize: 16, lineHeight: 24, color: "#9A887D", textAlign: "center" },
  subBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#F2D2C8",
    backgroundColor: "white",
  },
  subBtnText: { fontSize: 19, fontWeight: "800", color: "#FF7955" },
});

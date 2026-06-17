import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ShieldCheck, Info } from "lucide-react-native";

// 직접사용자 생체정보(음성) 동의 화면.
// 화면 순서상 동의가 먼저(사용자 요구). 동의 의사는 아직 서버에 보내지 않고,
// 다음 화면(초대코드 클레임)으로 넘겨 클레임 성공 직후 함께 제출한다(claim → consent).
// 글자: 본문 18pt+ / 핵심 22pt+, 단일 대형 버튼.
export default function ElderConsentPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleAgree() {
    // 동의 의사를 코드 입력 화면으로 전달(로컬 보관 → 클레임 직후 제출).
    router.push({ pathname: "/(auth)/elder-claim", params: { consented: "1" } });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="뒤로 가기">
          <ArrowLeft size={24} color="#756a66" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>음성 데이터 동의</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroIcon}>
          <ShieldCheck size={34} color="#FF7955" />
        </View>

        <Text style={styles.title}>목소리로 건강을{"\n"}살펴봐도 될까요?</Text>
        <Text style={styles.lead}>
          매일의 목소리에서 변화와 패턴을 감지해, 가족이 안심할 수 있도록 참고 정보로 알려드려요.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardItem}>• 목소리의 변화·패턴을 참고용으로 기록하고 살펴봐요.</Text>
          <Text style={styles.cardItem}>• 녹음한 원음은 분석이 끝나면 바로 지우고, 기기에 저장하지 않아요.</Text>
          <Text style={styles.cardItem}>• 병을 진단하지 않는, 일상 돌봄을 돕는 참고용 서비스예요.</Text>
        </View>

        {/* 주의 안내 — 색만이 아니라 아이콘+텍스트 병행 */}
        <View style={styles.noticeRow}>
          <Info size={22} color="#E8943A" strokeWidth={2.4} />
          <Text style={styles.noticeText}>
            동의는 언제든지 설정에서 다시 멈출 수 있어요.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleAgree} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>동의하고 계속하기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9F2" },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  backBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 18, fontWeight: "800", color: "#4d403b" },
  scroll: { paddingHorizontal: 24, paddingTop: 8, gap: 18 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#FFE9E6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 28, lineHeight: 38, fontWeight: "800", color: "#342C28" },
  lead: { fontSize: 19, lineHeight: 29, color: "#5a4d46" },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    padding: 18,
    gap: 12,
  },
  cardItem: { fontSize: 18, lineHeight: 27, color: "#5a4d46" },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FBEFDD",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  noticeText: { flex: 1, fontSize: 18, lineHeight: 26, fontWeight: "600", color: "#9A6B25" },
  primaryBtn: {
    height: 64,
    borderRadius: 16,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtnText: { fontSize: 22, fontWeight: "800", color: "white" },
});

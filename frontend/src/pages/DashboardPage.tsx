import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, ChevronRight, TrendingUp, Calendar } from "lucide-react-native";

// mock 데이터 — 실제 연동 시 API 응답으로 교체
const ELDER = {
  name: "김순자",
  age: 72,
  lastRecordedAt: "오늘 오전 9:42",
  streak: 7,
  recentStatus: "sunny" as const,
  weekSummary: ["sunny", "sunny", "cloudy", "sunny", "rainy", "sunny", "sunny"] as const,
};

const WEATHER_ICON: Record<string, string> = { sunny: "☀️", cloudy: "⛅", rainy: "🌧️" };
const WEATHER_LABEL: Record<string, string> = { sunny: "맑음", cloudy: "흐림", rainy: "비" };
const WEATHER_BG: Record<string, string> = {
  sunny: "#fff9e6",
  cloudy: "#f3f6ff",
  rainy: "#edf6ff",
};

export default function DashboardPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const days = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>안녕하세요 👋</Text>
          <Text style={styles.headerTitle}>{ELDER.name} 어르신</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} accessibilityLabel="알림">
          <Bell size={22} color="#8b7871" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >

        {/* 오늘의 상태 카드 */}
        <View style={[styles.statusCard, { backgroundColor: WEATHER_BG[ELDER.recentStatus] }]}>
          <Text style={styles.statusEmoji}>{WEATHER_ICON[ELDER.recentStatus]}</Text>
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>오늘의 목소리 상태</Text>
            <Text style={styles.statusValue}>{WEATHER_LABEL[ELDER.recentStatus]}</Text>
            <Text style={styles.statusSub}>{ELDER.lastRecordedAt} 기록</Text>
          </View>
        </View>

        {/* 이번 주 흐름 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>이번 주 변화 흐름</Text>
          <View style={styles.weekRow}>
            {ELDER.weekSummary.map((status, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={styles.weekDay}>{days[i]}</Text>
                <Text style={styles.weekIcon}>{WEATHER_ICON[status]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 연속 기록 배지 */}
        <View style={styles.streakCard}>
          <Calendar size={24} color="#FF706D" />
          <View style={styles.streakInfo}>
            <Text style={styles.streakNum}>{ELDER.streak}일 연속</Text>
            <Text style={styles.streakSub}>꾸준히 기록하고 계세요!</Text>
          </View>
          <Text style={styles.streakEmoji}>🔥</Text>
        </View>

        {/* 리포트 바로가기 */}
        <TouchableOpacity
          style={styles.reportLink}
          onPress={() => router.push("/(guardian)/report")}
          activeOpacity={0.85}
        >
          <TrendingUp size={22} color="#FF706D" />
          <Text style={styles.reportLinkText}>상세 변화 리포트 보기</Text>
          <ChevronRight size={20} color="#c4b5ae" />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: { fontSize: 16, color: "#a18f88" },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#362b27" },
  bellBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, gap: 14 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f0e8e2",
  },
  statusEmoji: { fontSize: 52 },
  statusInfo: { gap: 3 },
  statusLabel: { fontSize: 14, color: "#a18f88" },
  statusValue: { fontSize: 24, fontWeight: "800", color: "#362b27" },
  statusSub: { fontSize: 14, color: "#b6aaa5" },
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#4d403b" },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekCell: { alignItems: "center", gap: 6 },
  weekDay: { fontSize: 13, color: "#b6aaa5", fontWeight: "600" },
  weekIcon: { fontSize: 24 },
  streakCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  streakInfo: { flex: 1 },
  streakNum: { fontSize: 22, fontWeight: "800", color: "#362b27" },
  streakSub: { fontSize: 15, color: "#a18f88" },
  streakEmoji: { fontSize: 32 },
  reportLink: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#f0e8e2",
  },
  reportLinkText: { flex: 1, fontSize: 18, fontWeight: "600", color: "#4d403b" },
});

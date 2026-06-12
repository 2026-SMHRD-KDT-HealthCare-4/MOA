import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserPlus, ChevronRight } from "lucide-react-native";

// mock 데이터
const FAMILY_MEMBERS = [
  {
    id: "1",
    name: "김순자",
    age: 72,
    relation: "어머니",
    isOnline: true,
    lastActivity: "오늘 오전 9:42",
    todayStatus: "sunny" as const,
    streak: 7,
  },
];

const WEATHER_ICON: Record<string, string> = { sunny: "☀️", cloudy: "⛅", rainy: "🌧️" };
const WEATHER_LABEL: Record<string, string> = { sunny: "맑음", cloudy: "흐림", rainy: "비" };

export default function FamilyPage() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>연결된 어르신</Text>
        <Text style={styles.headerSub}>건강 변화를 함께 살펴봐요</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >

        {/* 가족 카드 목록 */}
        {FAMILY_MEMBERS.map((member) => (
          <TouchableOpacity key={member.id} style={styles.memberCard} activeOpacity={0.88}>

            {/* 프로필 영역 */}
            <View style={styles.profileRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{member.name[0]}</Text>
                <View style={[styles.onlineDot, { backgroundColor: member.isOnline ? "#2ECC71" : "#d9cdc9" }]} />
              </View>
              <View style={styles.nameArea}>
                <Text style={styles.memberName}>{member.name} 어르신</Text>
                <Text style={styles.memberRelation}>{member.relation} · 만 {member.age}세</Text>
              </View>
              <ChevronRight size={20} color="#c4b5ae" />
            </View>

            <View style={styles.divider} />

            {/* 상태 요약 */}
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>{WEATHER_ICON[member.todayStatus]}</Text>
                <View>
                  <Text style={styles.statusLabel}>오늘 상태</Text>
                  <Text style={styles.statusValue}>{WEATHER_LABEL[member.todayStatus]}</Text>
                </View>
              </View>

              <View style={styles.statusDivider} />

              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>🔥</Text>
                <View>
                  <Text style={styles.statusLabel}>연속 기록</Text>
                  <Text style={styles.statusValue}>{member.streak}일</Text>
                </View>
              </View>

              <View style={styles.statusDivider} />

              <View style={styles.statusItem}>
                <Text style={styles.statusIcon}>🕐</Text>
                <View>
                  <Text style={styles.statusLabel}>마지막 기록</Text>
                  <Text style={styles.statusValue}>{member.lastActivity}</Text>
                </View>
              </View>
            </View>

          </TouchableOpacity>
        ))}

        {/* 어르신 추가 버튼 */}
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.8}>
          <UserPlus size={22} color="#FF706D" />
          <Text style={styles.addBtnText}>어르신 연결 추가</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#362b27" },
  headerSub: { fontSize: 16, color: "#a18f88" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  memberCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
    gap: 14,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffede9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontWeight: "800", color: "#FF706D" },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "white",
  },
  nameArea: { flex: 1 },
  memberName: { fontSize: 18, fontWeight: "700", color: "#362b27" },
  memberRelation: { fontSize: 14, color: "#a18f88", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#f5eeea" },
  statusRow: { flexDirection: "row", justifyContent: "space-between" },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  statusDivider: { width: 1, height: 36, backgroundColor: "#f0e8e2" },
  statusIcon: { fontSize: 22 },
  statusLabel: { fontSize: 12, color: "#b6aaa5" },
  statusValue: { fontSize: 15, fontWeight: "700", color: "#4d403b" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#FF706D",
    backgroundColor: "white",
  },
  addBtnText: { fontSize: 18, fontWeight: "600", color: "#FF706D" },
});

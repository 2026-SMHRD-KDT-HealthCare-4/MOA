import { View, Text, ScrollView, Pressable, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, ChevronDown, Footprints, Gauge, Smile, Volume2 } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors } from "../styles/tokens";
import { resolveCharacter, type Gender, type HealthState } from "../constants/characterImages";

const g = colors.guardian;

// mock — 백엔드 연동 시 보호자 담당 직접사용자 정보로 교체.
const ELDER: { name: string; gender: Gender; state: HealthState; checkedAt: string; date: string } = {
  name: "김서자",
  gender: "female",
  state: "normal",
  checkedAt: "오늘 09:42",
  date: "2025.05.22 목요일",
};

const STATE_META: Record<HealthState, { title: string; sub: string }> = {
  normal: { title: "안정적으로 좋아요", sub: "최근 7일과 비슷한 편안한 흐름이에요" },
  caution: { title: "조금 살펴봐 주세요", sub: "평소와 다른 변화가 약하게 감지됐어요" },
  alert: { title: "변화가 감지됐어요", sub: "오늘은 가벼운 통화로 안부를 확인해 보세요" },
};

const WEEK = [
  { day: "금", score: 72 },
  { day: "토", score: 80 },
  { day: "일", score: 68 },
  { day: "월", score: 90 },
  { day: "화", score: 64 },
  { day: "수", score: 82 },
  { day: "오늘", score: 86 },
];

const POINTS: { label: string; value: string; detail?: string; icon: LucideIcon }[] = [
  { label: "발화 속도", value: "안정적이에요", detail: "128음절", icon: Gauge },
  { label: "음량", value: "안정적이에요", detail: "62dB", icon: Volume2 },
  { label: "감정 톤", value: "밝고 편안한 톤이에요", icon: Smile },
];

const PLOT_H = 140;
const Y_TICKS = [100, 75, 50, 25, 0];

export default function DashboardPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const meta = STATE_META[ELDER.state];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>안녕하세요, {ELDER.name}님 💗</Text>
          <Text style={styles.greetingSub}>부모님의 하루를 따뜻하게 살펴보세요.</Text>
        </View>
        <Pressable style={styles.bellButton} accessibilityRole="button" accessibilityLabel="알림">
          <Bell size={22} color={g.textPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 116 }]}
      >
        {/* 오늘의 상태 (peach 카드 + 캐릭터 + 장식 잎) */}
        <View style={styles.heroWrap}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>오늘의 상태</Text>
              <Text style={styles.heroTitle}>{meta.title} 😊</Text>
              <Text style={styles.heroSub}>{meta.sub}</Text>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMeta}>마지막 기록</Text>
                <Text style={styles.heroMetaStrong}>{ELDER.checkedAt}</Text>
                <Text style={styles.heroMeta}>· {ELDER.date}</Text>
              </View>
            </View>
            <Image
              source={resolveCharacter(ELDER.gender, ELDER.state)}
              style={styles.character}
              resizeMode="contain"
              accessibilityLabel={`${ELDER.name}님 상태 캐릭터`}
            />
          </View>
          {/* 장식 잎 — 문구(왼쪽)와 겹치지 않게 오른쪽·캐릭터 쪽 가장자리에만 살짝 걸치게 */}
          <Image source={require("../../assets/leaf/leaf_01.png")} style={styles.leafTopRight} resizeMode="contain" />
          <Image source={require("../../assets/leaf/leaf_04.png")} style={styles.leafRight} resizeMode="contain" />
          <Image source={require("../../assets/leaf/leaf_06.png")} style={styles.leafBottomRight} resizeMode="contain" />
        </View>

        {/* 7일 컨디션 흐름 (Y축 눈금 + chartBar 막대) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>7일 컨디션 흐름</Text>
            <View style={styles.selector}>
              <Text style={styles.selectorText}>종합 지표</Text>
              <ChevronDown size={16} color={g.textSecondary} />
            </View>
          </View>
          <View style={[styles.plot, { height: PLOT_H }]}>
            {Y_TICKS.map((t) => (
              <View key={t} style={[styles.tickRow, { top: (1 - t / 100) * PLOT_H }]}>
                <Text style={styles.tickLabel}>{t}</Text>
                <View style={styles.tickLine} />
              </View>
            ))}
            <View style={styles.barsRow}>
              {WEEK.map((item) => (
                <View key={item.day} style={styles.barItem}>
                  <View style={[styles.bar, { height: (item.score / 100) * PLOT_H }]} />
                </View>
              ))}
            </View>
          </View>
          <View style={styles.dayRow}>
            {WEEK.map((item) => (
              <Text key={item.day} style={[styles.dayLabel, item.day === "오늘" && styles.dayActive]}>
                {item.day}
              </Text>
            ))}
          </View>
        </View>

        {/* 오늘의 포인트 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘의 포인트</Text>
          <Pressable onPress={() => router.push("/(guardian)/report")} hitSlop={8}>
            <Text style={styles.linkText}>자세히 보기</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          {POINTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <View key={p.label} style={[styles.pointRow, i < POINTS.length - 1 && styles.pointDivider]}>
                <View style={styles.pointIcon}>
                  <Icon size={20} color={g.amber} strokeWidth={2.4} />
                </View>
                <View style={styles.pointCopy}>
                  <Text style={styles.pointLabel}>{p.label}</Text>
                  <Text style={styles.pointValue}>{p.value}</Text>
                </View>
                {p.detail ? <Text style={styles.pointDetail}>{p.detail}</Text> : null}
              </View>
            );
          })}
        </View>

        {/* 추천 카드 */}
        <View style={styles.recommendCard}>
          <View style={styles.recommendCopy}>
            <Text style={styles.recommendTitle}>가벼운 산책이나 통화는 어떠세요?</Text>
            <Text style={styles.recommendBody}>활동량이 낮은 오후에는 짧은 산책이나 가벼운 통화가 좋아요.</Text>
          </View>
          <View style={styles.recommendIcon}>
            <Footprints size={24} color={g.amber} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: g.bgPage },
  header: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: { flex: 1, gap: 3 },
  greeting: { color: g.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  greetingSub: { color: g.textSecondary, fontSize: 14, lineHeight: 19, fontWeight: "600" },
  bellButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: g.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: g.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },

  scroll: { paddingHorizontal: 20, gap: 22 },

  // 상태 카드 래퍼 — 잎이 모서리 밖으로 걸치도록 클리핑하지 않음.
  heroWrap: { position: "relative", marginTop: 6 },
  hero: {
    backgroundColor: g.cardPeach,
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 22,
    minHeight: 198,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    shadowColor: g.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 4,
  },
  heroCopy: { gap: 7, paddingRight: 140 },
  heroKicker: { color: g.textSecondary, fontSize: 14, fontWeight: "800" },
  heroTitle: { color: g.textPrimary, fontSize: 24, lineHeight: 31, fontWeight: "900" },
  heroSub: { color: g.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  heroMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 6 },
  heroMeta: { color: g.textSecondary, fontSize: 12, fontWeight: "600" },
  heroMetaStrong: { color: g.textPrimary, fontSize: 12, fontWeight: "900" },
  character: { position: "absolute", right: 2, bottom: -22, width: 176, height: 264 },

  leafTopLeft: { position: "absolute", top: -12, left: 10, width: 50, height: 50, opacity: 0.9, transform: [{ rotate: "-18deg" }] },
  leafTopRight: { position: "absolute", top: -8, right: 22, width: 44, height: 44, opacity: 0.9, transform: [{ rotate: "22deg" }] },
  leafRight: { position: "absolute", top: 62, right: -8, width: 58, height: 58, opacity: 0.88, transform: [{ rotate: "-10deg" }] },
  leafBottomLeft: { position: "absolute", bottom: -10, left: -6, width: 54, height: 54, opacity: 0.9, transform: [{ rotate: "12deg" }] },
  leafBottomRight: { position: "absolute", bottom: -16, right: 34, width: 52, height: 52, opacity: 0.86, transform: [{ rotate: "18deg" }] },

  card: {
    backgroundColor: g.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: g.border,
    shadowColor: g.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardTitle: { color: g.textPrimary, fontSize: 18, lineHeight: 23, fontWeight: "900" },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: g.bgPage,
    borderWidth: 1,
    borderColor: g.border,
  },
  selectorText: { color: g.textSecondary, fontSize: 13, fontWeight: "800" },

  plot: { position: "relative", marginBottom: 8 },
  tickRow: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  tickLabel: { width: 24, fontSize: 11, fontWeight: "700", color: g.textSecondary, textAlign: "right" },
  tickLine: { flex: 1, height: 1, backgroundColor: g.gridline },
  barsRow: {
    position: "absolute",
    left: 34,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  barItem: { flex: 1, alignItems: "center" },
  bar: { width: 22, borderRadius: 8, backgroundColor: g.chartBar },
  dayRow: { flexDirection: "row", paddingLeft: 34, justifyContent: "space-between" },
  dayLabel: { flex: 1, textAlign: "center", color: g.textSecondary, fontSize: 13, fontWeight: "800" },
  dayActive: { color: g.amber, fontWeight: "900" },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: g.textPrimary, fontSize: 18, lineHeight: 23, fontWeight: "900" },
  linkText: { color: g.amber, fontSize: 14, fontWeight: "800" },

  pointRow: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 13 },
  pointDivider: { borderBottomWidth: 1, borderBottomColor: g.border },
  pointIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: g.cardPeach,
    alignItems: "center",
    justifyContent: "center",
  },
  pointCopy: { flex: 1, gap: 2 },
  pointLabel: { color: g.textSecondary, fontSize: 13, fontWeight: "800" },
  pointValue: { color: g.textPrimary, fontSize: 16, fontWeight: "800" },
  pointDetail: { color: g.textPrimary, fontSize: 14, fontWeight: "900" },

  recommendCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: g.cardPeach,
    borderRadius: 22,
    padding: 18,
    minHeight: 84,
  },
  recommendCopy: { flex: 1, gap: 4 },
  recommendTitle: { color: g.amber, fontSize: 16, lineHeight: 21, fontWeight: "900" },
  recommendBody: { color: g.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  recommendIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: g.card,
    alignItems: "center",
    justifyContent: "center",
  },
});

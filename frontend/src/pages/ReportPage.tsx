import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/authStore";
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
  VictoryTheme,
  VictoryArea,
} from "victory-native";

// mock 데이터 — 실제 연동 시 API 응답으로 교체
const WEEK_DATA = [
  { day: "월", score: 68 },
  { day: "화", score: 72 },
  { day: "수", score: 58 },
  { day: "목", score: 75 },
  { day: "금", score: 45 },
  { day: "토", score: 80 },
  { day: "일", score: 78 },
];

const STATUS_BADGE = (score: number) => {
  if (score >= 70) return { label: "안정적", color: "#2ECC71", bg: "#edfaf3" };
  if (score >= 50) return { label: "주의 필요", color: "#E8943A", bg: "#fff5e6" };
  return { label: "변화 감지", color: "#E8943A", bg: "#fff5e6" };
};

const latestScore = WEEK_DATA[WEEK_DATA.length - 1].score;
const badge = STATUS_BADGE(latestScore);

export default function ReportPage() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chartWidth = width - 40;
  const myName = useAuthStore((s) => s.name) || "나";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 변화 패턴 리포트</Text>
        <Text style={styles.headerSub}>{myName} 님 · 최근 7일</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >

        {/* 현재 상태 배지 */}
        <View style={[styles.badgeCard, { backgroundColor: badge.bg }]}>
          <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
          <Text style={[styles.badgeLabel, { color: badge.color }]}>{badge.label}</Text>
          <Text style={styles.badgeSub}>참고용 패턴 분석 결과입니다</Text>
        </View>

        {/* 차트 카드 */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📈  7일 목소리 패턴 변화</Text>
          <VictoryChart
            width={chartWidth}
            height={220}
            theme={VictoryTheme.grayscale}
            padding={{ top: 16, bottom: 40, left: 40, right: 16 }}
            domainPadding={{ x: 16 }}
          >
            <VictoryAxis
              tickFormat={(t: string) => t}
              style={{
                tickLabels: { fontSize: 12, fill: "#b6aaa5" },
                axis: { stroke: "#f0e8e2" },
                grid: { stroke: "transparent" },
              }}
            />
            <VictoryAxis
              dependentAxis
              domain={[0, 100]}
              tickValues={[0, 25, 50, 75, 100]}
              tickFormat={(t: number) => `${t}`}
              style={{
                tickLabels: { fontSize: 11, fill: "#b6aaa5" },
                axis: { stroke: "transparent" },
                grid: { stroke: "#f5eeea", strokeDasharray: "4" },
              }}
            />
            <VictoryArea
              data={WEEK_DATA}
              x="day"
              y="score"
              style={{
                data: {
                  fill: "#FF7955",
                  fillOpacity: 0.08,
                  stroke: "transparent",
                },
              }}
              interpolation="catmullRom"
            />
            <VictoryLine
              data={WEEK_DATA}
              x="day"
              y="score"
              style={{
                data: { stroke: "#FF7955", strokeWidth: 2.5 },
              }}
              interpolation="catmullRom"
            />
            <VictoryScatter
              data={WEEK_DATA}
              x="day"
              y="score"
              size={4}
              style={{ data: { fill: "#FF7955", stroke: "white", strokeWidth: 2 } }}
            />
          </VictoryChart>
          <Text style={styles.chartDisclaimer}>
            * 이 그래프는 참고용 패턴이며 의학적 근거 자료가 아닙니다.
          </Text>
        </View>

        {/* 요일별 요약 */}
        <View style={styles.tableCard}>
          <Text style={styles.cardTitle}>일별 변화 요약</Text>
          {WEEK_DATA.map(({ day, score }) => {
            const b = STATUS_BADGE(score);
            return (
              <View key={day} style={styles.tableRow}>
                <Text style={styles.tableDay}>{day}요일</Text>
                <View style={styles.tableBar}>
                  <View
                    style={[
                      styles.tableBarFill,
                      { width: `${score}%`, backgroundColor: b.color },
                    ]}
                  />
                </View>
                <View style={[styles.tableBadge, { backgroundColor: b.bg }]}>
                  <Text style={[styles.tableBadgeText, { color: b.color }]}>{b.label}</Text>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9F2" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#342C28" },
  headerSub: { fontSize: 16, color: "#765E52" },
  scroll: { paddingHorizontal: 20, gap: 14 },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0e8e2",
  },
  badgeDot: { width: 10, height: 10, borderRadius: 5 },
  badgeLabel: { fontSize: 18, fontWeight: "700" },
  badgeSub: { flex: 1, fontSize: 13, color: "#765E52", textAlign: "right" },
  chartCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    alignItems: "flex-start",
    gap: 4,
  },
  chartTitle: { fontSize: 17, fontWeight: "700", color: "#40332D" },
  chartDisclaimer: { fontSize: 12, color: "#c4b5ae", paddingTop: 4 },
  tableCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#f0e8e2",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#40332D", marginBottom: 4 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tableDay: { width: 42, fontSize: 15, color: "#5f4c45", fontWeight: "600" },
  tableBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#f0e8e2",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableBarFill: { height: 8, borderRadius: 4 },
  tableBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tableBadgeText: { fontSize: 12, fontWeight: "700" },
});

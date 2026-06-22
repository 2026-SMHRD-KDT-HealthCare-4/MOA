import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getMonthlyStats,
  getReportTrend,
  type TrendPoint,
  type TrendStatus,
} from "../api/report";

const REAL_API = process.env.EXPO_PUBLIC_AUTH_API_MODE === "real";

type BarState = "normal" | "detected" | "pending";

interface DayBar {
  day: string;
  value: number;
  state: BarState;
}

interface ReportView {
  month: string;
  status: { icon: string; title: string; description: string };
  participation: { completedDays: number; totalDays: number };
  weeklyVoice: DayBar[];
  summary: string;
  alert: { title: string; period: string } | null;
}

// 백엔드 미연결(mock 모드)·조회 실패 시 보여줄 샘플 리포트.
const FALLBACK_REPORT: ReportView = {
  month: "6월",
  status: {
    icon: "🌧️",
    title: "이번 주 변화가 감지됐어요",
    description: "3주차 이후 패턴 변화가 확인됐어요",
  },
  participation: { completedDays: 21, totalDays: 30 },
  weeklyVoice: [
    { day: "월", value: 54, state: "normal" },
    { day: "화", value: 61, state: "normal" },
    { day: "수", value: 58, state: "normal" },
    { day: "목", value: 72, state: "detected" },
    { day: "금", value: 79, state: "detected" },
    { day: "토", value: 84, state: "detected" },
    { day: "일", value: 64, state: "pending" },
  ],
  summary: "전반적으로 안정적인 패턴이었으나 3주차 이후 변화 패턴이 확인됐어요.",
  alert: { title: "모아가 변화를 감지했어요", period: "3일 연속 · 목요일부터" },
};

// 상태별 막대 높이(점수 데이터가 없어 상태를 단계로 매핑) — 맑음<흐림<비.
const STATUS_HEIGHT: Record<TrendStatus, number> = { sunny: 42, cloudy: 66, rainy: 92 };

const STATUS_CARD: Record<TrendStatus, { icon: string; title: string; description: string }> = {
  sunny: { icon: "☀️", title: "안정적인 한 주예요", description: "특별한 변화가 없었어요" },
  cloudy: { icon: "⛅", title: "약간의 변화가 있었어요", description: "조금 더 지켜봐 주세요" },
  rainy: {
    icon: "🌧️",
    title: "이번 주 변화가 감지됐어요",
    description: "최근 패턴 변화가 확인됐어요",
  },
};

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function currentReportMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(reportMonth: string): number {
  const [y, m] = reportMonth.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// trend(상태 추이) + stats(월 집계) → 화면 모델. 의학 점수는 쓰지 않는다.
function buildReportView(trend: TrendPoint[], measurementCount: number, riskAlertCount: number, reportMonth: string): ReportView {
  const latest: TrendStatus = trend.length ? trend[trend.length - 1].status : "sunny";
  const card = STATUS_CARD[latest];

  const weeklyVoice: DayBar[] = trend.map((p) => ({
    day: WEEKDAY[new Date(`${p.date}T00:00:00`).getDay()],
    value: STATUS_HEIGHT[p.status],
    state: p.status === "rainy" ? "detected" : "normal",
  }));

  // 말미의 연속 '비' 일수 → 알림 기간 문구.
  let consecutiveRainy = 0;
  for (let i = trend.length - 1; i >= 0 && trend[i].status === "rainy"; i--) consecutiveRainy++;

  const totalDays = daysInMonth(reportMonth);
  const hasChange = trend.some((p) => p.status === "rainy");

  return {
    month: `${Number(reportMonth.split("-")[1])}월`,
    status: card,
    participation: {
      completedDays: Math.min(measurementCount, totalDays),
      totalDays,
    },
    weeklyVoice,
    summary: hasChange
      ? "전반적으로 안정적이었으나 최근 변화 패턴이 확인됐어요."
      : "최근 기간 동안 안정적인 패턴이 이어졌어요.",
    alert:
      riskAlertCount > 0
        ? {
            title: "모아가 변화를 감지했어요",
            period: consecutiveRainy > 0 ? `${consecutiveRainy}일 연속` : "최근 변화 감지",
          }
        : null,
  };
}

const COLOR = {
  background: "#FAF7F2",
  card: "#FDECDD",
  text: "#1A1A1A",
  secondary: "#888888",
  brand: "#FF7955",
  warning: "#E8943A",
  chart: "#C8D0E0",
} as const;

const CHART_HEIGHT = 154;

export default function DashboardPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { elderlyId } = useLocalSearchParams<{ elderlyId: string }>();
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 보호자 리포트. real 모드 + elderlyId가 있을 때만 서버 조회, 실패 시 샘플 유지.
  const [report, setReport] = useState<ReportView>(FALLBACK_REPORT);
  useEffect(() => {
    if (!REAL_API || !elderlyId) return;
    let alive = true;
    (async () => {
      try {
        const month = currentReportMonth();
        const [trend, stats] = await Promise.all([
          getReportTrend(elderlyId, 7),
          getMonthlyStats(elderlyId, month),
        ]);
        if (alive) {
          setReport(buildReportView(trend, stats.measurementCount, stats.riskAlertCount, month));
        }
      } catch {
        // 조회 실패 — 샘플 리포트 유지
      }
    })();
    return () => {
      alive = false;
    };
  }, [elderlyId]);

  const participationRate = report.participation.completedDays / report.participation.totalDays;

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showPreparingToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerSide}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <Text style={styles.backText}>{"<"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>어머니 리포트</Text>
        <View style={[styles.headerSide, styles.monthSide]} accessibilityElementsHidden>
          <Text style={styles.monthText}>{report.month} ▼</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 36 }]}
      >
        <View style={styles.statusCard}>
          <Text style={styles.weatherIcon} accessibilityLabel={report.status.title}>
            {report.status.icon}
          </Text>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{report.status.title}</Text>
            <Text style={styles.statusDescription}>{report.status.description}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이번 달 검사 참여</Text>
          <Text style={styles.participationText}>
            {report.participation.completedDays}일 / {report.participation.totalDays}일 참여
          </Text>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: report.participation.totalDays,
              now: report.participation.completedDays,
            }}
          >
            <View style={[styles.progressFill, { width: `${participationRate * 100}%` }]} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>목소리 변화 추이</Text>
          <View style={styles.chartCard}>
            <View style={[styles.chart, { height: CHART_HEIGHT }]}>
              {report.weeklyVoice.map((item, i) => (
                <View key={i} style={styles.barColumn}>
                  {item.state === "pending" ? (
                    <View style={[styles.pendingBar, { height: `${item.value}%` }]} />
                  ) : (
                    <View
                      style={[
                        styles.bar,
                        { height: `${item.value}%` },
                        item.state === "detected" && styles.detectedBar,
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
            <View style={styles.axisRow}>
              {report.weeklyVoice.map((item, i) => (
                <Text key={i} style={styles.axisLabel}>
                  {item.day}
                </Text>
              ))}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.normalDot]} />
                <Text style={styles.legendText}>정상</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.detectedDot]} />
                <Text style={styles.legendText}>변화감지</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>이달의 요약</Text>
          <Text style={styles.summaryText}>{report.summary}</Text>
          <Text style={styles.disclaimer}>참고용 정보예요 — 의료 행위가 아니에요</Text>
        </View>

        {report.alert ? (
          <View style={styles.alertCard}>
            <View style={styles.alertBar} />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>⚠️ {report.alert.title}</Text>
              <Text style={styles.alertPeriod}>{report.alert.period}</Text>
              <Pressable
                style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.outlineButtonText}>전문가 상담 알아보기 →</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.exportButton, pressed && styles.buttonPressed]}
          onPress={showPreparingToast}
          accessibilityRole="button"
          accessibilityLabel="PDF 내보내기"
        >
          <Text style={styles.exportButtonText}>PDF 내보내기</Text>
        </Pressable>
      </ScrollView>

      {toastVisible ? (
        <View style={[styles.toast, { bottom: insets.bottom + 22 }]} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>준비 중입니다</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLOR.background,
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: {
    width: 72,
    minHeight: 48,
    justifyContent: "center",
  },
  monthSide: {
    alignItems: "flex-end",
  },
  backText: {
    color: COLOR.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
  },
  headerTitle: {
    color: COLOR.text,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "900",
  },
  monthText: {
    color: COLOR.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
  },
  statusCard: {
    minHeight: 144,
    padding: 22,
    borderRadius: 24,
    backgroundColor: COLOR.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  weatherIcon: {
    fontSize: 48,
    lineHeight: 58,
  },
  statusCopy: {
    flex: 1,
    gap: 8,
  },
  statusTitle: {
    color: COLOR.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "900",
  },
  statusDescription: {
    color: COLOR.secondary,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: COLOR.text,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "900",
  },
  participationText: {
    color: COLOR.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
  },
  progressTrack: {
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: COLOR.chart,
  },
  progressFill: {
    height: "100%",
    borderRadius: 7,
    backgroundColor: COLOR.brand,
  },
  chartCard: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 18,
    borderRadius: 22,
    backgroundColor: COLOR.background,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  barColumn: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "68%",
    minWidth: 18,
    borderRadius: 7,
    backgroundColor: COLOR.chart,
  },
  detectedBar: {
    backgroundColor: COLOR.warning,
  },
  pendingBar: {
    width: "68%",
    minWidth: 18,
    borderRadius: 7,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLOR.chart,
    backgroundColor: COLOR.background,
  },
  axisRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  axisLabel: {
    flex: 1,
    color: COLOR.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  legendRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  normalDot: {
    backgroundColor: COLOR.chart,
  },
  detectedDot: {
    backgroundColor: COLOR.warning,
  },
  legendText: {
    color: COLOR.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  summaryCard: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: COLOR.card,
    gap: 14,
  },
  summaryText: {
    color: COLOR.text,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600",
  },
  disclaimer: {
    color: COLOR.secondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  alertCard: {
    minHeight: 178,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: COLOR.background,
    flexDirection: "row",
  },
  alertBar: {
    width: 4,
    backgroundColor: COLOR.warning,
  },
  alertContent: {
    flex: 1,
    padding: 20,
    gap: 10,
  },
  alertTitle: {
    color: COLOR.warning,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "900",
  },
  alertPeriod: {
    color: COLOR.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  outlineButton: {
    minHeight: 48,
    marginTop: 4,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: COLOR.brand,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.background,
  },
  outlineButtonText: {
    color: COLOR.brand,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
  },
  exportButton: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: COLOR.brand,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.background,
  },
  exportButtonText: {
    color: COLOR.brand,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "900",
  },
  buttonPressed: {
    backgroundColor: COLOR.card,
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: COLOR.text,
  },
  toastText: {
    color: COLOR.background,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
});

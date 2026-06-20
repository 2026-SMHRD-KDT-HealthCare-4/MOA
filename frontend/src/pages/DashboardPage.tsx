import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const REPORT_MOCK_DATA = {
  month: "6월",
  status: {
    icon: "🌧️",
    title: "이번 주 변화가 감지됐어요",
    description: "3주차 이후 패턴 변화가 확인됐어요",
  },
  participation: {
    completedDays: 21,
    totalDays: 30,
  },
  weeklyVoice: [
    { day: "월", value: 54, state: "normal" },
    { day: "화", value: 61, state: "normal" },
    { day: "수", value: 58, state: "normal" },
    { day: "목", value: 72, state: "detected" },
    { day: "금", value: 79, state: "detected" },
    { day: "토", value: 84, state: "detected" },
    { day: "일", value: 64, state: "pending" },
  ] as const,
  summary: "전반적으로 안정적인 패턴이었으나 3주차 이후 변화 패턴이 확인됐어요.",
  alert: {
    title: "모아가 변화를 감지했어요",
    period: "3일 연속 · 목요일부터",
  },
} as const;

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
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participationRate =
    REPORT_MOCK_DATA.participation.completedDays / REPORT_MOCK_DATA.participation.totalDays;

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
          <Text style={styles.monthText}>{REPORT_MOCK_DATA.month} ▼</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 36 }]}
      >
        <View style={styles.statusCard}>
          <Text style={styles.weatherIcon} accessibilityLabel="비 오는 날씨">
            {REPORT_MOCK_DATA.status.icon}
          </Text>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{REPORT_MOCK_DATA.status.title}</Text>
            <Text style={styles.statusDescription}>{REPORT_MOCK_DATA.status.description}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이번 달 검사 참여</Text>
          <Text style={styles.participationText}>
            {REPORT_MOCK_DATA.participation.completedDays}일 / {REPORT_MOCK_DATA.participation.totalDays}일 참여
          </Text>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: REPORT_MOCK_DATA.participation.totalDays,
              now: REPORT_MOCK_DATA.participation.completedDays,
            }}
          >
            <View style={[styles.progressFill, { width: `${participationRate * 100}%` }]} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>목소리 변화 추이</Text>
          <View style={styles.chartCard}>
            <View style={[styles.chart, { height: CHART_HEIGHT }]}>
              {REPORT_MOCK_DATA.weeklyVoice.map((item) => (
                <View key={item.day} style={styles.barColumn}>
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
              {REPORT_MOCK_DATA.weeklyVoice.map((item) => (
                <Text key={item.day} style={styles.axisLabel}>
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
          <Text style={styles.summaryText}>{REPORT_MOCK_DATA.summary}</Text>
          <Text style={styles.disclaimer}>참고용 — 의학적 진단이 아닙니다</Text>
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertBar} />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>⚠️ {REPORT_MOCK_DATA.alert.title}</Text>
            <Text style={styles.alertPeriod}>{REPORT_MOCK_DATA.alert.period}</Text>
            <Pressable
              style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.outlineButtonText}>전문가 상담 알아보기 →</Text>
            </Pressable>
          </View>
        </View>

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

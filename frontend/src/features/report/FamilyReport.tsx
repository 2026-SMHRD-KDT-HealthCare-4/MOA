import { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react-native";
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
} from "victory-native";
import { colors } from "../../styles/tokens";
import { WEATHER_IMAGE } from "../../constants/weatherIcons";
import {
  STATUS_LABELS,
  monthOptions,
  type FamilyReport as FamilyReportData,
  type CheckinCalendar,
} from "./mockReport";

const G = colors.guardian;

// "이번 달 주목할 변화" 항목 상태별 색상 (레드 금지 — 변화감지는 앰버 오렌지 계열)
const PATTERN_CAUTION = { bg: "#FDF1E5", bar: "#E8943A", text: "#D97706" };
const PATTERN_NORMAL = { bg: "#F3F4F6", bar: "#CBD5E1", text: "#6B7280" };

// Android 에서 LayoutAnimation 활성화
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 월별 체크인 캘린더 (7열 그리드). 맵에 없는 날짜는 오늘 이후로 보고 표시하지 않음.
function CheckinCalendarGrid({
  month,
  calendar,
}: {
  month: string;
  calendar: CheckinCalendar;
}) {
  const [year, mon] = month.split("-").map(Number);
  const firstWeekday = new Date(year, mon - 1, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, mon, 0).getDate();

  // 앞쪽 빈 칸 + 1..말일
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={styles.calendar}>
      <View style={styles.calRow}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={styles.calCell}>
            <Text style={styles.calWeekday}>{w}</Text>
          </View>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`b-${idx}`} style={styles.calCell} />;
          }
          const status = calendar[day]; // undefined = 오늘 이후
          const isFuture = status === undefined;
          const isDone = status === "normal" || status === "caution";
          const circleStyle =
            status === "normal"
              ? styles.dotNormal
              : status === "caution"
              ? styles.dotCaution
              : status === "missed"
              ? styles.dotMissed
              : null; // future → 원 없음

          return (
            <View key={day} style={styles.calCell}>
              {isFuture ? (
                <Text style={styles.calDayFuture}>{day}</Text>
              ) : (
                <View style={[styles.calDot, circleStyle]}>
                  <Text
                    style={[
                      styles.calDayText,
                      isDone ? styles.calDayDone : styles.calDayMissed,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.calLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.calLegendDot, styles.dotNormal]} />
          <Text style={styles.legendText}>정상</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.calLegendDot, styles.dotCaution]} />
          <Text style={styles.legendText}>변화감지</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.calLegendDot, styles.dotMissed]} />
          <Text style={styles.legendText}>미체크인</Text>
        </View>
      </View>
    </View>
  );
}

interface FamilyReportProps {
  report: FamilyReportData;
  /** "PDF 내보내기" 등 화면 전역 토스트를 띄우기 위한 콜백 */
  onToast: (message: string) => void;
}

export function FamilyReport({ report, onToast }: FamilyReportProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const chartWidth = width - 40 - 36; // 좌우 화면 패딩 + 카드 패딩

  const [month, setMonth] = useState(report.month);
  const [monthOpen, setMonthOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  function toggleCalendar() {
    LayoutAnimation.easeInEaseOut();
    setCalendarOpen((v) => !v);
  }

  const monthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? "6월";

  const checkinPct = useMemo(
    () => Math.round((report.checkinRate.done / report.checkinRate.total) * 100),
    [report.checkinRate]
  );

  return (
    <View style={styles.wrap}>
      {/* 1. 월 선택 드롭다운 */}
      <View style={styles.monthRow}>
        <Pressable
          style={styles.monthButton}
          onPress={() => setMonthOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={`${monthLabel} 선택`}
        >
          <Text style={styles.monthText}>{monthLabel}</Text>
          <ChevronDown size={18} color={G.textPrimary} />
        </Pressable>
        {monthOpen ? (
          <View style={styles.monthMenu}>
            {monthOptions.map((m) => (
              <Pressable
                key={m.value}
                style={styles.monthItem}
                onPress={() => {
                  setMonth(m.value);
                  setMonthOpen(false);
                }}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.monthItemText,
                    m.value === month && styles.monthItemActive,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* 2. 이번 달 상태 요약 카드 */}
      <View style={styles.summaryCard}>
        <Image
          source={WEATHER_IMAGE[report.summary.weather]}
          style={styles.summaryIcon}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.summaryTextWrap}>
          <Text style={styles.summaryLabel}>이번 달 상태</Text>
          <Text style={styles.summaryText}>{report.summary.text}</Text>
        </View>
      </View>

      {/* 3. 체크인 현황 (탭하면 캘린더 펼침) */}
      <View style={styles.card}>
        <Pressable
          onPress={toggleCalendar}
          accessibilityRole="button"
          accessibilityState={{ expanded: calendarOpen }}
          accessibilityLabel="체크인 현황, 눌러서 캘린더 보기"
          style={styles.checkinHead}
        >
          <View style={styles.checkinHeadRow}>
            <Text style={styles.sectionTitle}>체크인 현황</Text>
            {calendarOpen ? (
              <ChevronUp size={20} color={G.textSecondary} />
            ) : (
              <ChevronDown size={20} color={G.textSecondary} />
            )}
          </View>
          <Text style={styles.checkinText}>
            {report.checkinRate.total}일 중 {report.checkinRate.done}일 참여{" "}
            <Text style={styles.checkinPct}>({checkinPct}%)</Text>
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${checkinPct}%` }]} />
          </View>
        </Pressable>
        {calendarOpen ? (
          <CheckinCalendarGrid
            month={report.month}
            calendar={report.checkinCalendar}
          />
        ) : null}
      </View>

      {/* 4. 목소리 변화 추이 그래프 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>목소리 변화 추이</Text>
        <VictoryChart
          width={chartWidth}
          height={220}
          padding={{ top: 16, bottom: 36, left: 56, right: 16 }}
          domain={{ y: [-0.2, 2.2] }}
          domainPadding={{ x: 14 }}
        >
          <VictoryAxis
            style={{
              tickLabels: {
                fontSize: 11,
                fill: G.textSecondary,
                fontFamily: "Pretendard-Medium",
              },
              axis: { stroke: G.gridline },
              grid: { stroke: "transparent" },
            }}
          />
          <VictoryAxis
            dependentAxis
            tickValues={[0, 1, 2]}
            tickFormat={(t: 0 | 1 | 2) => STATUS_LABELS[t] ?? ""}
            style={{
              tickLabels: {
                fontSize: 11,
                fill: G.textSecondary,
                fontFamily: "Pretendard-Medium",
              },
              axis: { stroke: "transparent" },
              grid: { stroke: G.gridline, strokeDasharray: "4" },
            }}
          />
          <VictoryLine
            data={report.chartData}
            x="date"
            y="value"
            interpolation="monotoneX"
            style={{ data: { stroke: G.chartBar, strokeWidth: 2.5 } }}
          />
          <VictoryScatter
            data={report.chartData}
            x="date"
            y="value"
            size={4.5}
            style={{
              data: {
                // 변화감지(2) 지점만 앰버, 나머지는 정상색
                fill: ({ datum }: { datum?: { value?: number } }) =>
                  (datum?.value ?? 0) >= 2 ? G.amber : G.chartBar,
                stroke: "#FFFFFF",
                strokeWidth: 2,
              },
            }}
          />
        </VictoryChart>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: G.chartBar }]} />
            <Text style={styles.legendText}>정상</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: G.amber }]} />
            <Text style={styles.legendText}>변화감지</Text>
          </View>
        </View>
      </View>

      {/* 5. 이번 달 주목할 변화 (핵심) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>이번 달 주목할 변화</Text>
        <View style={styles.patternList}>
          {report.voicePatterns.map((p) => {
            const isCaution = p.status === "caution";
            return (
              <View
                key={p.area}
                style={[
                  styles.patternRow,
                  isCaution ? styles.patternRowCaution : styles.patternRowNormal,
                ]}
              >
                <View
                  style={[
                    styles.patternBar,
                    { backgroundColor: isCaution ? PATTERN_CAUTION.bar : PATTERN_NORMAL.bar },
                  ]}
                />
                <View style={styles.patternBody}>
                  <Text
                    style={[
                      styles.patternTitle,
                      { color: isCaution ? PATTERN_CAUTION.text : PATTERN_NORMAL.text },
                    ]}
                  >
                    {p.area}
                  </Text>
                  <Text
                    style={[
                      styles.patternDesc,
                      { color: isCaution ? PATTERN_CAUTION.text : PATTERN_NORMAL.text },
                    ]}
                  >
                    {p.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <Text style={styles.disclaimer}>
          이 내용은 참고용이며 의학적 진단이 아니에요
        </Text>
      </View>

      {/* 6. 이달의 알림 이력 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>이달의 알림 이력</Text>
        {report.alerts.length === 0 ? (
          <Text style={styles.emptyAlert}>이번 달에는 알림이 없었어요</Text>
        ) : (
          <View style={styles.alertList}>
            {report.alerts.map((a, i) => (
              <View key={`${a.date}-${i}`} style={styles.alertRow}>
                <Text style={styles.alertDate}>{a.date}</Text>
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>변화 감지</Text>
                </View>
                <Text style={styles.alertText}>{a.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 7. 하단 버튼 2개 */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => onToast("준비 중입니다")}
          accessibilityRole="button"
          accessibilityLabel="PDF 내보내기"
        >
          <Text style={styles.secondaryButtonText}>PDF 내보내기</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => router.push("/(guardian)/report-guide")}
          accessibilityRole="button"
          accessibilityLabel="음성 건강 가이드 보기"
        >
          <Text style={styles.primaryButtonText}>음성 건강 가이드 보기</Text>
          <ChevronRight size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },

  // 월 드롭다운
  monthRow: { alignSelf: "flex-start", position: "relative", zIndex: 10 },
  monthButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: G.card,
    borderWidth: 1,
    borderColor: G.border,
  },
  monthText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
    color: G.textPrimary,
  },
  monthMenu: {
    position: "absolute",
    top: 46,
    left: 0,
    minWidth: 110,
    backgroundColor: G.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G.border,
    paddingVertical: 4,
    boxShadow: "0 8px 20px rgba(74,74,72,0.12)",
    elevation: 6,
  },
  monthItem: { paddingVertical: 10, paddingHorizontal: 16 },
  monthItemText: {
    fontFamily: "Pretendard-Medium",
    fontSize: 15,
    color: G.textSecondary,
  },
  monthItemActive: {
    fontFamily: "Pretendard-Bold",
    color: G.amber,
  },

  // 상태 요약 카드
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: G.cardPeach,
    borderRadius: 17,
    padding: 18,
  },
  summaryIcon: { width: 48, height: 48 },
  summaryTextWrap: { flex: 1, gap: 3 },
  summaryLabel: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    color: G.textSecondary,
  },
  summaryText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 18,
    color: G.textPrimary,
  },

  // 공용 카드
  card: {
    backgroundColor: G.card,
    borderRadius: 17,
    padding: 18,
    borderWidth: 1,
    borderColor: G.border,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
    color: G.textPrimary,
  },

  // 체크인
  checkinHead: { gap: 12 },
  checkinHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkinText: {
    fontFamily: "Pretendard-Medium",
    fontSize: 15,
    color: G.textPrimary,
  },
  checkinPct: { fontFamily: "Pretendard-Bold", color: G.amber },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EFE9E2",
    overflow: "hidden",
  },
  progressFill: { height: 10, borderRadius: 5, backgroundColor: G.amber },

  // 체크인 캘린더
  calendar: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: G.border,
    gap: 8,
  },
  calRow: { flexDirection: "row" },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calWeekday: {
    fontFamily: "Pretendard-Bold",
    fontSize: 12,
    color: G.textSecondary,
  },
  calDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dotNormal: { backgroundColor: G.chartBar },
  dotCaution: { backgroundColor: G.amber },
  dotMissed: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#D8D2CC",
  },
  calDayText: { fontFamily: "Pretendard-Bold", fontSize: 13 },
  calDayDone: { color: G.textPrimary },
  calDayMissed: { color: "#B5ADA6" },
  calDayFuture: {
    fontFamily: "Pretendard-Medium",
    fontSize: 13,
    color: "#D6CFC8",
  },
  calLegend: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 4,
  },
  calLegendDot: { width: 12, height: 12, borderRadius: 6 },

  // 차트 범례
  legendRow: { flexDirection: "row", gap: 18, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: {
    fontFamily: "Pretendard-Medium",
    fontSize: 13,
    color: G.textSecondary,
  },

  // 음성 영역별 변화 — 좌측 컬러 바 + 제목 + 설명 (이모지 없음)
  patternList: { gap: 11 },
  patternRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 15,
  },
  patternRowCaution: { backgroundColor: PATTERN_CAUTION.bg },
  patternRowNormal: { backgroundColor: PATTERN_NORMAL.bg },
  patternBar: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  patternBody: { flex: 1, gap: 3 },
  patternTitle: {
    fontFamily: "Pretendard-Bold",
    fontSize: 15,
  },
  patternDesc: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    fontFamily: "Pretendard-Light",
    fontSize: 12,
    color: G.textSecondary,
    paddingTop: 2,
  },

  // 알림 이력
  emptyAlert: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    color: G.textSecondary,
  },
  alertList: { gap: 12 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  alertDate: {
    fontFamily: "Pretendard-Bold",
    fontSize: 14,
    color: G.textPrimary,
    width: 64,
  },
  alertBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: "rgba(232,148,58,0.14)",
  },
  alertBadgeText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 12,
    color: G.amber,
  },
  alertText: {
    flex: 1,
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    color: G.textSecondary,
  },

  // 하단 버튼
  actions: { gap: 10, marginTop: 4 },
  secondaryButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: G.card,
    borderWidth: 1.5,
    borderColor: G.amber,
  },
  secondaryButtonText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
    color: G.amber,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.brand.DEFAULT,
  },
  primaryButtonText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  pressed: { opacity: 0.85 },
});

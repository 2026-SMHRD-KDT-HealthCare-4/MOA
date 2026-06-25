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
import { ChevronDown, ChevronUp, ChevronRight, MapPin } from "lucide-react-native";
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
} from "victory-native";
import { WEATHER_IMAGE } from "../../constants/weatherIcons";
import {
  STATUS_LABELS,
  monthOptions,
  type FamilyReport as FamilyReportData,
  type CheckinCalendar,
} from "./mockReport";

// 보호자 리포트 네이비 컬러 시스템 (Family 탭과 통일). 레드 금지.
// 네이비=주요 정보 · 세이지=안정 · 앰버=주의/변화감지 · 베이지=배경.
const G = {
  bg: "#FFF8EF",
  card: "#FFFFFF",
  border: "#E5ECF5",
  text: "#3B2318",
  sub: "#765E52",
  primary: "#4F76A8",
  primaryDark: "#355A8A",
  primaryLight: "#EEF4FB",
  gridline: "#E5ECF5",
  trackBg: "#E8EEF6",
  chartNormal: "#7FA38A", // 그래프 정상 점 + 캘린더 정상 — 가족 탭 안정 세이지그린
  chartLine: "#B8C7DD", // 추이 그래프 연결선 — 블루톤(점 색과 분리)
  chartChange: "#4F76A8", // 변화감지 라인/범례
  chartChangeDot: "#355A8A", // 변화감지 dot
  warning: "#E8943A", // 주의(앰버)
};

// "이번 달 주목할 변화" 항목 상태별 색상 — 안정=세이지그린 / 변화감지=앰버 (Family 탭과 동일)
const PATTERN_CAUTION = { bg: "#FDF1E5", bar: "#E8943A", text: "#C26A1F" };
const PATTERN_NORMAL = { bg: "#EDF5EF", bar: "#7FA38A", text: "#6F9C7A" };

// Android 에서 LayoutAnimation 활성화
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

// 근처 전문의 찾기 — 진료과 버튼. 진단 표현 금지(정해진 안내 카피만 사용).
const HOSPITAL_DEPTS = ["신경과", "정신건강의학과", "내과"] as const;

// 월별 체크인 캘린더 (7열 그리드). 맵에 없는 날짜는 오늘 이후로 보고 표시하지 않음.
function CheckinCalendarGrid({
  month,
  calendar,
}: {
  month: string;
  calendar: CheckinCalendar;
}) {
  const [year, mon] = month.split("-").map(Number);
  // 월요일 시작 그리드: JS getDay()(0=일)를 월=0..일=6 로 보정해 앞쪽 빈 칸 수를 구한다.
  const leadingBlanks = (new Date(year, mon - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, mon, 0).getDate();

  // 앞쪽 빈 칸 + 1..말일
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
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
          <ChevronDown size={18} color={G.text} />
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
              <ChevronUp size={20} color={G.sub} />
            ) : (
              <ChevronDown size={20} color={G.sub} />
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
                fill: G.sub,
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
                fill: G.sub,
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
            style={{ data: { stroke: G.chartLine, strokeWidth: 2.5 } }}
          />
          <VictoryScatter
            data={report.chartData}
            x="date"
            y="value"
            size={4.5}
            style={{
              data: {
                // 3단계: 정상(0)=네이비그레이 · 주의(1)=앰버 · 변화감지(2)=네이비
                fill: ({ datum }: { datum?: { value?: number } }) => {
                  const v = datum?.value ?? 0;
                  if (v >= 2) return G.chartChangeDot;
                  if (v === 1) return G.warning;
                  return G.chartNormal;
                },
                stroke: "#FFFFFF",
                strokeWidth: 2,
              },
            }}
          />
        </VictoryChart>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: G.chartNormal }]} />
            <Text style={styles.legendText}>정상</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: G.chartChange }]} />
            <Text style={styles.legendText}>변화감지</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: G.warning }]} />
            <Text style={styles.legendText}>주의</Text>
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

      {/* 7. 근처 전문의 찾기 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>근처 전문의 찾기</Text>
        <Text style={styles.hospitalLead}>
          목소리 변화가 감지됐어요. 전문의 상담을 고려해보세요.
        </Text>
        <View style={styles.hospitalRow}>
          {HOSPITAL_DEPTS.map((d) => (
            <Pressable
              key={d}
              style={({ pressed }) => [styles.hospitalChip, pressed && styles.pressed]}
              onPress={() =>
                router.push({
                  pathname: "/(guardian)/nearby-hospitals",
                  params: { dept: d },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${d} 근처 병원 찾기`}
            >
              <MapPin size={15} color={G.primary} />
              <Text style={styles.hospitalChipText} numberOfLines={1}>
                {d}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 8. 하단 버튼 2개 */}
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
    color: G.text,
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
    color: G.sub,
  },
  monthItemActive: {
    fontFamily: "Pretendard-Bold",
    color: G.primary,
  },

  // 상태 요약 카드
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: G.primaryLight,
    borderRadius: 17,
    padding: 18,
  },
  summaryIcon: { width: 48, height: 48 },
  summaryTextWrap: { flex: 1, gap: 3 },
  summaryLabel: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    color: G.sub,
  },
  summaryText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 18,
    color: G.primaryDark,
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
    color: G.text,
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
    color: G.text,
  },
  checkinPct: { fontFamily: "Pretendard-Bold", color: G.primaryDark },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: G.trackBg,
    overflow: "hidden",
  },
  progressFill: { height: 10, borderRadius: 5, backgroundColor: G.primary },

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
    color: G.sub,
  },
  calDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dotNormal: { backgroundColor: G.chartNormal },
  dotCaution: { backgroundColor: G.chartChange },
  dotMissed: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#D8D2CC",
  },
  calDayText: { fontFamily: "Pretendard-Bold", fontSize: 13 },
  calDayDone: { color: G.text },
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
    color: G.sub,
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
    color: G.sub,
    paddingTop: 2,
  },

  // 알림 이력
  emptyAlert: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    color: G.sub,
  },
  alertList: { gap: 12 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  alertDate: {
    fontFamily: "Pretendard-Bold",
    fontSize: 14,
    color: G.text,
    width: 64,
  },
  alertBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: G.primaryLight,
  },
  alertBadgeText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 12,
    color: G.primary,
  },
  alertText: {
    flex: 1,
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    color: G.sub,
  },

  // 근처 전문의 찾기
  hospitalLead: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    lineHeight: 20,
    color: G.sub,
  },
  hospitalRow: { flexDirection: "row", gap: 8 },
  hospitalChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: G.primaryLight,
    borderWidth: 1,
    borderColor: G.border,
  },
  hospitalChipText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 13,
    color: G.primaryDark,
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
    borderColor: G.primary,
  },
  secondaryButtonText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
    color: G.primary,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: G.primary,
    boxShadow: "0 8px 18px rgba(53,90,138,0.18)",
  },
  primaryButtonText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  pressed: { opacity: 0.85 },
});

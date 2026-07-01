import { useEffect, useMemo, useState } from "react";
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
import { ChevronDown, ChevronUp, ChevronRight, ChevronLeft, MapPin } from "lucide-react-native";
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
} from "victory-native";
import { WEATHER_IMAGE } from "../../constants/weatherIcons";
import {
  STATUS_LABELS,
  type FamilyReport as FamilyReportData,
  type CheckinCalendar,
} from "./reportTypes";
import { colors } from "../../styles/tokens";
import CareCenterCard from "./CareCenterCard";

// 보호자 리포트 컬러 시스템 (Family 탭과 통일). 레드 금지.
// 네이비=주요 정보/버튼 · 베이지=배경 · 추이/캘린더 심각도는 초록<노랑<앰버로 상승.
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
  chartLine: "#B8C7DD", // 추이 그래프 연결선 — 중립 톤(점 색과 분리)
  // 심각도 3단계 색(초록→노랑→앰버). 색만이 아니라 라벨 텍스트 병행(규칙 5).
  statusNormal: "#7FA38A", // 정상 — 세이지그린
  statusCaution: "#F2C94C", // 주의 — 노랑
  statusAttention: "#E8943A", // 관찰필요 — 앰버(최고 단계)
};

// "이번 달 주목할 변화" 항목 상태별 색상 — 안정=세이지그린 / 주의=앰버 (Family 탭과 동일)
const PATTERN_CAUTION = { bg: "#FDF1E5", bar: "#E8943A", text: "#C26A1F" };
const PATTERN_NORMAL = { bg: "#EDF5EF", bar: "#7FA38A", text: "#6F9C7A" };

// 추이 점 색: 정상(0)=초록 / 주의(1)=노랑 / 관찰필요(2)=앰버. (색만이 아니라 범례 텍스트 병행)
function dotFill(value?: number): string {
  const v = value ?? 0;
  if (v >= 2) return G.statusAttention;
  if (v === 1) return G.statusCaution;
  return G.statusNormal;
}

// 하루 단위 추이를 7일씩 묶어 '주차' 데이터로 집계. 대표값 = 그 주의 최악(최댓값) 상태.
// x축이 한 달치 날짜로 겹치는 문제를 막기 위한 기본 뷰. range 는 일별 드릴다운 헤더에 쓴다.
function toWeeklyTrend(
  daily: { date: string; value: 0 | 1 | 2 }[],
): { label: string; value: 0 | 1 | 2; range: string }[] {
  const weeks: { label: string; value: 0 | 1 | 2; range: string }[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    const worst = (chunk.length ? Math.max(...chunk.map((p) => p.value)) : 0) as 0 | 1 | 2;
    const range = chunk.length ? `${chunk[0].date}~${chunk[chunk.length - 1].date}` : "";
    weeks.push({ label: `${weeks.length + 1}주`, value: worst, range });
  }
  return weeks;
}

// Android 에서 LayoutAnimation 활성화
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

// 'YYYY-MM' → 'M월'
function monthLabelOf(value: string): string {
  const m = Number(value.split("-")[1]);
  return Number.isFinite(m) ? `${m}월` : value;
}

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
          const isDone =
            status === "normal" || status === "caution" || status === "attention";
          const circleStyle =
            status === "normal"
              ? styles.dotNormal
              : status === "caution"
              ? styles.dotCaution
              : status === "attention"
              ? styles.dotAttention
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
          <Text style={styles.legendText}>주의</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.calLegendDot, styles.dotAttention]} />
          <Text style={styles.legendText}>관찰필요</Text>
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
  /** 조회 가능한 월 목록('YYYY-MM', 내림차순) */
  months: string[];
  /** 현재 선택된 월('YYYY-MM') */
  selectedMonth: string;
  /** 월 선택 시 상위에서 해당 월 리포트를 재조회한다 */
  onSelectMonth: (month: string) => void;
  /** "PDF 내보내기" 등 화면 전역 토스트를 띄우기 위한 콜백 */
  onToast: (message: string) => void;
}

export function FamilyReport({
  report,
  months,
  selectedMonth,
  onSelectMonth,
  onToast,
}: FamilyReportProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const chartWidth = width - 40 - 36; // 좌우 화면 패딩 + 카드 패딩

  const [monthOpen, setMonthOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // 목소리 변화 추이: null = 주차별 보기, number = 해당 주(0-기반)의 일별 보기
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  function toggleCalendar() {
    LayoutAnimation.easeInEaseOut();
    setCalendarOpen((v) => !v);
  }

  const monthLabel = monthLabelOf(selectedMonth);

  // 참여율. 분모(경과일수) 0 방어 + 0~100% 클램프.
  // 테스트 데이터로 참여일수 > 경과일수인 비정상 케이스에서도 100% 를 넘겨 표시하지 않는다.
  const checkinPct = useMemo(() => {
    const { done, total } = report.checkinRate;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
  }, [report.checkinRate]);

  // '근처 전문의 찾기' 안내 문구용: 이번 달 실제 변화(관찰필요일 또는 변화 알림) 여부.
  // 변화가 없으면 "변화가 감지됐어요" 대신 중립 문구를 써서 불필요한 불안을 주지 않는다.
  const hasNotableChange =
    report.chartData.some((p) => p.value >= 2) || report.alerts.length > 0;

  // 주차별 집계. 직접사용자/월이 바뀌면 다시 주차별 보기로 초기화한다.
  const weeklyTrend = useMemo(() => toWeeklyTrend(report.chartData), [report.chartData]);
  useEffect(() => setSelectedWeek(null), [report.month, report.elderlyName]);

  // 데이터 재조회로 주 개수가 줄면 선택 인덱스가 범위를 벗어날 수 있으므로 방어.
  const isWeekly = selectedWeek === null || selectedWeek >= weeklyTrend.length;
  const weekIdx = isWeekly ? 0 : selectedWeek;

  // 차트에 그릴 점: 주차별이면 주 대표값, 일별이면 선택 주의 7일.
  const trendPoints = useMemo(() => {
    if (isWeekly) return weeklyTrend.map((w) => ({ x: w.label, value: w.value }));
    return report.chartData
      .slice(weekIdx * 7, weekIdx * 7 + 7)
      .map((d) => ({ x: d.date, value: d.value }));
  }, [isWeekly, weekIdx, weeklyTrend, report.chartData]);

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
            {months.map((m) => (
              <Pressable
                key={m}
                style={styles.monthItem}
                onPress={() => {
                  onSelectMonth(m);
                  setMonthOpen(false);
                }}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.monthItemText,
                    m === selectedMonth && styles.monthItemActive,
                  ]}
                >
                  {monthLabelOf(m)}
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

      {/* 4. 목소리 변화 추이 그래프 — 기본은 주차별, 특정 주를 누르면 일별로 드릴다운 */}
      <View style={styles.card}>
        <View style={styles.trendHead}>
          <Text style={styles.sectionTitle}>목소리 변화 추이</Text>
          {isWeekly ? (
            weeklyTrend.length > 0 ? (
              <Text style={styles.trendHint}>주를 누르면 일별로 볼 수 있어요</Text>
            ) : null
          ) : (
            <Pressable
              onPress={() => setSelectedWeek(null)}
              accessibilityRole="button"
              accessibilityLabel="주별 보기로 돌아가기"
              hitSlop={8}
              style={styles.backBtn}
            >
              <ChevronLeft size={16} color={G.primary} />
              <Text style={styles.backBtnText}>주별 보기</Text>
            </Pressable>
          )}
        </View>
        {!isWeekly ? (
          <Text style={styles.trendSubLabel}>
            {`${weekIdx + 1}주`}
            {weeklyTrend[weekIdx]?.range ? ` · ${weeklyTrend[weekIdx].range}` : ""}
          </Text>
        ) : null}

        <View style={styles.chartWrap}>
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
              data={trendPoints}
              x="x"
              y="value"
              interpolation="monotoneX"
              style={{ data: { stroke: G.chartLine, strokeWidth: 2.5 } }}
            />
            <VictoryScatter
              data={trendPoints}
              x="x"
              y="value"
              size={isWeekly ? 6 : 4.5}
              style={{
                data: {
                  // 3단계: 정상(0)=초록 · 주의(1)=노랑 · 관찰필요(2)=앰버
                  fill: ({ datum }: { datum?: { value?: number } }) => dotFill(datum?.value),
                  stroke: "#FFFFFF",
                  strokeWidth: 2,
                },
              }}
            />
          </VictoryChart>

          {/* 주차별 보기에서만: plot 영역 위에 주별 투명 탭 컬럼을 얹어 '그 주 클릭 → 일별' 진입.
              차트 패딩(left56/right16/top16/bottom36)에 맞춰 균등 분할한다. */}
          {isWeekly && weeklyTrend.length > 0 ? (
            <View style={styles.chartTapOverlay}>
              {weeklyTrend.map((w, i) => (
                <Pressable
                  key={w.label}
                  style={styles.tapColumn}
                  onPress={() => setSelectedWeek(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.label} 일별로 보기`}
                />
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: G.statusNormal }]} />
            <Text style={styles.legendText}>정상</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: G.statusCaution }]} />
            <Text style={styles.legendText}>주의</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: G.statusAttention }]} />
            <Text style={styles.legendText}>관찰필요</Text>
          </View>
        </View>
      </View>

      {/* 5. 이번 달 주목할 변화 (핵심) — 백엔드 미지원 시 빈 상태 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>이번 달 주목할 변화</Text>
        {report.voicePatterns.length === 0 ? (
          <Text style={styles.sectionEmpty}>목소리 패턴 분석을 준비 중이에요 ☀️</Text>
        ) : (
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
        )}
        {report.voicePatterns.length > 0 ? (
          <Text style={styles.disclaimer}>
            이 내용은 참고용이며 의학적 진단이 아니에요
          </Text>
        ) : null}
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
          {hasNotableChange
            ? "목소리 변화가 감지됐어요. 전문의 상담을 고려해보세요."
            : "정기적인 목소리 점검에 참고하세요."}
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

      {/* 7-1. 근처 돌봄센터 찾기 — 전문의 찾기 카드 바로 아래(별도 컴포넌트, 키워드 검색 기반) */}
      <CareCenterCard />

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

  // 목소리 변화 추이 (주차별 ↔ 일별)
  trendHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  trendHint: {
    fontFamily: "Pretendard-Medium",
    fontSize: 12,
    color: G.sub,
    flexShrink: 1,
    textAlign: "right",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginVertical: -4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  backBtnText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 13,
    color: G.primary,
  },
  trendSubLabel: {
    fontFamily: "Pretendard-Bold",
    fontSize: 13,
    color: G.sub,
    marginTop: -4,
  },
  chartWrap: { position: "relative" },
  // plot 영역 위 투명 탭 레이어. 차트 padding 과 동일한 인셋으로 맞춘다.
  chartTapOverlay: {
    position: "absolute",
    top: 16,
    bottom: 36,
    left: 56,
    right: 16,
    flexDirection: "row",
  },
  tapColumn: { flex: 1, height: "100%" },

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
  dotNormal: { backgroundColor: G.statusNormal },
  dotCaution: { backgroundColor: G.statusCaution },
  dotAttention: { backgroundColor: G.statusAttention },
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

  // 섹션 빈 상태(준비 중) — tokens.ts 색상, 18pt 이상
  sectionEmpty: {
    fontFamily: "Pretendard-Bold",
    fontSize: 18,
    lineHeight: 26,
    color: colors.guardian.coral,
    paddingVertical: 6,
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

import { useRouter } from "expo-router";
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Mic,
  ChevronRight as ArrowRight,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { WEATHER_IMAGE } from "../constants/weatherIcons";
import { useAuthStore } from "../stores/authStore";
import { getReportTrend } from "../api/report";
import { listScriptRecords } from "../api/record";
import { listChatSessions, type ChatSessionSummary } from "../api/chat";
import { colors } from "../styles/tokens";

// real 모드에서만 서버 조회. 실패/미로딩 시 빈 객체 → 빈 상태 UI(mock 폴백 없음).
const REAL_API = process.env.EXPO_PUBLIC_AUTH_API_MODE === "real";

type DayStatus = "sunny" | "cloudy" | "rainy" | null;
type HistoryRecordType = "conversation" | "record";

interface HistoryRecord {
  id: string;
  type: HistoryRecordType;
  time: string;
  duration: string;
  status: NonNullable<DayStatus>;
  // 실제 분석 추이에서 확인된 상태. 캘린더 표시용 기본값과 구분해 결과 화면의 근거로만 쓴다.
  analysisStatus?: NonNullable<DayStatus>;
  conversationSessionCount?: number;
  conversationTurnCount?: number;
  conversationDurationMinutes?: number;
  summary: string;
}

interface DailyHistory {
  status: NonNullable<DayStatus>;
  records: HistoryRecord[];
}

const NAVY = "#173F73";
const BEIGE = "#F7D6AC";
const IVORY = "#FFF9F1";
const BROWN = "#6F5A49";
const BORDER = "rgba(23,63,115,0.12)";

const WEATHER_LABEL: Record<NonNullable<DayStatus>, string> = {
  sunny: "맑음",
  cloudy: "흐림",
  rainy: "비",
};

const RECORD_TYPE_LABEL: Record<HistoryRecordType, string> = {
  conversation: "모아와 대화",
  record: "지정문구 녹음",
};


const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildCalendar(year: number, month: number): (number | null)[][] {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstWeekDay = new Date(year, month, 1).getDay();

  const cells: (number | null)[] = [
    ...Array(firstWeekDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const weeks: (number | null)[][] = [];

  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7).concat(Array(7).fill(null)).slice(0, 7));
  }

  return weeks;
}

function getKoreanDay(year: number, month: number, day: number) {
  return WEEKDAYS[new Date(year, month, day).getDay()];
}

// 백엔드는 measured_at 을 타임존 표기 없는 UTC(datetime.utcnow) 문자열로 내려준다
// (예: "2026-06-30T01:50:37.300000"). JS의 new Date()는 Z/offset 없는 ISO를 '로컬시간'으로
// 해석해 KST와 9시간 어긋나므로, 타임존 표기가 없으면 'Z'를 붙여 UTC로 해석하게 한다.
function parseServerDate(s: string): Date {
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : `${s}Z`);
}

function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? "오전" : "오후";
  h = h % 12;
  if (h === 0) h = 12;
  return `${ampm} ${h}:${String(m).padStart(2, "0")}`;
}

// 실데이터(추이 날씨 + 낭독 이력)를 기록 탭 모델로 변환.
// real: 캘린더 날씨·기록 유무·기록 시각/유형 / mock 유지: 기록별 요약 문구(백엔드 미지원).
function buildRealHistory(
  trend: { date: string; status: NonNullable<DayStatus> }[],
  records: { recordId: string; measuredAt: string }[],
  sessions: ChatSessionSummary[],
): Record<string, DailyHistory> {
  const statusByDate: Record<string, NonNullable<DayStatus>> = {};
  trend.forEach((p) => {
    statusByDate[p.date] = p.status;
  });

  const map: Record<string, DailyHistory> = {};
  records.forEach((r) => {
    const d = parseServerDate(r.measuredAt);
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const status = statusByDate[key] ?? "sunny";
    const entry = map[key] ?? { status, records: [] };
    entry.records.push({
      id: r.recordId,
      type: "record",
      time: formatTime(d),
      duration: "지정문구 낭독",
      status,
      analysisStatus: statusByDate[key],
      // 요약 문구는 백엔드 미지원 → 중립 placeholder(임의 관찰 생성 금지)
      summary: "기록이 저장되었어요.",
    });
    entry.status = status;
    map[key] = entry;
  });

  // 모아 대화: 하루 1건으로 합쳐 'conversation' 기록을 추가한다.
  // 그냥 열었다 닫은 빈 세션(메시지 2개 미만)은 제외하고, 그날 대화 횟수·마지막 시각을 모은다.
  const convByDay: Record<
    string,
    {
      count: number;
      latest: Date;
      userMessageCount: number;
      totalDurationMs: number;
    }
  > = {};
  sessions.forEach((s) => {
    if (s.messageCount < 2) return;
    const d = parseServerDate(s.startedAt);
    // 과거 세션은 종료 API가 호출되지 않아 ended_at이 비어 있을 수 있으므로 마지막 메시지 시각을 사용한다.
    const effectiveEndAt = s.endedAt ?? s.lastMessageAt;
    const endedAt = effectiveEndAt ? parseServerDate(effectiveEndAt) : null;
    const durationMs =
      endedAt && Number.isFinite(endedAt.getTime())
        ? Math.max(0, endedAt.getTime() - d.getTime())
        : 0;
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const cur = convByDay[key];
    if (!cur) {
      convByDay[key] = {
        count: 1,
        latest: d,
        userMessageCount: s.userMessageCount,
        totalDurationMs: durationMs,
      };
    }
    else {
      cur.count += 1;
      cur.userMessageCount += s.userMessageCount;
      cur.totalDurationMs += durationMs;
      if (d > cur.latest) cur.latest = d;
    }
  });
  Object.entries(convByDay).forEach(([key, info]) => {
    const status = statusByDate[key] ?? "sunny";
    const entry = map[key] ?? { status, records: [] };
    entry.records.push({
      id: `conv-${key}`,
      type: "conversation",
      time: formatTime(info.latest),
      duration: info.count > 1 ? `안부 대화 ${info.count}회` : "안부 대화",
      status,
      analysisStatus: statusByDate[key],
      conversationSessionCount: info.count,
      conversationTurnCount: info.userMessageCount,
      conversationDurationMinutes:
        info.totalDurationMs > 0 ? Math.max(1, Math.round(info.totalDurationMs / 60_000)) : undefined,
      summary: "모아와 이야기를 나눴어요.",
    });
    entry.status = status;
    map[key] = entry;
  });

  // 측정은 있으나 낭독 이력이 없는 날도 캘린더 날씨는 보이도록 채운다.
  Object.entries(statusByDate).forEach(([key, status]) => {
    if (!map[key]) map[key] = { status, records: [] };
  });

  return map;
}

export default function HistoryPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  // real 모드: 본인(직접사용자) 기록을 서버에서 조회. 실패 시 null → mock 폴백.
  const seniorId = useAuthStore((s) => s.userId);
  // 상단 타이틀에 붙일 직접사용자 본인 이름(예: "이미자님 기록 돌아보기"). 없으면 폴백.
  const userName = useAuthStore((s) => s.name);
  const [realHistory, setRealHistory] = useState<Record<string, DailyHistory> | null>(null);
  useEffect(() => {
    if (!REAL_API || !seniorId) return;
    let alive = true;
    (async () => {
      try {
        const [trend, records, sessions] = await Promise.all([
          getReportTrend(seniorId, 31),
          listScriptRecords(seniorId),
          listChatSessions(seniorId).catch(() => []), // 대화 조회 실패는 무시(지정문구는 그대로 표시)
        ]);
        if (alive) setRealHistory(buildRealHistory(trend, records, sessions));
      } catch {
        // 조회 실패 — mock 폴백 유지
      }
    })();
    return () => {
      alive = false;
    };
  }, [seniorId]);

  // real 조회분만 사용. 실패/미로딩 시 빈 객체 → 빈 상태 UI 표시(mock 폴백 없음).
  const history = realHistory ?? {};
  const hasAnyHistory = Object.keys(history).length > 0;

  const weeks = buildCalendar(year, month);
  const selectedKey = dateKey(year, month, selectedDay);
  const selectedHistory = history[selectedKey] ?? null;
  const selectedRecords = selectedHistory?.records ?? [];

  const monthlyKeys = Object.keys(history).filter((key) =>
    key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
  );

  // 이번 달 기록(활동)이 있는 모든 날 수. 날씨(맑음/흐림/비) 상관없이 캘린더에 아이콘이
  // 표시된 날과 동일하게 센다. 오늘이 '비'여도 기록이 있으면 포함된다.
  const recordedDays = monthlyKeys.length;
  const isThisMonth = year === today.getFullYear() && month === today.getMonth();

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }

    setSelectedDay(1);
  }

  function nextMonth() {
    if (isThisMonth) return;

    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }

    setSelectedDay(1);
  }

  function openRecordResult(record: HistoryRecord) {
    const previousAnalyzedRecord =
      record.type === "record" && record.analysisStatus
        ? Object.keys(history)
            .filter((key) => key < selectedKey)
            .sort((a, b) => b.localeCompare(a))
            .flatMap((key) => history[key]?.records ?? [])
            .find(
              (candidate) =>
                candidate.type === "record" && candidate.analysisStatus !== undefined,
            )
        : undefined;
    const historicalComparison =
      record.analysisStatus && previousAnalyzedRecord?.analysisStatus
        ? previousAnalyzedRecord.analysisStatus === record.analysisStatus
          ? "similar"
          : "changed"
        : undefined;

    router.push({
      pathname: "/done",
      params: {
        date: selectedKey,
        dateLabel: `${month + 1}월 ${selectedDay}일 (${getKoreanDay(year, month, selectedDay)})`,
        time: record.time,
        description: record.duration,
        summary: record.summary,
        origin: "history",
        type: "history",
        recordId: record.id,
        recordType: record.type,
        ...(record.type === "conversation"
          ? {
              conversationSessionCount: record.conversationSessionCount,
              conversationTurnCount: record.conversationTurnCount,
              conversationDurationMinutes: record.conversationDurationMinutes,
            }
          : {}),
        // 실제 분석 추이가 확인된 기록에만 그날의 목소리 날씨를 전달한다.
        ...(record.analysisStatus ? { weather: record.analysisStatus } : {}),
        ...(historicalComparison ? { comparison: historicalComparison } : {}),
      },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={[BEIGE, "#FFF2DE", BEIGE]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {userName ? `${userName}님 목소리기록` : "목소리기록"}
        </Text>
        <Text style={styles.headerSub}>목소리건강의 흐름을 살펴봐요</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]}
      >
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth} accessibilityLabel="이전 달">
            <ChevronLeft size={23} color={NAVY} />
          </TouchableOpacity>

          <Text style={styles.monthText}>
            {year}년 {month + 1}월
          </Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={nextMonth}
            disabled={isThisMonth}
            accessibilityLabel="다음 달"
          >
            <ChevronRight size={23} color={isThisMonth ? "#C9BDB5" : NAVY} />
          </TouchableOpacity>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((day, di) => {
                  if (!day) return <View key={di} style={styles.dayCell} />;

                  const key = dateKey(year, month, day);
                  const status = history[key]?.status ?? null;
                  const recorded = !!status;
                  const isSelected = day === selectedDay;
                  // 오늘이면서 아직 녹음하지 않은 날: 코랄 테두리로 강조하고,
                  // 탭하면 바로 녹음 화면으로 이동한다.
                  const isTodayUnrecorded =
                    isThisMonth && day === today.getDate() && !recorded;

                  return (
                    <TouchableOpacity
                      key={di}
                      style={[
                        styles.dayCell,
                        isSelected && styles.selectedCell,
                        isTodayUnrecorded && styles.todayCell,
                      ]}
                      onPress={() =>
                        isTodayUnrecorded
                          ? router.push("/(elder)/record")
                          : setSelectedDay(day)
                      }
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isTodayUnrecorded
                          ? "오늘, 목소리 기록하러 가기"
                          : `${month + 1}월 ${day}일`
                      }
                    >
                      <Text style={[styles.dayNum, isSelected && styles.selectedNum]}>{day}</Text>

                      {status ? (
                        <Image
                          source={WEATHER_IMAGE[status]}
                          style={styles.weatherIcon}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.emptyDot, isSelected && styles.selectedEmptyDot]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.legend}>
          {(["sunny", "cloudy", "rainy"] as NonNullable<DayStatus>[]).map((s) => (
            <View key={s} style={styles.legendItem}>
              <Image source={WEATHER_IMAGE[s]} style={styles.legendEmoji} resizeMode="contain" />
              <Text style={styles.legendLabel}>{WEATHER_LABEL[s]}</Text>
            </View>
          ))}
        </View>

        {!hasAnyHistory ? (
          <View style={styles.noDataCard}>
            <Text style={styles.noDataIcon}>☀️</Text>
            <Text style={styles.noDataTitle}>아직 대화 기록이 없어요</Text>
            <Text style={styles.noDataText}>음성 기록이 쌓이면 여기에서 확인할 수 있어요</Text>
          </View>
        ) : selectedRecords.length > 0 ? (
          <View style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View>
                <Text style={styles.recordDate}>
                  {month + 1}월 {selectedDay}일 ({getKoreanDay(year, month, selectedDay)})
                </Text>
                <Text style={styles.recordSub}>총 {selectedRecords.length}개의 기록이 있어요</Text>
              </View>

              {selectedHistory?.status && (
                <Image
                  source={WEATHER_IMAGE[selectedHistory.status]}
                  style={styles.headerWeatherIcon}
                  resizeMode="contain"
                />
              )}
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>오늘의 기록</Text>

            <View style={styles.recordList}>
              {selectedRecords.map((record, index) => {
                const isConversation = record.type === "conversation";

                return (
                  <TouchableOpacity
                    key={record.id}
                    style={[
                      styles.recordItem,
                      index !== selectedRecords.length - 1 && styles.recordItemDivider,
                    ]}
                    activeOpacity={0.82}
                    onPress={() => openRecordResult(record)}
                  >
                    <View style={styles.resultIconCircle}>
                      {isConversation ? (
                        <MessageCircle size={20} color={NAVY} />
                      ) : (
                        <Mic size={20} color={NAVY} />
                      )}
                    </View>

                    <View style={styles.resultTextWrap}>
                      <Text style={styles.resultTitle}>{RECORD_TYPE_LABEL[record.type]}</Text>
                      <Text style={styles.resultDesc}>
                        {record.time} · {record.duration}
                      </Text>
                      <Text style={styles.resultSummary}>{record.summary}</Text>
                    </View>

                    <ArrowRight size={22} color={NAVY} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {month + 1}월 {selectedDay}일
            </Text>
            <Text style={styles.emptyText}>이 날은 아직 기록이 없어요.</Text>
            <Text style={styles.emptySub}>기록이 있는 날짜를 눌러 확인해보세요.</Text>
          </View>
        )}

        {isThisMonth && (
          <View style={styles.summaryCard}>
            <Image
              source={require("../../assets/images/moa_image_history.png")}
              style={styles.summaryImage}
              resizeMode="contain"
            />
            <Text style={styles.summaryText}>
              이번 달 <Text style={styles.summaryHighlight}>{recordedDays}일</Text> 동안{"\n"}
              목소리를 들려주셨어요!
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 14,
    gap: 7,
  },

  headerTitle: {
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    color: NAVY,
  },

  headerSub: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "800",
    color: BROWN,
  },

  scroll: {
    paddingHorizontal: 16,
  },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: "rgba(255,249,241,0.88)",
    borderWidth: 1,
    borderColor: BORDER,
  },

  navBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  monthText: {
    fontSize: 21,
    fontWeight: "900",
    color: NAVY,
  },

  calendarCard: {
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 24,
    backgroundColor: "rgba(255,249,241,0.84)",
    borderWidth: 1,
    borderColor: BORDER,
  },

  weekdayRow: {
    flexDirection: "row",
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(23,63,115,0.10)",
    marginBottom: 4,
  },

  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "900",
    color: BROWN,
  },

  grid: {
    gap: 2,
  },

  weekRow: {
    flexDirection: "row",
  },

  dayCell: {
    flex: 1,
    aspectRatio: 0.92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    gap: 1,
  },

  selectedCell: {
    backgroundColor: NAVY,
  },

  // 오늘·아직 녹음 안 한 날: 브랜드 코랄 테두리로 강조(레드 아님). 탭 시 녹음 화면 이동.
  todayCell: {
    borderWidth: 2,
    borderColor: colors.calendar.todayBorder,
  },

  dayNum: {
    fontSize: 14,
    color: "#5F4C45",
    fontWeight: "800",
  },

  selectedNum: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  weatherIcon: {
    width: 23,
    height: 23,
  },

  emptyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    // 녹음 안 한 과거/예정 날짜: 중립 회갈색(부정 느낌 없음). tokens.calendar.emptyDot.
    backgroundColor: colors.calendar.emptyDot,
  },

  selectedEmptyDot: {
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 22,
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,249,241,0.88)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendEmoji: {
    width: 22,
    height: 22,
  },

  legendLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: BROWN,
  },

  summaryCard: {
    marginTop: 13,
    padding: 18,
    backgroundColor: "rgba(255,249,241,0.9)",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#9D806F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },

  summaryImage: {
    width: 96,
    height: 96,
    // 음수 세로 마진으로 카드 높이에 기여하는 양을 줄여 카드를 컴팩트하게 유지한다.
    marginVertical: -24,
    // 모아를 좌측으로 더 붙이고(marginLeft), 우측 레이아웃 점유를 줄여(marginRight)
    // 옆 문구가 2줄로 들어갈 폭을 확보한다.
    marginLeft: -10,
    marginRight: -20,
    // 레이아웃엔 영향 없이 시각적으로만 살짝 위로 올린다.
    transform: [{ translateY: -4 }],
  },

  summaryText: {
    flex: 1,
    fontSize: 18,
    color: "#40332D",
    lineHeight: 28,
    fontWeight: "700",
  },

  summaryHighlight: {
    color: NAVY,
    fontWeight: "900",
  },

  recordCard: {
    marginTop: 13,
    padding: 19,
    backgroundColor: IVORY,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#9D806F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },

  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  recordDate: {
    fontSize: 21,
    fontWeight: "900",
    color: NAVY,
  },

  recordSub: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#8B7871",
  },

  headerWeatherIcon: {
    width: 44,
    height: 44,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(23,63,115,0.10)",
    marginVertical: 15,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: NAVY,
    marginBottom: 4,
  },

  recordList: {
    marginTop: 4,
  },

  recordItem: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },

  recordItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(23,63,115,0.09)",
  },

  resultIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(23,63,115,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  resultTextWrap: {
    flex: 1,
  },

  resultTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#3F332E",
  },

  resultDesc: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: "800",
    color: "#7E6B63",
  },

  resultSummary: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#8B7871",
  },

  emptyCard: {
    marginTop: 13,
    padding: 22,
    backgroundColor: IVORY,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: NAVY,
    marginBottom: 9,
  },

  emptyText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#3F332E",
    marginBottom: 5,
  },

  emptySub: {
    fontSize: 15,
    fontWeight: "700",
    color: "#8B7871",
  },

  // 전체 기록 없음(미로딩·조회 실패) 빈 상태 — tokens.ts 색상만 사용
  noDataCard: {
    marginTop: 13,
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: colors.guardian.cardPeach,
    borderRadius: 24,
    alignItems: "center",
    gap: 10,
  },
  noDataIcon: {
    fontSize: 44,
    lineHeight: 54,
  },
  noDataTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: colors.guardian.coral,
    textAlign: "center",
  },
  noDataText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.muted,
    textAlign: "center",
  },
});

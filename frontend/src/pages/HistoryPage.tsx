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
import { useState } from "react";
import { WEATHER_IMAGE } from "../constants/weatherIcons";

type DayStatus = "sunny" | "cloudy" | "rainy" | null;
type HistoryRecordType = "conversation" | "record";

interface HistoryRecord {
  id: string;
  type: HistoryRecordType;
  time: string;
  duration: string;
  status: NonNullable<DayStatus>;
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

const MOCK_HISTORY: Record<string, DailyHistory> = {
  "2026-06-01": {
    status: "sunny",
    records: [
      {
        id: "2026-06-01-chat-1",
        type: "conversation",
        time: "오전 10:30",
        duration: "4분 12초",
        status: "sunny",
        summary: "편안한 목소리 흐름이에요.",
      },
      {
        id: "2026-06-01-record-1",
        type: "record",
        time: "오후 7:20",
        duration: "지정문구 2회",
        status: "sunny",
        summary: "최근 검사와 비슷해요.",
      },
    ],
  },
  "2026-06-02": {
    status: "sunny",
    records: [
      {
        id: "2026-06-02-record-1",
        type: "record",
        time: "오전 9:10",
        duration: "지정문구 1회",
        status: "sunny",
        summary: "맑은 편이에요.",
      },
    ],
  },
  "2026-06-03": {
    status: "cloudy",
    records: [
      {
        id: "2026-06-03-chat-1",
        type: "conversation",
        time: "오후 2:15",
        duration: "3분 40초",
        status: "cloudy",
        summary: "평소보다 조금 낮은 흐름이에요.",
      },
    ],
  },
  "2026-06-05": {
    status: "sunny",
    records: [
      {
        id: "2026-06-05-chat-1",
        type: "conversation",
        time: "오전 11:05",
        duration: "5분 02초",
        status: "sunny",
        summary: "안정적인 흐름이에요.",
      },
      {
        id: "2026-06-05-record-1",
        type: "record",
        time: "오후 6:45",
        duration: "지정문구 2회",
        status: "sunny",
        summary: "뚜렷하게 잘 들렸어요.",
      },
      {
        id: "2026-06-05-chat-2",
        type: "conversation",
        time: "오후 8:30",
        duration: "2분 58초",
        status: "sunny",
        summary: "최근 검사와 비슷해요.",
      },
    ],
  },
  "2026-06-07": {
    status: "rainy",
    records: [
      {
        id: "2026-06-07-record-1",
        type: "record",
        time: "오후 5:30",
        duration: "지정문구 1회",
        status: "rainy",
        summary: "평소보다 조금 흐린 편이에요.",
      },
    ],
  },
  "2026-06-09": {
    status: "sunny",
    records: [
      {
        id: "2026-06-09-chat-1",
        type: "conversation",
        time: "오전 10:00",
        duration: "4분 25초",
        status: "sunny",
        summary: "맑은 편이에요.",
      },
    ],
  },
  "2026-06-10": {
    status: "cloudy",
    records: [
      {
        id: "2026-06-10-record-1",
        type: "record",
        time: "오후 7:15",
        duration: "지정문구 2회",
        status: "cloudy",
        summary: "조금 낮은 흐름이에요.",
      },
    ],
  },
  "2026-06-11": {
    status: "sunny",
    records: [
      {
        id: "2026-06-11-chat-1",
        type: "conversation",
        time: "오전 9:45",
        duration: "3분 55초",
        status: "sunny",
        summary: "안정적인 목소리예요.",
      },
    ],
  },
  "2026-06-12": {
    status: "sunny",
    records: [
      {
        id: "2026-06-12-chat-1",
        type: "conversation",
        time: "오전 10:30",
        duration: "4분 12초",
        status: "sunny",
        summary: "최근 검사와 비슷한 흐름이에요.",
      },
      {
        id: "2026-06-12-record-1",
        type: "record",
        time: "오후 7:20",
        duration: "지정문구 2회",
        status: "sunny",
        summary: "특별한 변화는 없어요.",
      },
    ],
  },
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

export default function HistoryPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const weeks = buildCalendar(year, month);
  const selectedKey = dateKey(year, month, selectedDay);
  const selectedHistory = MOCK_HISTORY[selectedKey] ?? null;
  const selectedRecords = selectedHistory?.records ?? [];

  const monthlyKeys = Object.keys(MOCK_HISTORY).filter((key) =>
    key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
  );

  const sunnyCount = monthlyKeys.filter((key) => MOCK_HISTORY[key]?.status === "sunny").length;
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
    router.push({
      pathname: "/done",
      params: {
        date: selectedKey,
        status: record.status,
        type: "history",
        recordId: record.id,
        recordType: record.type,
      },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={[BEIGE, "#FFF2DE", BEIGE]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록 돌아보기</Text>
        <Text style={styles.headerSub}>날씨로 건강 흐름을 살펴봐요</Text>
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
                  const status = MOCK_HISTORY[key]?.status ?? null;
                  const isSelected = day === selectedDay;

                  return (
                    <TouchableOpacity
                      key={di}
                      style={[styles.dayCell, isSelected && styles.selectedCell]}
                      onPress={() => setSelectedDay(day)}
                      activeOpacity={0.78}
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

        {selectedRecords.length > 0 ? (
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
            <Text style={styles.summaryEmoji}>🎈</Text>
            <Text style={styles.summaryText}>
              이번 달 <Text style={styles.summaryHighlight}>{sunnyCount}일</Text> 동안{"\n"}
              맑은 목소리를 들려주셨어요!
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
    backgroundColor: "#E4D7CF",
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

  summaryEmoji: {
    fontSize: 34,
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
});
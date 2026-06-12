import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";

type DayStatus = "sunny" | "cloudy" | "rainy" | null;

const WEATHER_ICON: Record<NonNullable<DayStatus>, string> = {
  sunny: "☀️",
  cloudy: "⛅",
  rainy: "🌧️",
};

const WEATHER_LABEL: Record<NonNullable<DayStatus>, string> = {
  sunny: "맑음",
  cloudy: "흐림",
  rainy: "비",
};

// mock — 실제 연동 시 API 응답으로 교체
const MOCK_HISTORY: Record<string, DayStatus> = {
  "2026-06-01": "sunny",
  "2026-06-02": "sunny",
  "2026-06-03": "cloudy",
  "2026-06-05": "sunny",
  "2026-06-07": "rainy",
  "2026-06-09": "sunny",
  "2026-06-10": "cloudy",
  "2026-06-11": "sunny",
  "2026-06-12": "sunny",
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

export default function HistoryPage() {
  const insets = useSafeAreaInsets();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const weeks = buildCalendar(year, month);
  const sunnyCount = Object.values(MOCK_HISTORY).filter((v) => v === "sunny").length;

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const isThisMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기록 돌아보기</Text>
        <Text style={styles.headerSub}>날씨로 건강 흐름을 살펴봐요</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >

        {/* 월 네비게이션 */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth} accessibilityLabel="이전 달">
            <ChevronLeft size={22} color="#8b7871" />
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
            <ChevronRight size={22} color={isThisMonth ? "#d9cdc9" : "#8b7871"} />
          </TouchableOpacity>
        </View>

        {/* 요일 헤더 */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={styles.weekday}>{d}</Text>
          ))}
        </View>

        {/* 날짜 그리드 */}
        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={styles.dayCell} />;
                const key = dateKey(year, month, day);
                const status = MOCK_HISTORY[key] ?? null;
                const isToday = isThisMonth && day === today.getDate();
                return (
                  <View key={di} style={[styles.dayCell, isToday && styles.todayCell]}>
                    <Text style={[styles.dayNum, isToday && styles.todayNum]}>{day}</Text>
                    {status ? (
                      <Text style={styles.weatherIcon}>{WEATHER_ICON[status]}</Text>
                    ) : (
                      <View style={styles.emptyDot} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* 범례 */}
        <View style={styles.legend}>
          {(["sunny", "cloudy", "rainy"] as DayStatus[]).filter(Boolean).map((s) => (
            <View key={s!} style={styles.legendItem}>
              <Text style={styles.legendEmoji}>{WEATHER_ICON[s!]}</Text>
              <Text style={styles.legendLabel}>{WEATHER_LABEL[s!]}</Text>
            </View>
          ))}
        </View>

        {/* 이번 달 요약 카드 */}
        {isThisMonth && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEmoji}>🎉</Text>
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
  container: { flex: 1, backgroundColor: "#FFF9F2" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#342C28" },
  headerSub: { fontSize: 16, color: "#765E52" },
  scroll: { paddingHorizontal: 16 },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  monthText: { fontSize: 20, fontWeight: "700", color: "#40332D" },
  weekdayRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e2",
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#b6aaa5",
  },
  grid: { gap: 4 },
  weekRow: { flexDirection: "row" },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    gap: 2,
  },
  todayCell: { backgroundColor: "#fff5f4", borderWidth: 1.5, borderColor: "#FF7955" },
  dayNum: { fontSize: 14, color: "#5f4c45", fontWeight: "500" },
  todayNum: { color: "#FF7955", fontWeight: "800" },
  weatherIcon: { fontSize: 20 },
  emptyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ede4df" },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 16,
    padding: 14,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0e8e2",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendEmoji: { fontSize: 18 },
  legendLabel: { fontSize: 16, color: "#8b7871" },
  summaryCard: {
    marginTop: 16,
    padding: 20,
    backgroundColor: "white",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  summaryEmoji: { fontSize: 36 },
  summaryText: { flex: 1, fontSize: 18, color: "#40332D", lineHeight: 28 },
  summaryHighlight: { color: "#FF7955", fontWeight: "800" },
});

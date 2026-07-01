import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import {
  type FamilyReport as FamilyReportData,
  type CheckinCalendar,
} from "./reportTypes";
import { FamilyReport } from "./FamilyReport";
import {
  getReportTrend,
  getMonthlyStats,
  getAvailableMonths,
  getReportAlerts,
  getReportPatterns,
  type TrendPoint,
  type TrendStatus,
  type ReportAlert,
  type VoicePatternItem,
} from "../../api/report";

// real 모드에서만 서버 조회. 그 외(mock)·조회 실패 시 빈 상태로 처리한다.
const REAL_API = process.env.EXPO_PUBLIC_AUTH_API_MODE === "real";

function currentReportMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// 추이 상태 → 차트 y값(0 정상 / 1 주의 / 2 관찰필요)
function chartValue(s: TrendStatus): 0 | 1 | 2 {
  return s === "rainy" ? 2 : s === "cloudy" ? 1 : 0;
}

// 서버 실데이터만으로 해당 월 리포트를 구성한다(mock 베이스 없음).
// voicePatterns 는 /report/patterns 집계 결과. 데이터 부족 시 빈 배열 → "준비 중" 빈 상태.
function buildReport(
  elderName: string,
  month: string,
  trend: TrendPoint[],
  participatedDays: number,
  totalDays: number,
  alerts: ReportAlert[],
  patterns: VoicePatternItem[],
): FamilyReportData {
  // 추이는 최근치를 함께 받으므로 선택된 월의 데이터만 사용한다.
  const monthTrend = trend.filter((p) => p.date.startsWith(month));

  const chartData = monthTrend.map((p) => {
    const [, mo, d] = p.date.split("-").map(Number);
    return { date: `${mo}/${d}`, value: chartValue(p.status) };
  });

  const checkinCalendar: CheckinCalendar = {};
  for (let day = 1; day <= totalDays; day++) checkinCalendar[day] = "missed";
  monthTrend.forEach((p) => {
    const day = Number(p.date.split("-")[2]);
    checkinCalendar[day] =
      p.status === "rainy" ? "attention" : p.status === "cloudy" ? "caution" : "normal";
  });

  const latest: TrendStatus = monthTrend.length
    ? monthTrend[monthTrend.length - 1].status
    : "sunny";
  const hasChange = monthTrend.some((p) => p.status === "rainy");

  return {
    month,
    elderlyName: elderName,
    summary: {
      weather: latest,
      text: hasChange ? "최근 변화 패턴이 확인됐어요" : "안정적인 흐름이 이어졌어요",
    },
    checkinRate: { done: participatedDays, total: totalDays },
    checkinCalendar,
    chartData,
    // icon 은 화면 렌더에서 쓰지 않으므로 빈 문자열(타입 충족용). area/status/text 만 사용.
    voicePatterns: patterns.map((p) => ({
      area: p.area,
      icon: "",
      status: p.status,
      text: p.text,
    })),
    alerts,
  };
}

// 리포트 탭 진입점 — 보호자가 연동한 직접사용자(부모님) 리포트 렌더링
export default function ReportHubPage() {
  const insets = useSafeAreaInsets();

  // 실제 연동된 직접사용자(ACTIVE elder link)만 칩으로 노출한다.
  const links = useAuthStore((s) => s.links);
  const chips = useMemo(() => {
    return links
      .filter((l) => l.status === "ACTIVE" && l.relation === "elder")
      .map((l) => ({ id: l.counterpartId, name: l.counterpartName }));
  }, [links]);

  // 가족 탭 등에서 특정 직접사용자를 지정해 진입할 때 사용 (?elderId=<counterpartId>)
  const { elderId } = useLocalSearchParams<{ elderId?: string }>();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 라우트로 elderId 가 들어오면 그 직접사용자를 선택 (이후 칩 탭으로 변경 가능)
  useEffect(() => {
    if (typeof elderId === "string" && elderId) setSelectedId(elderId);
  }, [elderId]);

  // 선택이 유효하지 않으면(미지정·연동 해제) 첫 칩으로 보정
  const effectiveId =
    selectedId && chips.some((c) => c.id === selectedId)
      ? selectedId
      : chips[0]?.id;

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  // 선택된 직접사용자의 조회 가능한 월 목록 + 현재 선택 월
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentReportMonth());

  // 직접사용자가 바뀌면 가능한 월 목록을 조회하고 선택 월을 최신 월로 초기화한다.
  useEffect(() => {
    if (!REAL_API || !effectiveId) return;
    let alive = true;
    (async () => {
      try {
        const months = await getAvailableMonths(effectiveId);
        if (!alive) return;
        const list = months.length ? months : [currentReportMonth()];
        setAvailableMonths(list);
        setSelectedMonth(list[0]);
      } catch {
        if (alive) {
          setAvailableMonths([currentReportMonth()]);
          setSelectedMonth(currentReportMonth());
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [effectiveId]);

  // (직접사용자, 선택 월)별 서버 리포트 캐시. 실패 시 키 없음 → 빈 상태 표시.
  const [realReports, setRealReports] = useState<Record<string, FamilyReportData>>({});
  useEffect(() => {
    if (!REAL_API || !effectiveId || !selectedMonth) return;
    const elderName = chips.find((c) => c.id === effectiveId)?.name ?? "";
    const cacheKey = `${effectiveId}:${selectedMonth}`;
    let alive = true;
    (async () => {
      try {
        const [trend, stats, alerts, patterns] = await Promise.all([
          getReportTrend(effectiveId, 31),
          getMonthlyStats(effectiveId, selectedMonth),
          getReportAlerts(effectiveId, selectedMonth),
          // '주목할 변화'는 보조 섹션. 엔드포인트 미배포/실패해도 리포트 전체를 죽이지 않고
          // 빈 배열로 폴백해 해당 카드만 "준비 중"으로 둔다.
          getReportPatterns(effectiveId, selectedMonth).catch(
            (): VoicePatternItem[] => [],
          ),
        ]);
        if (alive) {
          setRealReports((prev) => ({
            ...prev,
            [cacheKey]: buildReport(
              elderName,
              selectedMonth,
              trend,
              stats.participatedDays,
              stats.totalDays,
              alerts,
              patterns,
            ),
          }));
        }
      } catch {
        // 조회 실패 — 빈 상태 유지
      }
    })();
    return () => {
      alive = false;
    };
  }, [effectiveId, selectedMonth, chips]);

  // real 조회분이 있으면 표시, 없으면 null → 빈 상태.
  const report = effectiveId ? realReports[`${effectiveId}:${selectedMonth}`] ?? null : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>리포트</Text>
      </View>

      {/* 상단 가로 스크롤 칩 셀렉터 */}
      {/* style에 flexGrow/Shrink 0 을 줘서 가로 ScrollView 가 세로로 눌리지 않게 한다.
          (RNW 가로 ScrollView 는 overflow-y:hidden 이라 세로가 눌리면 칩 글자가 잘린다) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {chips.map((chip) => {
          const active = chip.id === effectiveId;
          const label = `${chip.name} 님`;
          return (
            <Pressable
              key={chip.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedId(chip.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 하단: 선택된 사람의 리포트 */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        {chips.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>연결된 부모님이 없어요</Text>
            <Text style={styles.emptySub}>
              가족 탭에서 부모님을 연결하면{"\n"}이곳에서 리포트를 확인할 수 있어요.
            </Text>
          </View>
        ) : !report ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>아직 표시할 리포트가 없어요</Text>
            <Text style={styles.emptySub}>
              건강 기록이 쌓이면{"\n"}이곳에서 리포트를 확인할 수 있어요.
            </Text>
          </View>
        ) : (
          <FamilyReport
            report={report}
            months={availableMonths}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            onToast={showToast}
          />
        )}
      </ScrollView>

      {/* 전역 토스트 */}
      {toast ? (
        <View
          style={[styles.toast, { bottom: insets.bottom + 130 }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFF8EF" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 24,
    color: "#3B2318",
  },
  // 가로 ScrollView 자체는 콘텐츠 높이를 그대로 쓰게 고정(세로 눌림/잘림 방지)
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexShrink: 0,
    minWidth: 72,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECF5",
  },
  chipActive: {
    backgroundColor: "#4F76A8",
    borderColor: "#4F76A8",
  },
  chipText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 15,
    lineHeight: 24,
    includeFontPadding: false,
    textAlignVertical: "center",
    color: "#765E52",
  },
  chipTextActive: { color: "#FFFFFF" },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 96,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Pretendard-Bold",
    fontSize: 18,
    color: "#3B2318",
  },
  emptySub: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    lineHeight: 22,
    color: "#765E52",
    textAlign: "center",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: "#3B2318",
  },
  toastText: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
  },
});

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
import { mockFamilyReports } from "./mockReport";
import { FamilyReport } from "./FamilyReport";

// 선택된 직접사용자에 표시할 mock 리포트 (실제 API 연결 전까지 placeholder)
const FALLBACK_REPORT = Object.values(mockFamilyReports)[0];

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

  // 리포트 본문 데이터는 아직 mock — 매칭 없으면 기본 mock 리포트 표시
  const report = effectiveId ? mockFamilyReports[effectiveId] ?? FALLBACK_REPORT : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>리포트</Text>
      </View>

      {/* 상단 가로 스크롤 칩 셀렉터 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
        {!report ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>연결된 부모님이 없어요</Text>
            <Text style={styles.emptySub}>
              가족 탭에서 부모님을 연결하면{"\n"}이곳에서 리포트를 확인할 수 있어요.
            </Text>
          </View>
        ) : (
          <FamilyReport report={report} onToast={showToast} />
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
  chipRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexShrink: 0,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../styles/tokens";
import { useAuthStore } from "../../stores/authStore";
import { mockFamilyReports } from "./mockReport";
import { FamilyReport } from "./FamilyReport";
import { MyReport } from "./MyReport";

const G = colors.guardian;

// 선택된 직접사용자에 표시할 mock 리포트 (실제 API 연결 전까지 placeholder)
const FALLBACK_REPORT = Object.values(mockFamilyReports)[0];

// 리포트 탭 진입점 — 상단 칩 셀렉터 + 선택 대상 리포트 렌더링
export default function ReportHubPage() {
  const insets = useSafeAreaInsets();

  // 실제 연동된 직접사용자(ACTIVE elder link) → 칩. + 항상 "내 리포트" 칩.
  const links = useAuthStore((s) => s.links);
  const chips = useMemo(() => {
    const elders = links
      .filter((l) => l.status === "ACTIVE" && l.relation === "elder")
      .map((l) => ({ id: l.counterpartId, name: l.counterpartName }));
    return [...elders, { id: "me", name: "내 리포트" }];
  }, [links]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 연동 변동으로 선택이 사라지면 첫 칩으로 보정
  const effectiveId =
    selectedId && chips.some((c) => c.id === selectedId)
      ? selectedId
      : chips[0].id;

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

  const isMe = effectiveId === "me";
  // 리포트 본문 데이터는 아직 mock — 매칭 없으면 기본 mock 리포트 표시
  const report = mockFamilyReports[effectiveId] ?? FALLBACK_REPORT;

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
          // 실제 사람 이름에만 "님"을 붙이고, "내 리포트"는 그대로 둔다.
          const label = chip.id === "me" ? chip.name : `${chip.name} 님`;
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
        {isMe || !report ? (
          <MyReport />
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
  screen: { flex: 1, backgroundColor: G.bgPage },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 24,
    color: G.textPrimary,
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
    backgroundColor: G.card,
    borderWidth: 1,
    borderColor: G.border,
  },
  chipActive: {
    backgroundColor: G.amber,
    borderColor: G.amber,
  },
  chipText: {
    fontFamily: "Pretendard-Bold",
    fontSize: 15,
    color: G.textSecondary,
  },
  chipTextActive: { color: "#FFFFFF" },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: G.textPrimary,
  },
  toastText: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
  },
});

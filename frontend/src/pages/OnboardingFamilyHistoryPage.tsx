import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useAuthStore } from "../stores/authStore";

// 온보딩 3/3 — 가족력(복수 선택). "해당 없음"/"잘 모르겠어요" 선택 시 질병 해제 + 빈 배열 저장.
const DISEASES = [
  { emoji: "🧠", label: "치매" },
  { emoji: "🤝", label: "파킨슨" },
  { emoji: "🩺", label: "당뇨병" },
  { emoji: "🫀", label: "뇌졸중" },
] as const;

type NoneMode = "none" | "unknown" | null;

export default function OnboardingFamilyHistoryPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setOnboardingFamilyHistory = useAuthStore((s) => s.setOnboardingFamilyHistory);
  const setOnboardingDone = useAuthStore((s) => s.setOnboardingDone);

  const [selected, setSelected] = useState<string[]>([]);
  const [noneMode, setNoneMode] = useState<NoneMode>(null);

  const hasSelection = selected.length > 0 || noneMode !== null;

  function toggleDisease(label: string) {
    setNoneMode(null);
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label],
    );
  }

  function selectNone(mode: Exclude<NoneMode, null>) {
    setSelected([]);
    setNoneMode(mode);
  }

  function handleNext() {
    if (!hasSelection) return;
    // 없음/모름 선택 시 빈 배열로 저장.
    setOnboardingFamilyHistory(noneMode ? [] : selected);
    setOnboardingDone(true); // 온보딩 완료 → 가드 통과
    router.replace("/(elder)/");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
        >
          <ArrowLeft size={24} color="#756a66" />
        </TouchableOpacity>
        <Text style={styles.progress}>3/3</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>가족 중 이런 병을 앓으신 분이 있나요?</Text>
        <Text style={styles.subtitle}>해당하는 것을 모두 눌러주세요</Text>

        <View style={styles.grid}>
          {DISEASES.map((d) => {
            const isSelected = noneMode === null && selected.includes(d.label);
            return (
              <TouchableOpacity
                key={d.label}
                style={[styles.gridItem, isSelected ? styles.itemSelected : styles.itemUnselected]}
                onPress={() => toggleDisease(d.label)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={d.label}
              >
                <Text style={styles.gridEmoji}>{d.emoji}</Text>
                <Text style={[styles.gridLabel, isSelected && styles.labelSelected]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.soleBtn, noneMode === "none" ? styles.itemSelected : styles.itemUnselected]}
          onPress={() => selectNone("none")}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: noneMode === "none" }}
          accessibilityLabel="해당 없음"
        >
          <Text style={[styles.soleText, noneMode === "none" && styles.labelSelected]}>해당 없음</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.soleBtn, noneMode === "unknown" ? styles.itemSelected : styles.itemUnselected]}
          onPress={() => selectNone("unknown")}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: noneMode === "unknown" }}
          accessibilityLabel="잘 모르겠어요"
        >
          <Text style={[styles.soleText, noneMode === "unknown" && styles.labelSelected]}>
            잘 모르겠어요
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, hasSelection ? styles.nextBtnActive : styles.nextBtnDisabled]}
          onPress={handleNext}
          activeOpacity={0.85}
          disabled={!hasSelection}
          accessibilityRole="button"
          accessibilityLabel="다음"
        >
          <Text style={styles.nextBtnText}>다음</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2", paddingHorizontal: 24 },
  topBar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  progress: { fontSize: 15, fontWeight: "700", color: "#888888" },
  body: { flex: 1, paddingTop: 20, gap: 12 },
  title: { fontSize: 22, lineHeight: 31, fontWeight: "800", color: "#342C28" },
  subtitle: { fontSize: 16, lineHeight: 23, color: "#888888" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginTop: 6,
  },
  gridItem: {
    width: "48%",
    height: 72,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  gridEmoji: { fontSize: 24 },
  gridLabel: { fontSize: 20, fontWeight: "800", color: "#5a4d46" },
  itemUnselected: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C8D0E0" },
  itemSelected: { backgroundColor: "#FDECDD", borderWidth: 2, borderColor: "#FF7955" },
  labelSelected: { color: "#B5471F" },
  soleBtn: {
    width: "100%",
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  soleText: { fontSize: 20, fontWeight: "800", color: "#5a4d46" },
  footer: { paddingTop: 8 },
  nextBtn: { height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nextBtnActive: { backgroundColor: "#FF7955" },
  nextBtnDisabled: { backgroundColor: "#C8D0E0" },
  nextBtnText: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
});

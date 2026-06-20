import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import {
  useAuthStore,
  type FamilyHistoryDetails,
  type FamilyHistoryLevel,
} from "../stores/authStore";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DISEASES = [
  { key: "dementia", emoji: "🧠", label: "치매", bg: "#EDE7F6", accent: "#7B5EA7" },
  { key: "parkinson", emoji: "🤝", label: "파킨슨", bg: "#E3F2FD", accent: "#1976D2" },
  { key: "diabetes", emoji: "🩺", label: "당뇨병", bg: "#FFF3E0", accent: "#E8943A" },
  { key: "stroke", emoji: "🫀", label: "뇌졸중", bg: "#FCE4EC", accent: "#A64D79" },
] as const;

type DiseaseKey = (typeof DISEASES)[number]["key"];
type NoneMode = "none" | "unknown" | null;
type FamilyHistoryDraft = Record<DiseaseKey, FamilyHistoryLevel | null>;

const DETAIL_OPTIONS: { value: FamilyHistoryLevel; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "parent_one", label: "부모 중 1명" },
  { value: "parents_both", label: "부모 모두" },
  { value: "grandparent_or_more", label: "조부모 포함 있음" },
  { value: "unknown", label: "잘 모르겠음" },
];

const EMPTY_DETAILS: FamilyHistoryDetails = {
  dementia: "none",
  parkinson: "none",
  diabetes: "none",
  stroke: "none",
};

const EMPTY_DRAFT: FamilyHistoryDraft = {
  dementia: null,
  parkinson: null,
  diabetes: null,
  stroke: null,
};

export default function OnboardingFamilyHistoryPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setOnboardingFamilyHistory = useAuthStore((s) => s.setOnboardingFamilyHistory);
  const setFamilyHistoryDetails = useAuthStore((s) => s.setFamilyHistoryDetails);
  const setOnboardingDone = useAuthStore((s) => s.setOnboardingDone);

  const [selected, setSelected] = useState<DiseaseKey[]>([]);
  const [details, setDetails] = useState<FamilyHistoryDraft>({ ...EMPTY_DRAFT });
  const [noneMode, setNoneMode] = useState<NoneMode>(null);

  const selectedDiseases = DISEASES.filter((disease) => selected.includes(disease.key));
  const detailsComplete = selected.every((key) => details[key] !== null);
  const canNext = noneMode !== null || (selected.length > 0 && detailsComplete);

  function animate() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }

  function toggleDisease(key: DiseaseKey) {
    animate();
    setNoneMode(null);
    setSelected((previous) => {
      if (!previous.includes(key)) return [...previous, key];
      setDetails((current) => ({ ...current, [key]: null }));
      return previous.filter((item) => item !== key);
    });
  }

  function selectNone(mode: Exclude<NoneMode, null>) {
    animate();
    setSelected([]);
    setDetails({ ...EMPTY_DRAFT });
    setNoneMode(mode);
  }

  function selectDetail(key: DiseaseKey, value: FamilyHistoryLevel) {
    setDetails((previous) => ({ ...previous, [key]: value }));
  }

  function handleNext() {
    if (!canNext) return;

    const result: FamilyHistoryDetails = { ...EMPTY_DETAILS };
    if (noneMode === "unknown") {
      for (const disease of DISEASES) result[disease.key] = "unknown";
    } else if (noneMode === null) {
      for (const key of selected) result[key] = details[key] ?? "none";
    }

    setOnboardingFamilyHistory(
      noneMode ? [] : DISEASES.filter((disease) => selected.includes(disease.key)).map((disease) => disease.label),
    );
    setFamilyHistoryDetails(result);
    setOnboardingDone(true);
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
        <Text style={styles.progress}>2/2</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>가족 중 앓으신 분이 있나요?</Text>
        <Text style={styles.subtitle}>해당하는 질환을 모두 선택해 주세요</Text>

        <View style={styles.grid}>
          {DISEASES.map((disease) => {
            const isSelected = noneMode === null && selected.includes(disease.key);
            return (
              <TouchableOpacity
                key={disease.key}
                style={[
                  styles.diseaseCard,
                  isSelected
                    ? { backgroundColor: disease.bg, borderColor: disease.accent, borderWidth: 2 }
                    : styles.diseaseCardOff,
                ]}
                onPress={() => toggleDisease(disease.key)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={disease.label}
              >
                <Text style={styles.diseaseEmoji}>{disease.emoji}</Text>
                <Text style={[styles.diseaseLabel, isSelected && { color: disease.accent }]}>
                  {disease.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedDiseases.length > 0 ? (
          <Text style={styles.detailSectionHeading}>
            선택한 질환별 가족력 상세 ({selectedDiseases.length}개)
          </Text>
        ) : null}

        {selectedDiseases.map((disease) => (
          <View key={disease.key} style={[styles.detailPanel, { borderColor: disease.accent }]}>
            <Text style={[styles.detailTitle, { color: disease.accent }]}>
              {disease.label} 가족력이 있으신가요?
            </Text>
            <View style={styles.detailOptions}>
              {DETAIL_OPTIONS.map((option) => {
                const isSelected = details[disease.key] === option.value;
                return (
                  <TouchableOpacity
                    key={`${disease.key}-${option.value}`}
                    style={[styles.detailButton, isSelected && styles.detailButtonOn]}
                    onPress={() => selectDetail(disease.key, option.value)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${disease.label} ${option.label}`}
                  >
                    <Text style={[styles.detailButtonText, isSelected && styles.detailButtonTextOn]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.soleButton, noneMode === "none" && styles.soleButtonOn]}
          onPress={() => selectNone("none")}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: noneMode === "none" }}
          accessibilityLabel="해당 없음"
        >
          <Text style={[styles.soleButtonText, noneMode === "none" && styles.soleButtonTextOn]}>
            해당 없음
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.soleButton, noneMode === "unknown" && styles.soleButtonOn]}
          onPress={() => selectNone("unknown")}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: noneMode === "unknown" }}
          accessibilityLabel="전체 가족력을 잘 모르겠어요"
        >
          <Text style={[styles.soleButtonText, noneMode === "unknown" && styles.soleButtonTextOn]}>
            전체 가족력을 잘 모르겠어요
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {!canNext && selected.length > 0 ? (
          <Text style={styles.validationText}>선택한 질환의 가족력 정보를 모두 선택해 주세요.</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.nextButton, canNext ? styles.nextButtonOn : styles.nextButtonOff]}
          onPress={handleNext}
          activeOpacity={0.85}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="다음"
        >
          <Text style={styles.nextButtonText}>다음</Text>
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
  body: { paddingTop: 16, paddingBottom: 28, gap: 14 },
  title: { fontSize: 24, lineHeight: 33, fontWeight: "800", color: "#342C28" },
  subtitle: { fontSize: 18, lineHeight: 25, color: "#888888" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginTop: 4,
  },
  diseaseCard: {
    width: "48%",
    minHeight: 80,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  diseaseCardOff: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C8D0E0" },
  diseaseEmoji: { fontSize: 24 },
  diseaseLabel: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  detailSectionHeading: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "900",
    color: "#40332D",
  },
  detailPanel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#FFFFFF",
    gap: 14,
  },
  detailTitle: { fontSize: 20, lineHeight: 28, fontWeight: "900" },
  detailOptions: { gap: 9 },
  detailButton: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#C8D0E0",
    borderRadius: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  detailButtonOn: { borderWidth: 2, borderColor: "#FF7955", backgroundColor: "#FDECDD" },
  detailButtonText: { fontSize: 18, lineHeight: 25, fontWeight: "800", color: "#5A4D46" },
  detailButtonTextOn: { color: "#B5471F" },
  soleButton: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: "#C8D0E0",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
  soleButtonOn: { borderWidth: 2, borderColor: "#888888", backgroundColor: "#FFFFFF" },
  soleButtonText: { fontSize: 18, fontWeight: "800", color: "#888888" },
  soleButtonTextOn: { color: "#40332D" },
  footer: { paddingTop: 8, gap: 8 },
  validationText: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: "#E8943A", textAlign: "center" },
  nextButton: { height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nextButtonOn: { backgroundColor: "#FF7955" },
  nextButtonOff: { backgroundColor: "#C8D0E0" },
  nextButtonText: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
});

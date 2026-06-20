import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useAuthStore, type SeniorGender } from "../stores/authStore";

// 온보딩 2/3 — 성별. 버튼 2개 중 1개 선택 → 다음 활성화.
export default function OnboardingGenderPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setOnboardingGender = useAuthStore((s) => s.setOnboardingGender);

  const [gender, setGender] = useState<SeniorGender | null>(null);

  function handleNext() {
    if (!gender) return;
    setOnboardingGender(gender);
    router.push("/(elder)/onboarding/family-history");
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
        <Text style={styles.progress}>2/3</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>성별을 알려주세요</Text>

        <View style={styles.choiceRow}>
          {(["male", "female"] as const).map((value) => {
            const selected = gender === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.choice, selected ? styles.choiceSelected : styles.choiceUnselected]}
                onPress={() => setGender(value)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={value === "male" ? "남성" : "여성"}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                  {value === "male" ? "남성" : "여성"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, gender ? styles.nextBtnActive : styles.nextBtnDisabled]}
          onPress={handleNext}
          activeOpacity={0.85}
          disabled={!gender}
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
  body: { flex: 1, paddingTop: 24, gap: 28 },
  title: { fontSize: 24, lineHeight: 33, fontWeight: "800", color: "#342C28" },
  choiceRow: { flexDirection: "row", justifyContent: "space-between" },
  choice: {
    width: "47%",
    height: 80,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceUnselected: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C8D0E0" },
  choiceSelected: { backgroundColor: "#FDECDD", borderWidth: 2, borderColor: "#FF7955" },
  choiceText: { fontSize: 22, fontWeight: "800", color: "#5a4d46" },
  choiceTextSelected: { color: "#B5471F" },
  footer: { paddingTop: 8 },
  nextBtn: { height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nextBtnActive: { backgroundColor: "#FF7955" },
  nextBtnDisabled: { backgroundColor: "#C8D0E0" },
  nextBtnText: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
});

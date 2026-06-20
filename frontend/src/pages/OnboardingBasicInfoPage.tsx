import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle } from "lucide-react-native";
import { useAuthStore, type SeniorGender } from "../stores/authStore";

// 온보딩 1/2 — 기본 정보(생년월일 + 성별).
// 생년월일은 주민번호 앞 6자리(YYMMDD) 스타일. YY 00~24 → 2000년대, 25~99 → 1900년대.
const MONTH_NAMES = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

interface ParsedBirth {
  fullYear: number;
  month: number;
  day: number;
  valid: boolean;
  reason: "month" | "day" | null;
}

function parseBirth(digits: string): ParsedBirth | null {
  if (digits.length !== 6) return null;
  const yy = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const fullYear = yy <= 24 ? 2000 + yy : 1900 + yy;
  if (month < 1 || month > 12) return { fullYear, month, day, valid: false, reason: "month" };
  if (day < 1 || day > 31) return { fullYear, month, day, valid: false, reason: "day" };
  return { fullYear, month, day, valid: true, reason: null };
}

export default function OnboardingBasicInfoPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setOnboardingBirthDate = useAuthStore((s) => s.setOnboardingBirthDate);
  const setOnboardingGender = useAuthStore((s) => s.setOnboardingGender);

  const [digits, setDigits] = useState("");
  const [gender, setGender] = useState<SeniorGender | null>(null);

  const parsed = useMemo(() => parseBirth(digits), [digits]);
  const birthValid = parsed?.valid === true;
  const showBirthError = digits.length === 6 && parsed?.valid === false;
  const canNext = birthValid && gender !== null;

  const birthErrorMessage =
    parsed?.reason === "month"
      ? "가운데 2자리(월)를 01~12로 입력해 주세요."
      : parsed?.reason === "day"
        ? "마지막 2자리(일)를 01~31로 입력해 주세요."
        : "";

  function handleNext() {
    if (!parsed || !parsed.valid || !gender) return;
    const mm = String(parsed.month).padStart(2, "0");
    const dd = String(parsed.day).padStart(2, "0");
    setOnboardingBirthDate(`${parsed.fullYear}-${mm}-${dd}`);
    setOnboardingGender(gender);
    router.push("/(elder)/onboarding/family-history");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Text style={styles.progress}>1/2</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>기본 정보를 알려주세요</Text>

        {/* 생년월일 */}
        <View style={styles.section}>
          <Text style={styles.label}>생년월일</Text>
          <TextInput
            style={[styles.birthInput, showBirthError && styles.inputError]}
            value={digits}
            onChangeText={(value) => setDigits(value.replace(/\D/g, "").slice(0, 6))}
            placeholder="예: 500426"
            placeholderTextColor="#B7BECB"
            keyboardType="numeric"
            maxLength={6}
            accessibilityLabel="생년월일 6자리 입력"
          />
          {birthValid && parsed ? (
            <Text style={styles.birthPreview}>
              {parsed.fullYear}년 {MONTH_NAMES[parsed.month]}월 {parsed.day}일
            </Text>
          ) : null}
          {showBirthError ? (
            <View style={styles.errorRow}>
              <AlertCircle size={20} color="#E8943A" strokeWidth={2.4} />
              <Text style={styles.errorText}>{birthErrorMessage}</Text>
            </View>
          ) : null}
        </View>

        {/* 성별 */}
        <View style={styles.section}>
          <Text style={styles.label}>성별</Text>
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, canNext ? styles.nextBtnActive : styles.nextBtnDisabled]}
          onPress={handleNext}
          activeOpacity={0.85}
          disabled={!canNext}
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
  topBar: { height: 40, justifyContent: "center" },
  progress: { fontSize: 15, fontWeight: "700", color: "#888888" },
  body: { paddingTop: 20, paddingBottom: 24, gap: 28 },
  title: { fontSize: 24, lineHeight: 33, fontWeight: "800", color: "#342C28" },
  section: { gap: 12 },
  label: { fontSize: 18, fontWeight: "700", color: "#888888" },
  birthInput: {
    height: 72,
    borderWidth: 1,
    borderColor: "#C8D0E0",
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 8,
    color: "#342C28",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
  },
  inputError: { borderColor: "#E8943A", borderWidth: 2 },
  birthPreview: { fontSize: 20, lineHeight: 27, fontWeight: "800", color: "#FF7955" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: "700", color: "#E8943A" },
  choiceRow: { flexDirection: "row", justifyContent: "space-between" },
  choice: {
    width: "47%",
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceUnselected: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C8D0E0" },
  choiceSelected: { backgroundColor: "#FDECDD", borderWidth: 2, borderColor: "#FF7955" },
  choiceText: { fontSize: 22, fontWeight: "800", color: "#5a4d46" },
  choiceTextSelected: { color: "#FF7955" },
  footer: { paddingTop: 8 },
  nextBtn: { height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nextBtnActive: { backgroundColor: "#FF7955" },
  nextBtnDisabled: { backgroundColor: "#C8D0E0" },
  nextBtnText: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
});

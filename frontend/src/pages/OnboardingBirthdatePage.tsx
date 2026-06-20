import { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle } from "lucide-react-native";
import { useAuthStore } from "../stores/authStore";

// 온보딩 1/3 — 생년월일.
// 입력칸 3개(년/월/일) 가로 배열, 자동 포커스 이동, 범위 유효성 검사.
type ErrorField = "year" | "month" | "day" | null;

export default function OnboardingBirthdatePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setOnboardingBirthDate = useAuthStore((s) => s.setOnboardingBirthDate);

  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [errorField, setErrorField] = useState<ErrorField>(null);
  const [error, setError] = useState("");

  const monthRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);

  const filled = year.length === 4 && month.length >= 1 && day.length >= 1;

  function clearError() {
    if (errorField) {
      setErrorField(null);
      setError("");
    }
  }

  function handleYear(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setYear(digits);
    clearError();
    if (digits.length === 4) monthRef.current?.focus();
  }

  function handleMonth(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    setMonth(digits);
    clearError();
    if (digits.length === 2) dayRef.current?.focus();
  }

  function handleDay(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    setDay(digits);
    clearError();
  }

  function handleNext() {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);

    if (year.length !== 4 || y < 1930 || y > 2010) {
      setErrorField("year");
      setError("출생 연도를 1930년부터 2010년 사이로 입력해 주세요.");
      return;
    }
    if (m < 1 || m > 12) {
      setErrorField("month");
      setError("월을 01부터 12 사이로 입력해 주세요.");
      return;
    }
    if (d < 1 || d > 31) {
      setErrorField("day");
      setError("일을 01부터 31 사이로 입력해 주세요.");
      return;
    }

    const birthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    setOnboardingBirthDate(birthDate);
    router.push("/(elder)/onboarding/gender");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Text style={styles.progress}>1/3</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>생년월일을 알려주세요</Text>
        <Text style={styles.subtitle}>숫자로 입력해 주세요</Text>

        <View style={styles.dateRow}>
          <TextInput
            style={[styles.dateInput, styles.yearInput, errorField === "year" && styles.inputError]}
            value={year}
            onChangeText={handleYear}
            placeholder="1950"
            placeholderTextColor="#B7BECB"
            keyboardType="numeric"
            maxLength={4}
            accessibilityLabel="출생 연도 입력"
          />
          <Text style={styles.dash}>-</Text>
          <TextInput
            ref={monthRef}
            style={[styles.dateInput, errorField === "month" && styles.inputError]}
            value={month}
            onChangeText={handleMonth}
            placeholder="01"
            placeholderTextColor="#B7BECB"
            keyboardType="numeric"
            maxLength={2}
            accessibilityLabel="출생 월 입력"
          />
          <Text style={styles.dash}>-</Text>
          <TextInput
            ref={dayRef}
            style={[styles.dateInput, errorField === "day" && styles.inputError]}
            value={day}
            onChangeText={handleDay}
            placeholder="01"
            placeholderTextColor="#B7BECB"
            keyboardType="numeric"
            maxLength={2}
            accessibilityLabel="출생 일 입력"
          />
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <AlertCircle size={20} color="#E8943A" strokeWidth={2.4} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, filled ? styles.nextBtnActive : styles.nextBtnDisabled]}
          onPress={handleNext}
          activeOpacity={0.85}
          disabled={!filled}
          accessibilityRole="button"
          accessibilityLabel="다음"
        >
          <Text style={[styles.nextBtnText, !filled && styles.nextBtnTextDisabled]}>다음</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2", paddingHorizontal: 24 },
  topBar: { height: 40, justifyContent: "center" },
  progress: { fontSize: 15, fontWeight: "700", color: "#888888" },
  body: { flex: 1, paddingTop: 24, gap: 14 },
  title: { fontSize: 24, lineHeight: 33, fontWeight: "800", color: "#342C28" },
  subtitle: { fontSize: 16, lineHeight: 23, color: "#888888" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  dateInput: {
    flex: 1,
    height: 64,
    borderWidth: 1,
    borderColor: "#C8D0E0",
    borderRadius: 16,
    paddingHorizontal: 12,
    fontSize: 24,
    fontWeight: "700",
    color: "#342C28",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
  },
  yearInput: { flex: 1.7 },
  inputError: { borderColor: "#E8943A", borderWidth: 2 },
  dash: { fontSize: 24, fontWeight: "800", color: "#A99A92" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  errorText: { flex: 1, fontSize: 16, lineHeight: 23, fontWeight: "700", color: "#E8943A" },
  footer: { paddingTop: 8 },
  nextBtn: { height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nextBtnActive: { backgroundColor: "#FF7955" },
  nextBtnDisabled: { backgroundColor: "#C8D0E0" },
  nextBtnText: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  nextBtnTextDisabled: { color: "#FFFFFF" },
});

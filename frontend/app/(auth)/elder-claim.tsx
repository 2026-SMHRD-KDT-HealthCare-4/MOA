import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, KeyRound, AlertCircle, ShieldCheck } from "lucide-react-native";
import { useAuthStore, type SeniorGender } from "../../src/stores/authStore";
import * as authApi from "../../src/api/auth";

function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function isValidBirthDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  );
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

// 직접사용자 초대코드 클레임 화면.
// 화면 순서는 동의 → 코드지만, 커밋 순서는 claim → consent.
// (코드로 계정을 클레임해야 그 계정에 동의를 기록할 수 있기 때문)
export default function ElderClaimPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ consented?: string; inviteToken?: string }>();
  const setSession = useAuthStore((s) => s.setSession);
  const setOnboardingBirthDate = useAuthStore((s) => s.setOnboardingBirthDate);
  const setOnboardingGender = useAuthStore((s) => s.setOnboardingGender);

  // 음성 데이터 동의는 이 화면에서 함께 받는다. (이전 동의 화면이 선택 허브로 바뀌어 여기로 통합)
  // 혹시 외부에서 consented=1 로 들어오면 기본 체크 상태로 시작한다.
  const [agreed, setAgreed] = useState(params.consented === "1");

  const [code, setCode] = useState(params.inviteToken ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<SeniorGender | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleClaim() {
    if (!code.trim()) return setError("보호자에게 받은 초대 코드를 입력해 주세요.");
    if (!birthDate.trim()) return setError("생년월일을 입력해 주세요.");
    if (!isValidBirthDate(birthDate)) return setError("생년월일을 YYYY-MM-DD 형식으로 입력해 주세요.");
    if (!phone.trim()) return setError("전화번호를 입력해 주세요.");
    if (!/^\d{3}-\d{3,4}-\d{4}$/.test(phone)) {
      return setError("전화번호를 010-1234-5678 형식으로 입력해 주세요.");
    }
    if (!gender) return setError("성별을 선택해 주세요.");
    if (!agreed) return setError("음성 데이터 활용에 동의해 주세요.");

    setSubmitting(true);
    try {
      // 2-step + 자동 credential: 토큰+동의 → FE가 throwaway email/pw 생성 →
      // registerSenior → login → 세션 저장. 사람은 credential 을 입력하지 않는다.
      const res = await authApi.claimSenior({
        token: code,
        birth_date: birthDate,
        phone,
        consent: agreed,
      });
      const { user, refreshToken, consentDone, familyGroup, links, guardianMembers } = res.data;

      setSession(user, { refreshToken, consentDone, familyGroup, links, guardianMembers });
      // 첫 화면에서 받은 생년월일·성별을 온보딩 프로필에 저장 → 기본정보 단계 생략.
      setOnboardingBirthDate(birthDate);
      setOnboardingGender(gender);
      setError("");
      // 클레임 직후 가족력 입력으로 바로 진입.
      router.replace("/(elder)/onboarding/family-history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="뒤로 가기">
          <ArrowLeft size={24} color="#756a66" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>초대 코드 입력</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroIcon}>
          <KeyRound size={34} color="#FF7955" />
        </View>

        <Text style={styles.title}>보호자에게 받은{"\n"}코드를 입력해 주세요</Text>
        <Text style={styles.lead}>가족이 보내준 초대 코드를 넣으면 연결이 완료돼요.</Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="예: ABC-123"
          placeholderTextColor="#c4b5ae"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          accessibilityLabel="초대 코드 입력"
        />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>생년월일</Text>
          <TextInput
            style={styles.infoInput}
            value={birthDate}
            onChangeText={(value) => setBirthDate(formatBirthDate(value))}
            placeholder="예: 1940-01-01"
            placeholderTextColor="#c4b5ae"
            keyboardType="number-pad"
            maxLength={10}
            accessibilityLabel="생년월일 입력"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>성별</Text>
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

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>전화번호</Text>
          <TextInput
            style={styles.infoInput}
            value={phone}
            onChangeText={(value) => setPhone(formatPhone(value))}
            placeholder="예: 010-1234-5678"
            placeholderTextColor="#c4b5ae"
            keyboardType="phone-pad"
            maxLength={13}
            accessibilityLabel="전화번호 입력"
          />
        </View>

        <View style={styles.consentBox}>
          <View style={styles.consentHead}>
            <ShieldCheck size={20} color="#FF7955" strokeWidth={2.4} />
            <Text style={styles.consentTitle}>음성 데이터 활용 동의</Text>
          </View>
          <Text style={styles.consentItem}>목소리 변화 패턴을 참고용으로 기록하고 살펴봐요.</Text>
          <Text style={styles.consentItem}>녹음 파일은 분석이 끝나면 바로 지우고 기기에 저장하지 않아요.</Text>
          <Text style={styles.consentItem}>의료 행위가 아닌, 일상 변화를 살펴보는 참고 서비스예요.</Text>
          <TouchableOpacity
            style={styles.agreeRow}
            onPress={() => setAgreed((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="음성 데이터 활용에 동의"
          >
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed ? <Text style={styles.checkboxTick}>✓</Text> : null}
            </View>
            <Text style={styles.agreeText}>위 내용을 확인했고 동의합니다</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <AlertCircle size={20} color="#E8943A" strokeWidth={2.4} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, (submitting || !agreed) && styles.primaryBtnDisabled]}
          onPress={handleClaim}
          activeOpacity={0.85}
          disabled={submitting || !agreed}
        >
          <Text style={styles.primaryBtnText}>{submitting ? "연결 중…" : "연결하기"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9F2" },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  backBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 18, fontWeight: "800", color: "#4d403b" },
  scroll: { paddingHorizontal: 24, paddingTop: 8, gap: 18 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#FFE9E6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 28, lineHeight: 38, fontWeight: "800", color: "#342C28" },
  lead: { fontSize: 19, lineHeight: 29, color: "#5a4d46" },
  codeInput: {
    height: 68,
    borderWidth: 1.5,
    borderColor: "#e8ddd9",
    borderRadius: 16,
    paddingHorizontal: 18,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#342C28",
    backgroundColor: "white",
    textAlign: "center",
  },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 18, lineHeight: 25, fontWeight: "800", color: "#4d403b" },
  infoInput: {
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: "#e8ddd9",
    borderRadius: 16,
    paddingHorizontal: 18,
    fontSize: 20,
    color: "#342C28",
    backgroundColor: "white",
  },
  choiceRow: { flexDirection: "row", justifyContent: "space-between" },
  choice: {
    width: "47%",
    minHeight: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceUnselected: { backgroundColor: "white", borderWidth: 1.5, borderColor: "#e8ddd9" },
  choiceSelected: { backgroundColor: "#FDECDD", borderWidth: 2, borderColor: "#FF7955" },
  choiceText: { fontSize: 20, fontWeight: "800", color: "#5a4d46" },
  choiceTextSelected: { color: "#FF7955" },
  consentBox: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    padding: 18,
    gap: 10,
  },
  consentHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  consentTitle: { fontSize: 18, fontWeight: "800", color: "#342C28" },
  consentItem: { fontSize: 16, lineHeight: 24, color: "#5a4d46" },
  agreeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#f0e8e2",
    paddingTop: 10,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#E6D9D2",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  checkboxOn: { backgroundColor: "#FF7955", borderColor: "#FF7955" },
  checkboxTick: { fontSize: 17, fontWeight: "900", color: "white", lineHeight: 20 },
  agreeText: { flex: 1, fontSize: 17, fontWeight: "700", color: "#4d403b" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { flex: 1, fontSize: 17, lineHeight: 24, fontWeight: "700", color: "#E8943A" },
  primaryBtn: {
    height: 64,
    borderRadius: 16,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 22, fontWeight: "800", color: "white" },
});

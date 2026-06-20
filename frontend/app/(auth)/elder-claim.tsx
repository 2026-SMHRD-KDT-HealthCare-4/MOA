import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, KeyRound, AlertCircle } from "lucide-react-native";
import { useAuthStore } from "../../src/stores/authStore";
import * as authApi from "../../src/api/auth";

// 직접사용자 초대코드 클레임 화면.
// 화면 순서는 동의 → 코드지만, 커밋 순서는 claim → consent.
// (코드로 계정을 클레임해야 그 계정에 동의를 기록할 수 있기 때문)
export default function ElderClaimPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ consented?: string }>();
  const setSession = useAuthStore((s) => s.setSession);

  // 이전 화면(동의)에서 넘어온 동의 의사. 클레임 성공 직후 함께 제출한다.
  const consented = params.consented === "1";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleClaim() {
    if (!code.trim()) return setError("보호자에게 받은 초대 코드를 입력해 주세요.");

    setSubmitting(true);
    try {
      const res = await authApi.claim({ code });
      const { user, refreshToken, consent_required, familyGroup, links, guardianMembers } = res.data;

      // 커밋 순서: 클레임 성공 후, 보관해 둔 동의를 제출.
      let consentDone = !consent_required;
      if (consented && consent_required) {
        await authApi.submitElderConsent(user.id);
        consentDone = true;
      }

      setSession(user, { refreshToken, consentDone, familyGroup, links, guardianMembers });
      setError("");
      router.replace("/(elder)/");
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

        {error ? (
          <View style={styles.errorRow}>
            <AlertCircle size={20} color="#E8943A" strokeWidth={2.4} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          onPress={handleClaim}
          activeOpacity={0.85}
          disabled={submitting}
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

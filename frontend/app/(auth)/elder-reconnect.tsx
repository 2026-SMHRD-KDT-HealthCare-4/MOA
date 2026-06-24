import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, KeyRound, AlertCircle } from "lucide-react-native";
import { useAuthStore } from "../../src/stores/authStore";
import * as authApi from "../../src/api/auth";

// 기기를 바꾼 직접사용자(고령층)가 보호자에게 받은 재연결 코드를 입력해
// 기존 계정·건강 이력을 복원하는 화면. (로그아웃/새 기기 상태에서 진입)
export default function ElderReconnectPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((s) => s.setSession);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleReconnect() {
    if (!code.trim()) return setError("보호자에게 받은 재연결 코드를 입력해 주세요.");

    setSubmitting(true);
    try {
      const restored = await authApi.reconnectSenior(code);
      setSession(restored.user, {
        refreshToken: restored.refreshToken,
        consentDone: restored.consentDone,
        familyGroup: restored.familyGroup,
        links: restored.links,
        guardianMembers: restored.guardianMembers,
        onboardingDone: restored.onboardingDone,
      });
      setError("");
      // 기존 계정 복원 — 온보딩을 마친 계정이면 홈으로, 아니면 온보딩으로.
      router.replace(restored.onboardingDone ? "/(elder)" : "/(elder)/onboarding/family-history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "재연결에 실패했어요. 잠시 후 다시 시도해 주세요.");
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
        <Text style={styles.topTitle}>재연결 코드 입력</Text>
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

        <Text style={styles.title}>보호자에게 받은{"\n"}재연결 코드를 입력해 주세요</Text>
        <Text style={styles.lead}>기기를 바꿔도 코드를 넣으면 그동안의 기록이 그대로 돌아와요.</Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="예: A3K-9PX"
          placeholderTextColor="#c4b5ae"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          accessibilityLabel="재연결 코드 입력"
        />

        {error ? (
          <View style={styles.errorRow}>
            <AlertCircle size={20} color="#E8943A" strokeWidth={2.4} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          onPress={handleReconnect}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>{submitting ? "연결 중…" : "다시 연결하기"}</Text>
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

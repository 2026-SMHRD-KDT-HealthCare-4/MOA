import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, UserPlus, Link2 } from "lucide-react-native";
import { useAuthStore } from "../../src/stores/authStore";
import * as authApi from "../../src/api/auth";

export default function RegisterPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((s) => s.setSession);

  // 허브(선택) ↔ 가입 폼을 한 화면에서 토글한다.
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleBack() {
    if (showForm) {
      setShowForm(false);
      setError("");
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/role-select");
  }

  // 자가 가입하는 사람 = 보호자. (어른 계정은 보호자가 온보딩에서 생성하므로 여기서 가입하지 않음)
  async function handleRegister() {
    if (!name.trim()) return setError("이름을 입력해 주세요.");
    if (!email.includes("@")) return setError("올바른 이메일을 입력해 주세요.");
    if (password.length < 8) return setError("비밀번호는 8자 이상이어야 해요.");

    setSubmitting(true);
    try {
      const user = await authApi.register({ name: name.trim(), email, password, role: "guardian" });
      setSession(user);
      // 가입 직후 보호자 주도 온보딩(어른 등록 + 음성 동의)으로 이동.
      router.replace("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "회원가입에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="뒤로 가기">
          <ArrowLeft size={22} color="#756a66" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{showForm ? "회원가입" : ""}</Text>
        <View style={styles.backBtn} />
      </View>

      {showForm ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>이름</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="이름을 입력해 주세요"
                placeholderTextColor="#c4b5ae"
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="이메일 주소"
                placeholderTextColor="#c4b5ae"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputWrap}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="8자 이상 입력해 주세요"
                placeholderTextColor="#c4b5ae"
                secureTextEntry
              />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleRegister}
            activeOpacity={0.85}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Text style={styles.submitBtnText}>{submitting ? "가입 중…" : "가입 완료"}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={[styles.hub, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.header}>
            <Text style={styles.logo}>moa</Text>
            <Text style={styles.title}>보호자로{"\n"}시작하기</Text>
            <Text style={styles.subtitle}>아래에서 선택해 주세요</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setShowForm(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <UserPlus size={22} color="white" strokeWidth={2.2} />
              <Text style={styles.primaryBtnText}>회원가입 하기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inviteCard}
              onPress={() => router.push("/(auth)/guardian-invite")}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={styles.inviteIconWrap}>
                <Link2 size={24} color="#E8943A" strokeWidth={2.2} />
              </View>
              <View style={styles.inviteTextWrap}>
                <View style={styles.inviteTitleRow}>
                  <Text style={styles.inviteTitle}>초대코드 입력</Text>
                  <View style={styles.inviteBadge}>
                    <Text style={styles.inviteBadgeText}>부보호자</Text>
                  </View>
                </View>
                <Text style={styles.inviteDesc}>가입 후 초대코드를 입력해요</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerDivider} />
            <Text style={styles.footerHint}>이미 계정이 있으신가요?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.loginLink}>로그인</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  topTitle: { fontSize: 16, fontWeight: "800", color: "#4d403b", letterSpacing: 1 },

  // 허브
  hub: { flex: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  header: { alignItems: "center", gap: 10, marginTop: 8 },
  logo: { fontSize: 20, fontWeight: "800", color: "#FF7955", letterSpacing: 4, marginBottom: 4 },
  title: { fontSize: 30, lineHeight: 40, fontWeight: "800", color: "#342C28", textAlign: "center" },
  subtitle: { fontSize: 18, color: "#765E52" },
  actions: { gap: 16 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#FF7955",
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtnText: { fontSize: 21, fontWeight: "800", color: "white" },
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1.5,
    borderColor: "#F1DFCB",
    borderRadius: 16,
    backgroundColor: "#FFFDFB",
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  inviteIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FDECDD",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteTextWrap: { flex: 1, gap: 4 },
  inviteTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inviteTitle: { fontSize: 19, fontWeight: "800", color: "#342C28" },
  inviteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#FDECDD",
  },
  inviteBadgeText: { fontSize: 12, fontWeight: "800", color: "#C7753D" },
  inviteDesc: { fontSize: 15, color: "#765E52", lineHeight: 21 },
  footer: { alignItems: "center", gap: 10 },
  footerDivider: { height: 1, alignSelf: "stretch", backgroundColor: "#EFE3DA", marginBottom: 4 },
  footerHint: { fontSize: 15, color: "#9A887D" },
  loginLink: { fontSize: 16, fontWeight: "800", color: "#FF7955" },

  // 가입 폼
  scroll: { paddingHorizontal: 24, paddingTop: 16, gap: 24 },
  form: { gap: 16 },
  inputWrap: { gap: 6 },
  label: { fontSize: 15, fontWeight: "600", color: "#4d403b" },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: "#e8ddd9",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    color: "#292321",
    backgroundColor: "white",
  },
  submitBtn: {
    height: 56,
    borderRadius: 15,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  submitBtnText: { fontSize: 18, fontWeight: "700", color: "white" },
  btnDisabled: { opacity: 0.6 },
  errorText: { fontSize: 15, fontWeight: "600", color: "#E8943A", marginTop: -8 },
});

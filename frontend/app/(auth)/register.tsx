import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useAuthStore } from "../../src/stores/authStore";
import * as authApi from "../../src/api/auth";

export default function RegisterPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((s) => s.setSession);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="뒤로 가기"
        >
          <ArrowLeft size={21} color="#756a66" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>회원가입</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* 입력 필드 */}
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
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          onPress={handleRegister}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>{submitting ? "가입 중…" : "가입 완료"}</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF9F2",
  },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4d403b",
    letterSpacing: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 24,
  },
  form: {
    gap: 16,
  },
  inputWrap: {
    gap: 6,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4d403b",
  },
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
  primaryBtn: {
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
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  errorText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E8943A",
    marginTop: -8,
  },
});

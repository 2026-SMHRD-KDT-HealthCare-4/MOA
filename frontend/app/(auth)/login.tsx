import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/stores/authStore";
import * as authApi from "../../src/api/auth";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 로그인은 보호자/세션 복구용. 어른 일상 진입은 자동 로그인이라 이 화면을 거치지 않음.
  async function handleLogin() {
    setSubmitting(true);
    try {
      const user = await authApi.login({ email, password });
      setSession(user);
      // 보호자는 가족 탭(부모 상태부터), 연결 전이면 홈으로 안내된다.
      const hasGuardianTab = useAuthStore.getState().hasGuardianTab;
      if (user.role === "guardian") {
        router.replace(hasGuardianTab ? "/(guardian)/family" : "/(guardian)/");
      } else {
        router.replace("/(elder)/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.logo}>moa</Text>
        <Text style={styles.title}>다시 만나서 반가워요</Text>
        <Text style={styles.subtitle}>이메일로 로그인해 주세요</Text>
      </View>

      {/* 입력 필드 */}
      <View style={styles.form}>
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
            placeholder="비밀번호"
            placeholderTextColor="#c4b5ae"
            secureTextEntry
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          onPress={handleLogin}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>{submitting ? "로그인 중…" : "로그인"}</Text>
        </TouchableOpacity>
      </View>

      {/* 회원가입 링크 */}
      <TouchableOpacity onPress={() => router.push("/(auth)/register")} activeOpacity={0.7}>
        <Text style={styles.registerLink}>
          계정이 없으신가요?{" "}
          <Text style={styles.registerLinkHighlight}>회원가입</Text>
        </Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF9F2",
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  logo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FF7955",
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#342C28",
  },
  subtitle: {
    fontSize: 18,
    color: "#765E52",
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
    marginTop: -4,
  },
  registerLink: {
    textAlign: "center",
    fontSize: 16,
    color: "#765E52",
  },
  registerLinkHighlight: {
    color: "#FF7955",
    fontWeight: "700",
  },
});

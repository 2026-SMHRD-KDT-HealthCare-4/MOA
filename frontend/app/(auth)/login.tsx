import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const insets = useSafeAreaInsets();
  const { email: prefillEmail } = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // mock 로그인: 가입 시 저장한 role로 직접사용자/보호자 홈 분기.
  function handleLogin() {
    const res = login(email, password);
    if (!res.ok) return setError(res.error);

    router.replace(res.role === "guardian" ? "/(guardian)/" : "/(elder)/");
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
          style={styles.primaryBtn}
          onPress={handleLogin}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>로그인</Text>
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

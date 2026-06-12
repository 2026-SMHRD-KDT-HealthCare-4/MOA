import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/stores/authStore";
import type { UserRole } from "../../src/stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // TODO: 실제 API 연동 시 교체
  function handleLogin(role: UserRole) {
    login(role);
    router.replace(role === "guardian" ? "/(guardian)/" : "/(elder)/");
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

        {/* 로그인 버튼 (역할 선택 — 실제 연동 전 임시) */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => handleLogin("elder")}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>어르신으로 로그인</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, styles.secondaryBtn]}
          onPress={() => handleLogin("guardian")}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, styles.secondaryBtnText]}>보호자로 로그인</Text>
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
    backgroundColor: "#FAF7F2",
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
    color: "#FF706D",
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#362b27",
  },
  subtitle: {
    fontSize: 18,
    color: "#a18f88",
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
    backgroundColor: "#FF706D",
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
  secondaryBtn: {
    backgroundColor: "white",
    borderWidth: 1.5,
    borderColor: "#FF706D",
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryBtnText: {
    color: "#FF706D",
  },
  registerLink: {
    textAlign: "center",
    fontSize: 16,
    color: "#a18f88",
  },
  registerLinkHighlight: {
    color: "#FF706D",
    fontWeight: "700",
  },
});

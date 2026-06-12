import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import type { UserRole } from "../../src/stores/authStore";

export default function RegisterPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("elder");

  // TODO: 실제 API 연동 시 교체
  function handleRegister() {
    router.replace("/(auth)/login");
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

        {/* 역할 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>가입 유형을 선택해 주세요</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleBtn, role === "elder" && styles.roleBtnActive]}
              onPress={() => setRole("elder")}
              activeOpacity={0.8}
            >
              <Text style={styles.roleEmoji}>👴</Text>
              <Text style={[styles.roleLabel, role === "elder" && styles.roleLabelActive]}>직접사용자</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === "guardian" && styles.roleBtnActive]}
              onPress={() => setRole("guardian")}
              activeOpacity={0.8}
            >
              <Text style={styles.roleEmoji}>👨‍👩‍👧</Text>
              <Text style={[styles.roleLabel, role === "guardian" && styles.roleLabelActive]}>보호자</Text>
            </TouchableOpacity>
          </View>
        </View>

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

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleRegister}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>가입 완료</Text>
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
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4d403b",
  },
  roleRow: {
    flexDirection: "row",
    gap: 12,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#e8ddd9",
    backgroundColor: "white",
    alignItems: "center",
    gap: 8,
  },
  roleBtnActive: {
    borderColor: "#FF7955",
    backgroundColor: "#fff5f4",
  },
  roleEmoji: {
    fontSize: 32,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#b6aaa5",
  },
  roleLabelActive: {
    color: "#FF7955",
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
});

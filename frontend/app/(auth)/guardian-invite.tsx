import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Users } from "lucide-react-native";
import { useAuthStore } from "../../src/stores/authStore";
import * as authApi from "../../src/api/auth";

export default function GuardianInvitePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((s) => s.setSession);
  const setFamilyState = useAuthStore((s) => s.setFamilyState);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    if (!name.trim()) return setError("이름을 입력해 주세요.");
    if (!email.includes("@")) return setError("이메일을 입력해 주세요.");
    if (password.length < 8) return setError("비밀번호는 8자 이상이어야 해요.");
    if (!inviteCode.trim()) return setError("초대 코드를 입력해 주세요.");

    setSubmitting(true);
    try {
      const user = await authApi.register({
        name: name.trim(),
        email,
        password,
        role: "guardian",
      });
      const accepted = await authApi.acceptGuardianInvite({
        guardianId: user.id,
        guardianName: user.name,
        inviteCode,
      });
      const members = await authApi.listFamilyMembers(accepted.data.familyGroup.id);
      setSession(user, {
        consentDone: true,
        familyGroup: members.data.familyGroup,
        links: members.data.links,
        guardianMembers: members.data.guardianMembers,
      });
      setFamilyState(members.data);
      router.replace("/(guardian)/family");
    } catch (e) {
      setError(e instanceof Error ? e.message : "초대 수락에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="뒤로 가기">
          <ArrowLeft size={22} color="#756a66" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>보호자 초대</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroIcon}>
          <Users size={30} color="#FF7955" />
        </View>
        <Text style={styles.title}>초대받은 가족에 참여해요</Text>
        <Text style={styles.subtitle}>계정을 만든 뒤 받은 초대 코드를 입력하면 부보호자로 함께 돌볼 수 있어요.</Text>

        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="이름" placeholderTextColor="#c4b5ae" />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="이메일 주소"
          placeholderTextColor="#c4b5ae"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호 8자 이상"
          placeholderTextColor="#c4b5ae"
          secureTextEntry
        />
        <TextInput
          style={styles.codeInput}
          value={inviteCode}
          onChangeText={(t) => setInviteCode(t.toUpperCase())}
          placeholder="예: ABC-123"
          placeholderTextColor="#c4b5ae"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.disabled]}
          onPress={handleAccept}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>{submitting ? "참여 중..." : "초대 수락"}</Text>
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
  scroll: { paddingHorizontal: 24, paddingTop: 8, gap: 14 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#FFE9E6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, lineHeight: 34, fontWeight: "800", color: "#342C28" },
  subtitle: { fontSize: 17, lineHeight: 25, color: "#765E52" },
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
  codeInput: {
    height: 64,
    borderWidth: 1.5,
    borderColor: "#e8ddd9",
    borderRadius: 16,
    paddingHorizontal: 18,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#342C28",
    backgroundColor: "white",
    textAlign: "center",
  },
  errorText: { fontSize: 15, fontWeight: "700", color: "#E8943A" },
  primaryBtn: {
    height: 60,
    borderRadius: 16,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  disabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 20, fontWeight: "800", color: "white" },
});

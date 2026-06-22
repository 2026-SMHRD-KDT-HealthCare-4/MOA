import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Share } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, CheckCircle2, Share2, UserPlus } from "lucide-react-native";
import { useAuthStore } from "../src/stores/authStore";
import * as authApi from "../src/api/auth";

type Step = "provision" | "pairing";

export default function OnboardingPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setFamilyState = useAuthStore((s) => s.setFamilyState);

  const [step, setStep] = useState<Step>("provision");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 보호자가 직접사용자 초대 토큰을 발급한다(POST /auth/invite). 직접사용자 계정은
  // 클레임 시점에 본인 기기에서 생성되므로, 여기서는 미리 만들지 않는다.
  async function handleCreateInvite() {
    if (!user) return setError("로그인 정보가 없어요. 다시 시도해 주세요.");
    if (!name.trim()) return setError("부모님 성함을 입력해 주세요.");

    setSubmitting(true);
    try {
      const res = await authApi.createInvite({ guardianId: user.id, seniorName: name.trim() });
      setInviteCode(res.data.token);
      const restored = await authApi.restoreSession();
      if (restored) {
        setFamilyState({
          familyGroup: restored.familyGroup,
          links: restored.links,
          guardianMembers: restored.guardianMembers,
        });
      }
      setError("");
      setStep("pairing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "초대 코드 발급에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShareCode() {
    if (!inviteCode) return;
    await Share.share({
      message: `MOA 초대 코드: ${inviteCode}\n${name.trim()}님 기기에서 이 코드를 입력해 연결해 주세요.`,
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        {step === "provision" ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="뒤로 가기">
            <ArrowLeft size={21} color="#756a66" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.topTitle}>부모님 등록</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {step === "provision" && (
          <>
            <View style={styles.heroIcon}>
              <UserPlus size={28} color="#FF7955" />
            </View>
            <Text style={styles.title}>부모님 정보를 등록해 주세요</Text>
            <Text style={styles.subtitle}>
              등록이 끝나면 부모님 기기에서 입력할 초대 코드를 발급해 드려요.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputWrap}>
                <Text style={styles.label}>성함</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="예: 김순자"
                  placeholderTextColor="#c4b5ae"
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.label}>나와의 관계(선택)</Text>
                <TextInput
                  style={styles.input}
                  value={relation}
                  onChangeText={setRelation}
                  placeholder="예: 어머니"
                  placeholderTextColor="#c4b5ae"
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={handleCreateInvite}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Text style={styles.primaryBtnText}>{submitting ? "등록 중..." : "초대 코드 발급"}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "pairing" && (
          <>
            <View style={styles.heroIcon}>
              <CheckCircle2 size={30} color="#FF7955" strokeWidth={2.5} />
            </View>
            <Text style={styles.title}>{name.trim()}님 등록 완료</Text>
            <Text style={styles.subtitle}>
              {`아래 코드를 ${name.trim()}님 기기의 초대 코드 입력 화면에 넣으면 가족 연결이 완료돼요.`}
            </Text>

            <View style={styles.codePanel}>
              <Text style={styles.codeLabel}>초대 코드</Text>
              <Text selectable style={styles.codeText}>
                {inviteCode}
              </Text>
              <Text style={styles.codeHint}>{`${name.trim()}님 기기에서 동의와 코드 입력을 진행해 주세요.`}</Text>
            </View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={handleShareCode} activeOpacity={0.82}>
              <Share2 size={20} color="#FF7955" />
              <Text style={styles.secondaryBtnText}>코드 공유</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace("/")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>메인으로 이동</Text>
            </TouchableOpacity>
          </>
        )}
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
  topTitle: { fontSize: 16, fontWeight: "800", color: "#4d403b" },
  scroll: { paddingHorizontal: 24, paddingTop: 8, gap: 16 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#FFE9E6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#342C28" },
  subtitle: { fontSize: 16, lineHeight: 23, color: "#765E52" },
  form: { gap: 16, marginTop: 4 },
  inputWrap: { gap: 6 },
  label: { fontSize: 15, fontWeight: "700", color: "#4d403b" },
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
  codePanel: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    padding: 18,
    gap: 8,
  },
  codeLabel: { fontSize: 14, fontWeight: "800", color: "#765E52" },
  codeText: { fontSize: 34, lineHeight: 42, fontWeight: "900", color: "#342C28", letterSpacing: 3 },
  codeHint: { fontSize: 15, lineHeight: 22, color: "#765E52" },
  primaryBtn: {
    height: 56,
    borderRadius: 15,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 18, fontWeight: "800", color: "white" },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8ddd9",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { fontSize: 17, fontWeight: "800", color: "#FF7955" },
  errorText: { fontSize: 15, fontWeight: "700", color: "#E8943A" },
});

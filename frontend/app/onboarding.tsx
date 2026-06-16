import { View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Check, ShieldCheck, UserPlus } from "lucide-react-native";
import { useAuthStore } from "../src/stores/authStore";
import * as authApi from "../src/api/auth";

type Step = "elder" | "consent" | "done";

// 보호자 주도 온보딩: 어른 계정 생성 → 음성 데이터 동의 → 완료.
// 어른 본인은 가입/입력 절차가 없고, 이후 자동 로그인으로 진입한다.
export default function OnboardingPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setLinkedElder = useAuthStore((s) => s.setLinkedElder);

  const [step, setStep] = useState<Step>("elder");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [elderId, setElderId] = useState("");

  async function handleCreateElder() {
    if (!user) return setError("로그인 정보가 없어요. 다시 시도해 주세요.");
    if (!name.trim()) return setError("직접사용자 성함을 입력해 주세요.");

    setSubmitting(true);
    try {
      const elder = await authApi.createElderAccount({
        guardianId: user.id,
        name,
        relation: relation.trim() || undefined,
      });
      setElderId(elder.id);
      setLinkedElder(elder.name);
      setError("");
      setStep("consent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "직접사용자 등록에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConsent() {
    if (!agreed) return setError("음성 데이터 활용에 동의해 주세요.");
    setSubmitting(true);
    try {
      await authApi.recordVoiceConsent(elderId);
      setError("");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "동의 처리에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 상단 바 */}
      <View style={styles.topBar}>
        {step === "elder" ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="뒤로 가기">
            <ArrowLeft size={21} color="#756a66" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.topTitle}>직접사용자 등록</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {step === "elder" && (
          <>
            <View style={styles.heroIcon}>
              <UserPlus size={28} color="#FF7955" />
            </View>
            <Text style={styles.title}>돌볼 직접사용자을 등록해 주세요</Text>
            <Text style={styles.subtitle}>
              직접사용자은 따로 가입할 필요 없이, 등록 후 바로 사용하실 수 있어요.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputWrap}>
                <Text style={styles.label}>직접사용자 성함</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="예: 김순자"
                  placeholderTextColor="#c4b5ae"
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.label}>나와의 관계 (선택)</Text>
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
              onPress={handleCreateElder}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Text style={styles.primaryBtnText}>{submitting ? "등록 중…" : "다음"}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "consent" && (
          <>
            <View style={styles.heroIcon}>
              <ShieldCheck size={28} color="#FF7955" />
            </View>
            <Text style={styles.title}>음성 데이터 활용 동의</Text>
            <Text style={styles.subtitle}>
              직접사용자의 목소리 변화를 참고용으로 기록·분석해 보호자에게 알려드립니다.
            </Text>

            <View style={styles.consentCard}>
              <Text style={styles.consentItem}>• 매일의 목소리에서 변화·패턴을 감지해 참고 정보로 제공해요.</Text>
              <Text style={styles.consentItem}>• 원시 음성은 분석 직후 즉시 폐기하며 기기에 저장하지 않아요.</Text>
              <Text style={styles.consentItem}>• 의료 진단이 아닌, 일상 돌봄을 돕는 참고용 웰니스 서비스예요.</Text>
            </View>

            <Pressable
              style={styles.agreeRow}
              onPress={() => setAgreed((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
              <Text style={styles.agreeText}>음성 데이터 활용에 동의합니다.</Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (submitting || !agreed) && styles.primaryBtnDisabled]}
              onPress={handleConsent}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Text style={styles.primaryBtnText}>{submitting ? "처리 중…" : "동의하고 계속"}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "done" && (
          <>
            <View style={styles.heroIcon}>
              <Check size={30} color="#FF7955" strokeWidth={3} />
            </View>
            <Text style={styles.title}>{name.trim()}님 등록 완료</Text>
            <Text style={styles.subtitle}>
              이제 보호자 홈에서 직접사용자의 오늘을 확인하실 수 있어요.
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace("/(guardian)/")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>시작하기</Text>
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
  topTitle: { fontSize: 16, fontWeight: "800", color: "#4d403b", letterSpacing: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 8, gap: 16 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#FFE9E6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#342C28" },
  subtitle: { fontSize: 16, lineHeight: 23, color: "#765E52" },
  form: { gap: 16, marginTop: 4 },
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
  consentCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    padding: 16,
    gap: 10,
  },
  consentItem: { fontSize: 15, lineHeight: 22, color: "#5a4d46" },
  agreeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4, minHeight: 44 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#d8c8c1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  checkboxOn: { backgroundColor: "#FF7955", borderColor: "#FF7955" },
  agreeText: { fontSize: 16, fontWeight: "600", color: "#4d403b", flex: 1 },
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
  primaryBtnText: { fontSize: 18, fontWeight: "700", color: "white" },
  errorText: { fontSize: 15, fontWeight: "600", color: "#E8943A" },
});

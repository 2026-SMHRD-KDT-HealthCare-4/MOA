import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserPlus, Clock, Share2 } from "lucide-react-native";
import { CharacterPlayer } from "./CharacterPlayer";
import { MicIcon } from "./icons/MicIcon";
import { useAuthStore } from "../stores/authStore";
import { useInteractionStore } from "../stores/interactionStore";
import * as authApi from "../api/auth";

// 음성 챗봇 메인 — 직접사용자/보호자 공통(스펙 §2: 메인 챗봇 화면 공통 컴포넌트).
// 보호자도 같은 화면에서 자기 음성 체크인을 한다.
// 역할별로 녹음 화면 경로만 분기(나머지 동작은 동일, 회귀 없음).
export default function ChatbotMain() {
  const router = useRouter();
  const { fromIntro } = useLocalSearchParams<{ fromIntro?: string }>();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const links = useAuthStore((s) => s.links);
  const hasStoredUserInteracted = useInteractionStore((s) => s.hasUserInteracted);
  const hasUserInteracted = fromIntro === "true" || hasStoredUserInteracted;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const recordHref = role === "guardian" ? "/(guardian)/record" : "/(elder)/record";

  // 보호자 안내 영역: ACTIVE 부모가 없으면(연결 0명 또는 대기 중) 홈에서 안내한다.
  // (ACTIVE가 있으면 가족 탭으로 랜딩되므로 홈엔 안내를 띄우지 않음)
  const hasActive = links.some((l) => l.status === "ACTIVE");
  const showGuardianNotice = role === "guardian" && !hasActive;

  // 연결 대기 = 미사용 초대 토큰(getPendingInvites). BE 확정 시 그 함수 내부만 교체된다.
  const [pendingInvites, setPendingInvites] = useState<authApi.PendingInvite[]>([]);
  useEffect(() => {
    if (role !== "guardian" || !user) return;
    let alive = true;
    authApi.getPendingInvites(user.id).then((res) => {
      if (alive) setPendingInvites(res.data);
    });
    return () => {
      alive = false;
    };
  }, [role, user]);

  async function reshareInvite(invite: authApi.PendingInvite) {
    const who = invite.seniorName ? `${invite.seniorName}님 ` : "";
    await Share.share({
      message: `MOA 초대 코드: ${invite.token}\n${who}기기에서 이 코드를 입력해 연결을 완료해 주세요.`,
    });
  }

  const W = Math.min(windowWidth, 430);
  const H = windowHeight;
  const s = W / 430;
  const v = H / 900;

  const headerTop = insets.top + Math.round(42 * v);
  const bubbleTop = insets.top + Math.round(134 * v);
  const characterTop = insets.top + Math.round(176 * v);
  const navTopGap = Math.max(92 + insets.bottom, Math.round(92 * v) + insets.bottom);
  const characterHeight = H - characterTop - navTopGap;
  const recordBottom = Math.max(9, Math.round(9 * v));
  const topFadeHeight = characterTop + Math.round(74 * v);
  const topFadeStop = characterTop / topFadeHeight;
  const characterVideoTopOffset = Math.round(110 * v);

  return (
    <View style={styles.fill}>
      <LinearGradient colors={["#F7D6AC", "#FFF2DE", "#F8CFA4"]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(247,208,164,0)", "rgba(247,208,164,0.78)", "#FFF0DD"]}
        locations={[0, 0.52, 1]}
        style={styles.navBackdrop}
      />

      <View style={[styles.header, { top: headerTop }]}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>6월 17일 (화)</Text>
          <Text style={styles.greetingText}>오늘도 모아와 함께해요</Text>
        </View>
      </View>

      {showGuardianNotice ? (
        <View style={[styles.noticeWrap, { top: bubbleTop }]}>
          {pendingInvites.length === 0 ? (
            // empty-state: 연동 0명
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>부모님을 연결해 주세요</Text>
              <Text style={styles.noticeBody}>등록 후 초대 코드를 전달하면 가족 탭에서 함께 살펴볼 수 있어요.</Text>
              <Pressable style={styles.noticePrimaryBtn} onPress={() => router.push("/onboarding")} accessibilityRole="button">
                <UserPlus size={20} color="#FFFFFF" />
                <Text style={styles.noticePrimaryText}>부모님 연결하기</Text>
              </Pressable>
            </View>
          ) : (
            // 연결 대기: 미사용 초대 토큰 + 코드 재공유
            pendingInvites.map((invite) => {
              const who = invite.seniorName ?? "부모님";
              return (
                <View key={invite.token} style={styles.noticeCard}>
                  <View style={styles.noticeHead}>
                    <Clock size={20} color="#E8943A" strokeWidth={2.4} />
                    <Text style={styles.noticePendTitle}>{who} 연결 대기 중</Text>
                  </View>
                  <Text style={styles.noticeCode}>{invite.token}</Text>
                  <Pressable
                    style={styles.noticeReshareBtn}
                    onPress={() => reshareInvite(invite)}
                    accessibilityRole="button"
                  >
                    <Share2 size={18} color="#FF7955" />
                    <Text style={styles.noticeReshareText}>초대 코드 재공유</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      ) : (
        <View style={[styles.speechBubble, { top: bubbleTop }]}>
          <Text style={styles.speechText}>오늘도{"\n"}목소리 들려주세요</Text>
          <View style={styles.speechTail} />
        </View>
      )}

      <View
        pointerEvents="none"
        style={[
          styles.characterWrap,
          {
            left: 0,
            right: 0,
            top: characterTop,
            height: characterHeight,
          },
        ]}
      >
        <CharacterPlayer
          mood="idle"
          hasUserInteracted={hasUserInteracted}
          containerStyle={{
            left: 0,
            right: 0,
            top: -characterVideoTopOffset,
            bottom: 0,
          }}
        />
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={["#F7D6AC", "rgba(247,214,172,0.92)", "rgba(247,214,172,0)"]}
        locations={[0, topFadeStop, 1]}
        style={[styles.characterTopFade, { height: topFadeHeight }]}
      />

      <Pressable
        style={({ pressed }) => [
          styles.recordButton,
          { bottom: recordBottom },
          pressed && styles.pressed,
        ]}
        onPress={() => router.push(recordHref)}
        accessibilityRole="button"
        accessibilityLabel="녹음하러가기, 오늘의 목소리를 남겨요"
      >
        <View style={styles.recordButtonHighlight} />
        <View style={styles.recordIconWrap}>
          <MicIcon color="#FFFFFF" size={32} />
        </View>
        <View style={styles.recordTextWrap}>
          <Text style={styles.recordTitle}>녹음하러가기</Text>
          <Text style={styles.recordSub}>오늘의 목소리를 남겨요</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    overflow: "hidden",
  },
  navBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    zIndex: 6,
  },
  header: {
    position: "absolute",
    left: 53,
    right: 32,
    zIndex: 10,
  },
  dateBlock: {
    gap: 7,
  },
  dateText: {
    color: "#3B2318",
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
  },
  greetingText: {
    color: "#668D5F",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  speechBubble: {
    position: "absolute",
    left: 62,
    right: 62,
    minHeight: 86,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.87)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    zIndex: 7,
    overflow: "visible",
    boxShadow: "0 18px 38px rgba(95, 55, 30, 0.09)",
  },
  speechText: {
    color: "#3B2318",
    fontSize: 24,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  speechTail: {
    position: "absolute",
    left: 47,
    bottom: -13,
    width: 27,
    height: 27,
    borderBottomLeftRadius: 5,
    backgroundColor: "rgba(255,255,255,0.87)",
    transform: [{ rotate: "45deg" }],
  },
  noticeWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 8,
    gap: 12,
  },
  noticeCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    padding: 18,
    gap: 10,
    boxShadow: "0 18px 38px rgba(95, 55, 30, 0.12)",
  },
  noticeTitle: { fontSize: 19, fontWeight: "900", color: "#3B2318" },
  noticeBody: { fontSize: 15, lineHeight: 22, color: "#765E52" },
  noticePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 15,
    backgroundColor: "#FF7955",
    marginTop: 2,
  },
  noticePrimaryText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  noticeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  noticePendTitle: { fontSize: 17, fontWeight: "800", color: "#9A6B25" },
  noticeCode: { fontSize: 26, fontWeight: "900", letterSpacing: 3, color: "#342C28" },
  noticeReshareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD3C6",
    backgroundColor: "white",
  },
  noticeReshareText: { fontSize: 16, fontWeight: "800", color: "#FF7955" },
  characterWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  characterTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
  },
  recordButton: {
    position: "absolute",
    left: 70,
    right: 70,
    height: 68,
    borderRadius: 25,
    backgroundColor: "#FF765A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    zIndex: 15,
    overflow: "hidden",
    boxShadow: "0 15px 26px rgba(214, 87, 56, 0.22)",
  },
  recordButtonHighlight: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 6,
    height: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  recordIconWrap: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  recordTextWrap: {
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 5,
  },
  recordTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
  },
  recordSub: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "700",
    opacity: 0.96,
  },
});

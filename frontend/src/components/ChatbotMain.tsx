import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserPlus, Clock, Share2 } from "lucide-react-native";
import { CharacterPlayer, type CharacterMood } from "./CharacterPlayer";
import { MicIcon } from "./icons/MicIcon";
import { useAuthStore } from "../stores/authStore";
import { useInteractionStore } from "../stores/interactionStore";
import * as authApi from "../api/auth";

// ── 챗봇 대화 상태 (설계서 §11 ChatState) ────────────────────────────
// idle: 대기, botSpeaking: 모아가 응답 중, listening: 사용자 발화 듣는 중,
// thinking: LLM 응답 생성 중, completed: 대화 종료(축하), error: 오류
type ChatState = "idle" | "botSpeaking" | "listening" | "thinking" | "completed" | "error";

// 설계서 §5 BotEmotion → CharacterPlayer의 CharacterMood로 변환.
// "default"만 이름이 다르고 나머지는 1:1 동일.
type BotEmotion = "default" | "listening" | "thinking" | "happy" | "worried" | "clapping";
function botEmotionToMood(emotion: BotEmotion): CharacterMood {
  return emotion === "default" ? "idle" : emotion;
}

// 설계서 §12 ChatState → Emotion 매핑.
// botSpeaking일 때만 LLM이 결정한 감정(botEmotion state)을 그대로 쓴다.
function chatStateToMood(state: ChatState, botEmotion: BotEmotion): CharacterMood {
  switch (state) {
    case "idle":
      return "idle";
    case "listening":
      return "listening";
    case "thinking":
      return "thinking";
    case "botSpeaking":
      return botEmotionToMood(botEmotion);
    case "completed":
      return "clapping";
    case "error":
      return "worried";
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // ── 대화 상태 ─────────────────────────────────────────────────────
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [botEmotion, setBotEmotion] = useState<BotEmotion>("default");
  const [botReply, setBotReply] = useState<string>("오늘은 어떤 하루였나요?");
  const turnCountRef = useRef(0);
  const conversationRunningRef = useRef(false);

  // ── (임시) 디버그용 mood 강제 전환 — 영상 전환이 자연스러운지 빠르게 확인용.
  // 실제 대화 로직 완성되면 이 블록 전체를 지우면 됨.
  const DEBUG_MOOD_SEQUENCE: CharacterMood[] = [
    "idle",
    "listening",
    "thinking",
    "happy",
    "clapping",
    "worried",
  ];
  const [debugMoodIndex, setDebugMoodIndex] = useState<number | null>(null);
  function handleDebugNextMood() {
    setDebugMoodIndex((prev) => {
      const next = prev === null ? 0 : (prev + 1) % DEBUG_MOOD_SEQUENCE.length;
      return next;
    });
  }
  const debugMood = debugMoodIndex !== null ? DEBUG_MOOD_SEQUENCE[debugMoodIndex] : null;

  const mood = debugMood ?? chatStateToMood(chatState, botEmotion);

  const recordHref = role === "guardian" ? "/(guardian)/record" : "/(elder)/record";

  // 대화 한 턴 실행: listening → thinking → botSpeaking → (idle | completed)
  // TODO: 아래 3곳을 실제 기능으로 교체
  //   1) 실제 마이크 녹음 + 침묵 감지로 종료 (지금은 setTimeout으로 흉내만 냄)
  //   2) STT → LLM 호출 (지금은 mockCallLLM으로 더미 응답)
  //   3) TTS 재생 + 재생 끝나는 시점 감지 (지금은 setTimeout으로 흉내만 냄)
  const runConversationTurn = useCallback(async () => {
    if (conversationRunningRef.current) return;
    conversationRunningRef.current = true;

    try {
      // 1) 사용자 발화 듣기
      setChatState("listening");
      // TODO: 실제 녹음 시작. 녹음이 끝나는 시점(침묵 감지/버튼)에 다음 단계로 진행.
      await wait(2500);

      // 2) LLM 응답 생성
      setChatState("thinking");
      // TODO: STT(음성→텍스트) 후 LLM 호출로 교체.
      const llmResult = await mockCallLLM();
      setBotEmotion(llmResult.bot_emotion);
      setBotReply(llmResult.reply);

      // 3) 모아가 응답 (TTS)
      setChatState("botSpeaking");
      // TODO: TTS 재생, 재생 완료 이벤트로 교체.
      await wait(2500);

      turnCountRef.current += 1;

      // 설계서 §13 종료 조건: 3턴 이상 / 30초 이상 / 사용자가 종료 의사 표현
      if (llmResult.user_intent === "goodbye" || turnCountRef.current >= 3) {
        setChatState("completed");
        await wait(1800);
        setChatState("idle");
        setBotReply("오늘도 목소리 들려주세요");
        turnCountRef.current = 0;
      } else {
        // 다음 턴 계속 (사용자가 또 말하도록 listening으로 복귀)
        await runConversationTurn();
        return;
      }
    } catch {
      setChatState("error");
      await wait(1500);
      setChatState("idle");
    } finally {
      conversationRunningRef.current = false;
    }
  }, []);

  function handleMicPress() {
    if (chatState !== "idle") return; // 대화 진행 중엔 중복 시작 방지
    void runConversationTurn();
  }

  // 보호자 안내 영역: ACTIVE 부모가 없으면(연결 0명 또는 대기 중) 홈에서 안내한다.
  const hasActive = links.some((l) => l.status === "ACTIVE");
  const showGuardianNotice = role === "guardian" && !hasActive;

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

  const isBusy = chatState !== "idle";

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
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>부모님을 연결해 주세요</Text>
              <Text style={styles.noticeBody}>등록 후 초대 코드를 전달하면 가족 탭에서 함께 살펴볼 수 있어요.</Text>
              <Pressable style={styles.noticePrimaryBtn} onPress={() => router.push("/onboarding")} accessibilityRole="button">
                <UserPlus size={20} color="#FFFFFF" />
                <Text style={styles.noticePrimaryText}>부모님 연결하기</Text>
              </Pressable>
            </View>
          ) : (
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
          <Text style={styles.speechText}>{botReply}</Text>
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
          mood={mood}
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

      {/* (임시) 디버그용 — 영상 전환이 자연스러운지 빠르게 확인용. 완성되면 이 Pressable 통째로 삭제. */}
      <Pressable
        style={[styles.debugButton, { top: insets.top + 10 }]}
        onPress={handleDebugNextMood}
        accessibilityRole="button"
      >
        <Text style={styles.debugButtonText}>
          다음 표정 → {debugMood ?? "(자동)"}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.recordButton,
          { bottom: recordBottom },
          pressed && styles.pressed,
          isBusy && styles.recordButtonBusy,
        ]}
        onPress={handleMicPress}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel="녹음하러가기, 오늘의 목소리를 남겨요"
      >
        <View style={styles.recordButtonHighlight} />
        <View style={styles.recordIconWrap}>
          <MicIcon color="#FFFFFF" size={32} />
        </View>
        <View style={styles.recordTextWrap}>
          <Text style={styles.recordTitle}>
            {chatState === "idle" ? "녹음하러가기" : "대화 중..."}
          </Text>
          <Text style={styles.recordSub}>오늘의 목소리를 남겨요</Text>
        </View>
      </Pressable>
    </View>
  );
}

// ── 더미 LLM 응답 (TODO: 실제 STT + LLM 호출로 교체) ──────────────────
// 설계서 §8 LLM 응답 형식과 동일한 구조로 반환.
async function mockCallLLM(): Promise<{
  reply: string;
  user_intent: string;
  bot_emotion: BotEmotion;
}> {
  await wait(400);
  const samples: Array<{ reply: string; user_intent: string; bot_emotion: BotEmotion }> = [
    { reply: "오늘 점심은 맛있게 드셨어요?", user_intent: "meal_talk", bot_emotion: "happy" },
    { reply: "그러셨군요, 무리하지 마세요.", user_intent: "health_discomfort", bot_emotion: "worried" },
    { reply: "잘 들었어요. 오늘도 고생 많으셨어요.", user_intent: "daily_talk", bot_emotion: "default" },
  ];
  return samples[Math.floor(Math.random() * samples.length)];
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
  recordButtonBusy: {
    opacity: 0.7,
  },
  debugButton: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 20,
  },
  debugButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { ArrowLeft, RotateCcw, CheckCircle } from "lucide-react-native";
import { MicIcon } from "../components/icons/MicIcon";
import { Waveform } from "../components/Waveform";
import { CharacterPlayer } from "../components/CharacterPlayer";
import { useRecorder } from "../features/record/useRecorder";
import * as authApi from "../api/auth";
import { saveScriptRecord } from "../api/record";
import { useAuthStore } from "../stores/authStore";

const RECORD_SECONDS = 30;
const RING_SIZE = 114;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const REAL_API = process.env.EXPO_PUBLIC_AUTH_API_MODE === "real";

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RecordPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const W = Math.min(windowWidth, 430);

  const { state, transcript, durationMs, permissionDenied, start, stop, reset } = useRecorder();
  const [dailyScript, setDailyScript] = useState<authApi.ScriptResponseData | null>(null);

  useEffect(() => {
    let mounted = true;
    void authApi
      .getTodayScript()
      .then((result) => {
        if (mounted) setDailyScript(result.data);
      })
      .catch(() => {
        // 문구 조회 실패 — placeholder 유지
      });
    return () => {
      mounted = false;
    };
  }, []);

  const isRecording  = state === "recording";
  const isProcessing = state === "processing";
  const isDone       = state === "done";

  const mood = isRecording ? "listening" : isDone ? "happy" : "idle";
  const elapsedSeconds = durationMs / 1000;
  const progress = Math.min(elapsedSeconds / RECORD_SECONDS, 1);
  const showProgressRing = isRecording || isProcessing;
  const ringProgress = isProcessing ? 1 : progress;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - ringProgress);

  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;
    // 낭독 기록 저장은 직접사용자 본인만 (보호자 자가 체크인은 저장 대상 아님).
    // 저장에 실패해도 흐름은 막지 않는다.
    if (REAL_API && role === "elder" && dailyScript?.script_id && user) {
      setSaving(true);
      try {
        await saveScriptRecord(dailyScript.script_id, user.id);
      } catch {
        // 저장 실패 — 다음 동기화에서 보완 (흐름 유지)
      } finally {
        setSaving(false);
      }
    }
    router.replace("/done");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#F7D6AC", "#FFF2DE", "#F7D6AC"]} style={StyleSheet.absoluteFill} />

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityLabel="뒤로 가기"
        >
          <ArrowLeft size={22} color="#39302C" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>오늘의 목소리 기록</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 캐릭터 */}
        <View style={styles.avatarWrap}>
          <CharacterPlayer mood={mood} size={Math.round(W * 0.55)} circular />
          <Text style={styles.avatarHint}>
            {isRecording
              ? "잘 듣고 있어요. 편하게 말씀해 주세요."
              : isDone
              ? "잘 전달됐어요! 확인해 주세요."
              : isProcessing
              ? "목소리를 분석하고 있어요…"
              : "마이크 버튼을 누르고\n이야기를 시작해 보세요."}
          </Text>
        </View>

        {/* 가이드 + 문장 카드 */}
        {!isDone && !isProcessing && (
          <View style={styles.copyWrap}>
            <Text style={styles.recordingGuide}>다음 문장을{"\n"}소리 내어 읽어주세요.</Text>
            <View style={styles.sentenceCard}>
              <Text style={styles.sentence}>
                {dailyScript?.content ?? "오늘의 지정문구를 불러오고 있어요."}
              </Text>
            </View>
          </View>
        )}

        {/* 타이머 */}
        {isRecording && (
          <Text style={styles.timer}>
            {formatDuration(durationMs)} / 00:{String(RECORD_SECONDS).padStart(2, "0")}
          </Text>
        )}

        {/* 분석 중 */}
        {isProcessing && (
          <View style={styles.processingRow}>
            <ActivityIndicator size="large" color="#FF7955" />
            <Text style={styles.processingText}>목소리 패턴을 분석하고 있어요</Text>
          </View>
        )}

        {/* 마이크 권한 거부 */}
        {permissionDenied && (
          <View style={styles.permDenied}>
            <Text style={styles.permDeniedText}>
              마이크 사용 권한이 필요해요.{"\n"}기기 설정에서 허용해 주세요.
            </Text>
          </View>
        )}

        {/* STT 결과 카드 */}
        {isDone && transcript && (
          <View style={styles.transcriptCard}>
            <Text style={styles.transcriptLabel}>📝  말씀하신 내용</Text>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        )}

        {/* 핵심 액션 버튼 */}
        <View style={styles.actions}>
          {!isDone ? (
            <View style={styles.recordButtonOuter}>
              {/* 회전하지 않는 30초 SVG 진행 링 */}
              {showProgressRing && (
                <Svg
                  width={RING_SIZE}
                  height={RING_SIZE}
                  viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                  style={styles.recordProgress}
                  pointerEvents="none"
                >
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    stroke="#F1E2D1"
                    strokeWidth={RING_STROKE}
                    fill="none"
                  />
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    stroke="#70AB69"
                    strokeWidth={RING_STROKE}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  />
                </Svg>
              )}
              <TouchableOpacity
                style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                onPress={isRecording ? stop : start}
                disabled={isProcessing}
                activeOpacity={0.85}
                accessibilityLabel={isRecording ? "녹음 중지" : "녹음 시작"}
              >
                <MicIcon color="#FFFFFF" size={30} />
                <Text style={styles.recordBtnText}>
                  {isRecording || isProcessing ? "중지하기" : "시작하기"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.doneActions}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={reset}
                activeOpacity={0.8}
                accessibilityLabel="다시 녹음하기"
              >
                <RotateCcw size={22} color="#FF7955" />
                <Text style={styles.resetBtnText}>다시 하기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityLabel="저장하기"
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <CheckCircle size={22} color="white" />
                )}
                <Text style={styles.saveBtnText}>{saving ? "저장 중…" : "저장하기"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 웨이브폼 */}
        {isRecording && <Waveform color="#76A96C" large />}

        {isRecording && (
          <Text style={styles.finishHint}>버튼을 누르면 녹음을 마쳐요</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    zIndex: 10,
  },
  iconBtn: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 17, fontWeight: "800", color: "#39302C" },

  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: "center",
    gap: 24,
  },
  avatarWrap: { alignItems: "center", gap: 16 },
  avatarHint: {
    fontSize: 18,
    color: "#765E52",
    textAlign: "center",
    lineHeight: 28,
  },

  copyWrap: { alignItems: "center" },
  recordingGuide: {
    color: "#403631",
    fontSize: 18,
    lineHeight: 27,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  sentenceCard: {
    width: 290,
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#E6C9B0",
    backgroundColor: "#FFF9F4",
    alignItems: "center",
    justifyContent: "center",
  },
  sentence: {
    color: "#342D29",
    fontSize: 23,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
  },

  timer: {
    color: "#433A35",
    fontSize: 18,
    fontWeight: "700",
  },

  processingRow: { alignItems: "center", gap: 12 },
  processingText: { fontSize: 18, color: "#765E52" },

  permDenied: {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#fff5e6",
    borderWidth: 1,
    borderColor: "#E8943A",
  },
  permDeniedText: {
    fontSize: 18,
    color: "#7a5200",
    textAlign: "center",
    lineHeight: 28,
  },

  transcriptCard: {
    width: "100%",
    padding: 20,
    borderRadius: 18,
    backgroundColor: "white",
    gap: 10,
    shadowColor: "#715346",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  transcriptLabel: { fontSize: 16, fontWeight: "700", color: "#8b7871" },
  transcriptText: { fontSize: 20, color: "#342C28", lineHeight: 32 },

  actions: { width: "100%", alignItems: "center" },

  recordButtonOuter: {
    width: 102, height: 102,
    borderRadius: 51,
    backgroundColor: "#F1E2D1",
    alignItems: "center",
    justifyContent: "center",
  },
  recordProgress: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
  },
  recordButton: {
    width: 66, height: 66,
    borderRadius: 33,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowColor: "#D65738",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  recordButtonActive: { backgroundColor: "#F06D4D" },
  recordBtnText: { fontSize: 11, fontWeight: "700", color: "white" },

  doneActions: { flexDirection: "row", gap: 12, width: "100%" },
  resetBtn: {
    flex: 1, height: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#FF7955",
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resetBtnText: { fontSize: 18, fontWeight: "700", color: "#FF7955" },
  saveBtn: {
    flex: 2, height: 64,
    borderRadius: 18,
    backgroundColor: "#FF7955",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#D65738",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  saveBtnText: { fontSize: 18, fontWeight: "700", color: "white" },

  finishHint: { marginTop: -12, color: "#9A887D", fontSize: 13, fontWeight: "600" },
});

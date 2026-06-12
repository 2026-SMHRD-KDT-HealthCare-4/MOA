import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Mic, MicOff, RotateCcw, CheckCircle } from "lucide-react-native";
import { MoaAvatar } from "../components/MoaAvatar";
import { useRecorder } from "../features/record/useRecorder";

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RecordPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, transcript, durationMs, permissionDenied, start, stop, reset } = useRecorder();

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isDone = state === "done";

  const avatarEmotion = isRecording ? "listening" : isDone ? "happy" : "greeting";

  function handleSave() {
    router.replace("/done");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          accessibilityLabel="뒤로 가기"
        >
          <ArrowLeft size={22} color="#756a66" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>오늘의 목소리 기록</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* 아바타 */}
        <View style={styles.avatarSection}>
          <MoaAvatar emotion={avatarEmotion} size={130} showOnlineDot={false} />
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

        {/* 타이머 (녹음 중에만 표시) */}
        {isRecording && (
          <View style={styles.timerRow}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{formatDuration(durationMs)}</Text>
          </View>
        )}

        {/* 분석 중 스피너 */}
        {isProcessing && (
          <View style={styles.processingRow}>
            <ActivityIndicator size="large" color="#FF706D" />
            <Text style={styles.processingText}>목소리 패턴을 분석하고 있어요</Text>
          </View>
        )}

        {/* 마이크 권한 거부 안내 */}
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
            /* 녹음 시작 / 중지 */
            <TouchableOpacity
              style={[styles.micBtn, isRecording && styles.micBtnRecording]}
              onPress={isRecording ? stop : start}
              disabled={isProcessing}
              activeOpacity={0.85}
              accessibilityLabel={isRecording ? "녹음 중지" : "녹음 시작"}
            >
              {isRecording ? (
                <MicOff size={36} color="white" />
              ) : (
                <Mic size={36} color="white" />
              )}
              <Text style={styles.micBtnText}>
                {isRecording ? "중지하기" : "시작하기"}
              </Text>
            </TouchableOpacity>
          ) : (
            /* 완료 후: 다시 하기 + 저장하기 */
            <View style={styles.doneActions}>
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={reset}
                activeOpacity={0.8}
                accessibilityLabel="다시 녹음하기"
              >
                <RotateCcw size={22} color="#FF706D" />
                <Text style={styles.resetBtnText}>다시 하기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                activeOpacity={0.85}
                accessibilityLabel="저장하기"
              >
                <CheckCircle size={22} color="white" />
                <Text style={styles.saveBtnText}>저장하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e2",
  },
  iconBtn: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4d403b",
    letterSpacing: 0.5,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
    gap: 24,
  },
  avatarSection: {
    alignItems: "center",
    gap: 16,
  },
  avatarHint: {
    fontSize: 18,
    color: "#a18f88",
    textAlign: "center",
    lineHeight: 28,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E8943A",
  },
  timerText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#4d403b",
    fontVariant: ["tabular-nums"],
  },
  processingRow: {
    alignItems: "center",
    gap: 12,
  },
  processingText: {
    fontSize: 18,
    color: "#a18f88",
  },
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
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  transcriptLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8b7871",
  },
  transcriptText: {
    fontSize: 20,
    color: "#362b27",
    lineHeight: 32,
  },
  actions: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  micBtn: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#FF706D",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 8,
  },
  micBtnRecording: {
    backgroundColor: "#E8943A",
    shadowColor: "#b86800",
  },
  micBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  doneActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  resetBtn: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#FF706D",
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resetBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF706D",
  },
  saveBtn: {
    flex: 2,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#FF706D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#ff5a5d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 5,
  },
  saveBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
});

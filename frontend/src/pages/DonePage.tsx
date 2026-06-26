import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Home,
  MessageCircle,
  Mic,
  Heart,
  Check,
  Volume2,
  Smile,
  TrendingUp,
} from "lucide-react-native";
import { CharacterPlayer } from "../components/CharacterPlayer";
import { useAuthStore } from "../stores/authStore";

type DoneRecordType = "record" | "conversation";

export default function DonePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: string;
    recordType?: string;
  }>();

  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const { width, height } = useWindowDimensions();

  const W = Math.min(width, 430);
  const H = height;
  const s = W / 430;
  const v = H / 900;

  const isHistoryView = params.type === "history";

  const recordType: DoneRecordType =
    params.recordType === "conversation" ? "conversation" : "record";

  const isConversation = recordType === "conversation";

  const homeHref = role === "guardian" ? "/(guardian)/" : "/(elder)/";
  const historyHref = "/history";

  const theme = isConversation
    ? {
        main: "#7A5CE0",
        light: "#EEE7FF",
        title: "대화 완료! ✨",
        badge: "대화 플로우",
        headline: "오늘도 모아와\n즐겁게 이야기했어요!",
        note1: "오늘 대화가 잘 기록되었어요.",
        note2: "충분한 음성을 확인했어요.",
        note3: "내일도 모아와 이야기해요!",
      }
    : {
        main: "#FF6F52",
        light: "#FFE9E1",
        title: "녹음 완료! ✨",
        badge: "녹음 플로우",
        headline: "오늘 목소리는\n맑은 편이에요!",
        note1: "지난 검사와 비슷해요.",
        note2: "충분한 음성이 기록되었어요.",
        note3: "내일도 건강한 목소리로 만나요!",
      };

  function goHome() {
    router.replace(isHistoryView ? historyHref : homeHref);
  }

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={["#FFF9F1", "#FFF4E8", "#F7D6AC"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.badge, { top: insets.top + 18, backgroundColor: theme.main }]}>
        {isConversation ? (
          <MessageCircle size={18} color="#FFFFFF" />
        ) : (
          <Mic size={18} color="#FFFFFF" />
        )}
        <Text style={styles.badgeText}>{theme.badge}</Text>
      </View>

      <Text style={[styles.title, { marginTop: insets.top + 76, color: theme.main }]}>
        {theme.title}
      </Text>

      <Text style={[styles.heart, { top: insets.top + Math.round(240 * v) }]}>♥</Text>

      <CharacterPlayer
        mood="happy"
        containerStyle={{
          left: Math.round(54 * s),
          right: Math.round(54 * s),
          top: insets.top + Math.round(128 * v),
          height: Math.round(330 * v),
          borderRadius: Math.round(90 * s),
        }}
      />

      <View style={[styles.resultCard, { top: insets.top + Math.round(410 * v) }]}>
        <View style={styles.headlineRow}>
          <View style={[styles.mainIconCircle, { backgroundColor: theme.light }]}>
            {isConversation ? (
              <MessageCircle size={38} color={theme.main} />
            ) : (
              <Smile size={38} color="#F7B928" />
            )}
          </View>

          <Text style={styles.headline}>
            {theme.headline.split("\n")[0]}
            {"\n"}
            <Text style={{ color: theme.main }}>{theme.headline.split("\n")[1]}</Text>
          </Text>
        </View>

        <View style={styles.resultList}>
          <View style={styles.resultRow}>
            <View style={styles.greenCircle}>
              {isConversation ? (
                <Check size={22} color="#36B979" />
              ) : (
                <TrendingUp size={21} color="#FF6F52" />
              )}
            </View>
            <Text style={styles.resultText}>{theme.note1}</Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.yellowCircle}>
              {isConversation ? (
                <Volume2 size={21} color="#F5A623" />
              ) : (
                <Mic size={21} color="#22C285" />
              )}
            </View>
            <Text style={styles.resultText}>{theme.note2}</Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.purpleCircle}>
              <Heart size={21} color={isConversation ? "#F45F8C" : theme.main} fill={isConversation ? "#F45F8C" : theme.main} />
            </View>
            <Text style={styles.resultText}>{theme.note3}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.homeButton,
            { backgroundColor: theme.main },
            pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
          ]}
          onPress={goHome}
          accessibilityRole="button"
          accessibilityLabel="홈으로 가기"
        >
          <Home size={27} color="#FFFFFF" />
          <Text style={styles.homeButtonText}>홈으로 가기</Text>
        </Pressable>
      </View>

      <Text style={[styles.bottomNote, { top: insets.top + Math.round(782 * v) }]}>
        ※ 결과는 리포트에서 더 자세히 확인할 수 있어요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },

  badge: {
    position: "absolute",
    alignSelf: "center",
    height: 38,
    paddingHorizontal: 22,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    zIndex: 10,
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  title: {
    fontSize: 31,
    lineHeight: 39,
    fontWeight: "900",
    textAlign: "center",
    zIndex: 5,
  },

  heart: {
    position: "absolute",
    left: 48,
    color: "#FF6F52",
    fontSize: 34,
    zIndex: 5,
  },

  resultCard: {
    position: "absolute",
    left: 24,
    right: 24,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: "#6A4B3C",
    shadowOpacity: 0.11,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    zIndex: 6,
  },

  headlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 22,
  },

  mainIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },

  headline: {
    flex: 1,
    color: "#2F2A26",
    fontSize: 25,
    lineHeight: 33,
    fontWeight: "900",
  },

  resultList: {
    gap: 16,
  },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  greenCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DDF8EA",
    alignItems: "center",
    justifyContent: "center",
  },

  yellowCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFF1C8",
    alignItems: "center",
    justifyContent: "center",
  },

  purpleCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EFE6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  resultText: {
    flex: 1,
    color: "#3F332E",
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
  },

  homeButton: {
    height: 66,
    borderRadius: 16,
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    shadowColor: "#6A4B3C",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  homeButtonText: {
    color: "#FFFFFF",
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
  },

  bottomNote: {
    position: "absolute",
    left: 20,
    right: 20,
    color: "#8D796D",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
  },
});
import {
  Image,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Home,
  MessageCircle,
  Mic,
  Heart,
  Volume2,
  Smile,
  TrendingUp,
} from "lucide-react-native";
import { CharacterPlayer } from "../components/CharacterPlayer";
import { useAuthStore } from "../stores/authStore";
import { WEATHER_IMAGE, type WeatherStatus } from "../constants/weatherIcons";

type DoneRecordType = "record" | "conversation";
type MetricTone = "green" | "blue" | "orange" | "purple";

const MOA_WINK_HEART = require("../../assets/images/moa-wink-heart.png");

const voiceSummary: {
  weather: WeatherStatus;
  status: string;
  description: string;
  comparisonTitle: string;
  comparisonDescription: string;
} = {
  weather: "sunny",
  status: "맑은 편이에요!",
  description: "오늘은 안정적인 목소리로 기록되었어요.",
  comparisonTitle: "지난 검사와 비슷해요.",
  comparisonDescription: "큰 변화는 없어요.",
};

const analysisItems: Array<{
  label: string;
  value: string;
  progress: number;
  tone: MetricTone;
  icon: "voice" | "speed" | "amount" | "clarity";
}> = [
  { label: "목소리 떨림", value: "안정적", progress: 88, tone: "green", icon: "voice" },
  { label: "말하기 속도", value: "정상", progress: 78, tone: "blue", icon: "speed" },
  { label: "발화량", value: "충분", progress: 86, tone: "orange", icon: "amount" },
  { label: "음성 명료도", value: "좋음", progress: 84, tone: "purple", icon: "clarity" },
];

export default function DonePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    origin?: string;
    source?: string;
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

  const origin = params.origin ?? params.source ?? (params.type === "history" ? "history" : "home");
  const isHistoryView = origin === "history";

  const recordType: DoneRecordType =
    params.recordType === "conversation" ? "conversation" : "record";

  const isConversation = recordType === "conversation";

  const homeHref = role === "guardian" ? "/(guardian)/" : "/(elder)/";
  const historyHref = "/history";
  const ctaLabel = isHistoryView ? "기록으로 돌아가기" : "홈으로 가기";

  const theme = isConversation
    ? {
        main: "#7A5CE0",
        light: "#EEE7FF",
        title: "대화 완료!",
        badge: "대화 플로우",
      }
    : {
        main: "#FF6F52",
        light: "#FFE9E1",
        title: "녹음 완료!",
        badge: "녹음 플로우",
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

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={[
          styles.screenScrollContent,
          { paddingTop: insets.top + 18 },
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.badge, { backgroundColor: theme.main }]}>
          {isConversation ? (
            <MessageCircle size={18} color="#FFFFFF" />
          ) : (
            <Mic size={18} color="#FFFFFF" />
          )}
          <Text style={styles.badgeText}>{theme.badge}</Text>
        </View>

        <Text style={[styles.title, { color: theme.main }]}>{theme.title}</Text>

        <View style={[styles.heroStage, { height: Math.round(330 * v) }]}>
          <Text style={[styles.heart, { top: Math.round(112 * v) }]}>♥</Text>

          <CharacterPlayer
            mood="happy"
            containerStyle={{
              left: Math.round(54 * s),
              right: Math.round(54 * s),
              top: 0,
              height: Math.round(330 * v),
              borderRadius: Math.round(90 * s),
            }}
          />
        </View>

        <View style={styles.resultCard}>
          <View style={styles.statusRow}>
            <View style={styles.weatherCircle}>
              <Image
                source={WEATHER_IMAGE[voiceSummary.weather]}
                style={styles.weatherIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.sectionEyebrow}>오늘의 목소리 상태</Text>
              <Text style={[styles.statusTitle, { color: theme.main }]}>
                {voiceSummary.status}
              </Text>
              <Text style={styles.statusDescription}>{voiceSummary.description}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.compareRow}>
            <View style={styles.compareIconCircle}>
              <TrendingUp size={29} color="#18A86B" />
            </View>
            <View style={styles.compareTextWrap}>
              <Text style={styles.compareLabel}>지난 검사와 비교</Text>
              <Text style={styles.compareTitle}>{voiceSummary.comparisonTitle}</Text>
              <Text style={styles.compareDescription}>
                {voiceSummary.comparisonDescription}
              </Text>
            </View>
          </View>

          <View style={styles.analysisHeaderRow}>
            <View style={styles.headerLine} />
            <Text style={styles.analysisTitle}>오늘의 목소리 분석</Text>
            <View style={styles.headerLine} />
          </View>

          <View style={styles.analysisList}>
            {analysisItems.map((item) => (
              <AnalysisRow key={item.label} item={item} />
            ))}
          </View>

          <View style={styles.moaMessageCard}>
            <Image source={MOA_WINK_HEART} style={styles.moaMessageImage} resizeMode="contain" />
            <View style={styles.moaMessageTextWrap}>
              <Text style={[styles.moaMessageTitle, { color: theme.main }]}>
                모아가 전해요!
              </Text>
              <Text style={styles.moaMessageText}>오늘처럼 편안하게 이야기하면</Text>
              <Text style={styles.moaMessageText}>변화를 더 정확하게 살펴볼 수 있어요.</Text>
              <Text style={styles.moaMessageText}>내일도 모아와 함께해요. 💜</Text>
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
            accessibilityLabel={ctaLabel}
          >
            <Home size={27} color="#FFFFFF" />
            <Text style={styles.homeButtonText}>{ctaLabel}</Text>
          </Pressable>
        </View>

        <Text style={styles.bottomNote}>
          ※ 결과는 리포트에서 더 자세히 확인할 수 있어요.
        </Text>
      </ScrollView>
    </View>
  );
}

function AnalysisRow({
  item,
}: {
  item: {
    label: string;
    value: string;
    progress: number;
    tone: MetricTone;
    icon: "voice" | "speed" | "amount" | "clarity";
  };
}) {
  const color = toneColor[item.tone];

  return (
    <View style={styles.analysisRow}>
      <View style={[styles.metricIconCircle, { backgroundColor: color.light }]}>
        {item.icon === "voice" && <Volume2 size={24} color={color.main} />}
        {item.icon === "speed" && <TrendingUp size={23} color={color.main} />}
        {item.icon === "amount" && <Mic size={24} color={color.main} />}
        {item.icon === "clarity" && <Heart size={23} color={color.main} fill={color.main} />}
      </View>

      <Text style={styles.metricLabel}>{item.label}</Text>

      <View style={styles.metricResult}>
        <Text style={[styles.metricValue, { color: color.main }]}>{item.value}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${item.progress}%`, backgroundColor: color.main },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const toneColor: Record<MetricTone, { main: string; light: string }> = {
  green: { main: "#18A86B", light: "#E1F8EF" },
  blue: { main: "#5579E8", light: "#E8EEFF" },
  orange: { main: "#FF9F1C", light: "#FFF1D9" },
  purple: { main: "#704FD3", light: "#EFE7FF" },
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },

  screenScroll: {
    flex: 1,
  },

  screenScrollContent: {
    paddingBottom: 28,
  },

  badge: {
    alignSelf: "center",
    height: 38,
    paddingHorizontal: 22,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },

  title: {
    marginTop: 20,
    marginBottom: 13,
    fontSize: 31,
    lineHeight: 39,
    fontWeight: "900",
    textAlign: "center",
  },

  heroStage: {
    position: "relative",
    marginBottom: 12,
  },

  heart: {
    position: "absolute",
    left: 48,
    color: "#7A5CE0",
    fontSize: 34,
    zIndex: 5,
  },

  resultCard: {
    marginHorizontal: 20,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 18,
  },

  weatherCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFF7E8",
    alignItems: "center",
    justifyContent: "center",
  },

  weatherIcon: {
    width: 72,
    height: 72,
  },

  statusTextWrap: {
    flex: 1,
  },

  sectionEyebrow: {
    color: "#2F2A26",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    marginBottom: 5,
  },

  statusTitle: {
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    marginBottom: 4,
  },

  statusDescription: {
    color: "#5D514B",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "#EEE8E3",
    marginBottom: 18,
  },

  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    marginBottom: 22,
  },

  compareIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#DDF8EA",
    alignItems: "center",
    justifyContent: "center",
  },

  compareTextWrap: {
    flex: 1,
  },

  compareLabel: {
    color: "#2F2A26",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    marginBottom: 2,
  },

  compareTitle: {
    color: "#2F2A26",
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
  },

  compareDescription: {
    color: "#6F625C",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },

  analysisHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 13,
  },

  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5DDD7",
  },

  analysisTitle: {
    color: "#2F2A26",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
  },

  analysisList: {
    gap: 0,
    marginBottom: 18,
  },

  analysisRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE8E3",
    gap: 12,
  },

  metricIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },

  metricLabel: {
    flex: 1,
    color: "#2F2A26",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
  },

  metricResult: {
    width: 130,
    alignItems: "flex-start",
    gap: 7,
  },

  metricValue: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
  },

  progressTrack: {
    width: "100%",
    height: 9,
    borderRadius: 5,
    backgroundColor: "#E5E5E5",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 5,
  },

  moaMessageCard: {
    minHeight: 126,
    borderRadius: 18,
    backgroundColor: "#F5EEFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 16,
  },

  moaMessageImage: {
    width: 112,
    height: 104,
  },

  moaMessageTextWrap: {
    flex: 1,
  },

  moaMessageTitle: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "900",
    marginBottom: 5,
  },

  moaMessageText: {
    color: "#2F2A26",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
  },

  homeButton: {
    height: 66,
    borderRadius: 16,
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
    marginTop: 10,
    color: "#8D796D",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
  },
});

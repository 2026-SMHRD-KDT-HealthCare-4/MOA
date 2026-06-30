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
  Clock3,
  MessageCircle,
  Mic,
  TrendingUp,
} from "lucide-react-native";
import { CharacterPlayer } from "../components/CharacterPlayer";
import { useAuthStore } from "../stores/authStore";
import { WEATHER_IMAGE, type WeatherStatus } from "../constants/weatherIcons";

type DoneRecordType = "record" | "conversation";
type Weather = WeatherStatus; // "sunny" | "cloudy" | "rainy"
type Comparison = "first" | "similar" | "changed";

const MOA_WINK_HEART = require("../../assets/images/moa-wink-heart.png");

function isWeather(v: unknown): v is Weather {
  return v === "sunny" || v === "cloudy" || v === "rainy";
}
function isComparison(v: unknown): v is Comparison {
  return v === "first" || v === "similar" || v === "changed";
}

function positiveNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function conversationSessionText(count: number | null): string {
  if (count === null || count <= 1) return "모아와 한 차례 안부를 나눴어요.";
  if (count <= 3) return "모아와 여러 차례 안부를 나눴어요.";
  return "모아와 자주 이야기를 나눴어요.";
}

function conversationTurnText(count: number | null): string {
  if (count === null || count <= 1) return "짧게 이야기를 들려주셨어요.";
  if (count <= 4) return "여러 이야기를 들려주셨어요.";
  return "이야기를 풍성하게 들려주셨어요.";
}

function conversationDurationText(minutes: number | null): string {
  if (minutes === null || minutes < 3) return "잠시 편하게 이야기를 나눴어요.";
  if (minutes < 10) return "한동안 편하게 이야기를 나눴어요.";
  return "여유 있게 오랫동안 이야기를 나눴어요.";
}

// 날씨(백엔드 단일 소스 결과)별 상태 문구 — 점수/수치 비노출(규칙6), 비진단 표현.
const WEATHER_SUMMARY: Record<
  Weather,
  { status: string; description: string; historyDescription: string }
> = {
  sunny: {
    status: "맑은 편이에요!",
    description: "오늘은 안정적인 목소리로 기록되었어요.",
    historyDescription: "이날은 안정적인 목소리로 기록되었어요.",
  },
  cloudy: {
    status: "목소리 상태가 조금 흐린 편이에요",
    description: "평소와 살짝 다른 결이 느껴져요. 편히 쉬어가요.",
    historyDescription: "이날의 목소리 상태를 흐림으로 기록했어요.",
  },
  rainy: {
    status: "목소리 날씨가 비예요",
    description: "오늘은 조금 더 주의해서 살펴볼 신호가 있어요. 무리하지 말고 쉬어가요.",
    historyDescription: "이날은 목소리를 조금 더 주의해서 살펴볼 신호가 있었어요.",
  },
};

// 직전 기록 대비(실데이터: first/similar/changed).
const COMPARISON_SUMMARY: Record<Comparison, { title: string; description: string }> = {
  first: { title: "첫 기록이에요.", description: "앞으로 변화를 함께 살펴볼게요." },
  similar: { title: "지난번과 비슷해요.", description: "큰 변화는 없어요." },
  changed: { title: "지난번과 조금 달라졌어요.", description: "변화가 있는지 함께 지켜봐요." },
};

export default function DonePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    origin?: string;
    source?: string;
    type?: string;
    recordType?: string;
    weather?: string;
    comparison?: string;
    dateLabel?: string;
    time?: string;
    description?: string;
    summary?: string;
    conversationSessionCount?: string;
    conversationTurnCount?: string;
    conversationDurationMinutes?: string;
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

  // 녹음 직후 분석 결과(백엔드 단일 소스). 없으면(오프라인/목업) null → 중립 폴백.
  const weather: Weather | null = isWeather(params.weather) ? params.weather : null;
  const comparison: Comparison | null = isComparison(params.comparison)
    ? params.comparison
    : null;
  const summary = weather ? WEATHER_SUMMARY[weather] : null;
  const conversationMeta = [params.time, params.description].filter(Boolean).join(" · ");
  const conversationSessionCount = positiveNumber(params.conversationSessionCount);
  const conversationTurnCount = positiveNumber(params.conversationTurnCount);
  const conversationDurationMinutes = positiveNumber(params.conversationDurationMinutes);

  const homeHref = role === "guardian" ? "/(guardian)/" : "/(elder)/";
  const historyHref = "/history";
  const ctaLabel = isHistoryView ? "기록으로 돌아가기" : "홈으로 가기";

  const theme = isConversation
    ? {
        main: "#7A5CE0",
        light: "#EEE7FF",
        title: isHistoryView ? "대화 기록" : "대화 완료!",
        badge: isHistoryView ? "기록 보기" : "대화 플로우",
      }
    : {
        main: "#FF6F52",
        light: "#FFE9E1",
        title: isHistoryView ? "목소리 기록" : "녹음 완료!",
        badge: isHistoryView ? "기록 보기" : "녹음 플로우",
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
            {isConversation ? (
              <View style={[styles.weatherCircle, styles.conversationCircle]}>
                <MessageCircle size={44} color={theme.main} />
              </View>
            ) : weather ? (
              <View style={styles.weatherCircle}>
                <Image
                  source={WEATHER_IMAGE[weather]}
                  style={styles.weatherIcon}
                  resizeMode="contain"
                />
              </View>
            ) : null}
            <View style={styles.statusTextWrap}>
              <Text style={styles.sectionEyebrow}>
                {isConversation
                  ? "모아와 대화 기록"
                  : isHistoryView
                  ? "이날의 목소리 상태"
                  : "오늘의 목소리 상태"}
              </Text>
              <Text style={[styles.statusTitle, { color: theme.main }]}>
                {isConversation
                  ? params.dateLabel ?? "대화를 나눴어요"
                  : summary
                  ? summary.status
                  : "기록이 저장됐어요"}
              </Text>
              <Text style={styles.statusDescription}>
                {isConversation
                  ? params.summary ?? "모아와 이야기를 나눴어요."
                  : summary
                  ? isHistoryView
                    ? summary.historyDescription
                    : summary.description
                  : "분석 결과는 잠시 후 리포트에서 확인할 수 있어요."}
              </Text>
              {isConversation && conversationMeta ? (
                <Text style={styles.conversationMeta}>{conversationMeta}</Text>
              ) : null}
            </View>
          </View>

          {isConversation && weather && summary ? (
            <>
              <View style={styles.divider} />
              <View style={styles.conversationWeatherRow}>
                <View style={styles.conversationWeatherCircle}>
                  <Image
                    source={WEATHER_IMAGE[weather]}
                    style={styles.conversationWeatherIcon}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.conversationWeatherText}>
                  <Text style={styles.conversationWeatherLabel}>이날의 목소리 날씨</Text>
                  <Text style={[styles.conversationWeatherTitle, { color: theme.main }]}>
                    {summary.status}
                  </Text>
                  <Text style={styles.conversationWeatherDescription}>
                    {summary.historyDescription}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {isConversation ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.conversationInfoTitle}>이날의 대화 정보</Text>
              <View style={styles.conversationInfoList}>
                <ConversationInfoRow
                  icon="conversation"
                  label="대화 나눔"
                  value={conversationSessionText(conversationSessionCount)}
                />
                <ConversationInfoRow
                  icon="story"
                  label="들려주신 이야기"
                  value={conversationTurnText(conversationTurnCount)}
                />
                {conversationDurationMinutes !== null ? (
                  <ConversationInfoRow
                    icon="time"
                    label="함께한 시간"
                    value={conversationDurationText(conversationDurationMinutes)}
                  />
                ) : null}
              </View>
            </>
          ) : null}

          {!isConversation && comparison ? (
            <>
              <View style={styles.divider} />
              <View style={styles.compareRow}>
                <View style={styles.compareIconCircle}>
                  <TrendingUp size={29} color="#18A86B" />
                </View>
                <View style={styles.compareTextWrap}>
                  <Text style={styles.compareLabel}>지난 검사와 비교</Text>
                  <Text style={styles.compareTitle}>
                    {COMPARISON_SUMMARY[comparison].title}
                  </Text>
                  <Text style={styles.compareDescription}>
                    {COMPARISON_SUMMARY[comparison].description}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.moaMessageCard}>
            <Image source={MOA_WINK_HEART} style={styles.moaMessageImage} resizeMode="contain" />
            <View style={styles.moaMessageTextWrap}>
              <Text style={[styles.moaMessageTitle, { color: theme.main }]}>
                모아가 전해요!
              </Text>
              {isConversation ? (
                <>
                  <Text style={styles.moaMessageText}>
                    {isHistoryView ? "이날 들려주신 이야기," : "오늘 들려주신 이야기,"}
                  </Text>
                  <Text style={styles.moaMessageText}>소중하게 기억할게요.</Text>
                  <Text style={styles.moaMessageText}>내일도 편하게 이야기해요. 💜</Text>
                </>
              ) : (
                <>
                  <Text style={styles.moaMessageText}>
                    {isHistoryView ? "이날처럼 편안하게 이야기하면" : "오늘처럼 편안하게 이야기하면"}
                  </Text>
                  <Text style={styles.moaMessageText}>변화를 더 정확하게 살펴볼 수 있어요.</Text>
                  <Text style={styles.moaMessageText}>내일도 모아와 함께해요. 💜</Text>
                </>
              )}
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

        {!isConversation ? (
          <Text style={styles.bottomNote}>
            ※ 결과는 리포트에서 더 자세히 확인할 수 있어요.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ConversationInfoRow({
  icon,
  label,
  value,
}: {
  icon: "conversation" | "story" | "time";
  label: string;
  value: string;
}) {
  return (
    <View style={styles.conversationInfoRow}>
      <View style={styles.conversationInfoIcon}>
        {icon === "conversation" ? <MessageCircle size={23} color="#7A5CE0" /> : null}
        {icon === "story" ? <Mic size={23} color="#7A5CE0" /> : null}
        {icon === "time" ? <Clock3 size={23} color="#7A5CE0" /> : null}
      </View>
      <View style={styles.conversationInfoText}>
        <Text style={styles.conversationInfoLabel}>{label}</Text>
        <Text style={styles.conversationInfoValue}>{value}</Text>
      </View>
    </View>
  );
}

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

  conversationCircle: {
    backgroundColor: "#F2ECFF",
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

  conversationMeta: {
    marginTop: 8,
    color: "#7C6E67",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },

  conversationWeatherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },

  conversationWeatherCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FFF7E8",
    alignItems: "center",
    justifyContent: "center",
  },

  conversationWeatherIcon: {
    width: 58,
    height: 58,
  },

  conversationWeatherText: {
    flex: 1,
  },

  conversationWeatherLabel: {
    color: "#2F2A26",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "900",
  },

  conversationWeatherTitle: {
    marginTop: 1,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
  },

  conversationWeatherDescription: {
    marginTop: 2,
    color: "#6F625C",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },

  conversationInfoTitle: {
    color: "#2F2A26",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "900",
    marginBottom: 10,
  },

  conversationInfoList: {
    marginBottom: 18,
  },

  conversationInfoRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE8E3",
  },

  conversationInfoIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F2ECFF",
    alignItems: "center",
    justifyContent: "center",
  },

  conversationInfoText: {
    flex: 1,
  },

  conversationInfoLabel: {
    color: "#2F2A26",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },

  conversationInfoValue: {
    marginTop: 2,
    color: "#6F625C",
    fontSize: 15,
    lineHeight: 21,
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

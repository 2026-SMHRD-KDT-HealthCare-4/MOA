import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  AudioWaveform,
  Bell,
  Brain,
  CalendarDays,
  ChevronRight,
  Footprints,
  Gauge,
  HeartPulse,
  MessageCircle,
  Mic,
  Moon,
  Phone,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Volume2,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

type MetricTone = "blue" | "teal" | "green" | "amber";

const ELDER = {
  name: "김서자",
  relation: "어머니",
  age: 72,
  status: "안정",
  checkedAt: "오늘 오전 9:42",
  healthScore: 86,
  voiceMood: "밝음",
  riskLevel: "낮음",
  sleep: "7시간 20분",
  steps: "4,820",
  heartRate: "72",
  recordStreak: 7,
};

const METRICS: {
  label: string;
  value: string;
  unit?: string;
  change: string;
  icon: LucideIcon;
  tone: MetricTone;
}[] = [
  { label: "마음 컨디션", value: "86", unit: "점", change: "+4 안정", icon: Brain, tone: "blue" },
  { label: "수면", value: "7:20", change: "충분", icon: Moon, tone: "teal" },
  { label: "걸음", value: "4,820", unit: "보", change: "평소 대비 92%", icon: Footprints, tone: "green" },
  { label: "심박", value: "72", unit: "bpm", change: "정상 범위", icon: HeartPulse, tone: "amber" },
];

const INSIGHTS = [
  {
    title: "아침 목소리 기록 완료",
    body: "발화 속도와 감정 톤이 최근 7일 평균 범위 안에 있어요.",
    time: "09:42",
    icon: MessageCircle,
  },
  {
    title: "수면 회복 양호",
    body: "깊은 수면 비율이 어제보다 소폭 좋아졌습니다.",
    time: "07:10",
    icon: Moon,
  },
  {
    title: "활동량 확인 필요",
    body: "오후 산책 시간이 평소보다 짧습니다.",
    time: "15:30",
    icon: Footprints,
  },
];

const WEEK = [
  { day: "월", score: 78 },
  { day: "화", score: 82 },
  { day: "수", score: 74 },
  { day: "목", score: 88 },
  { day: "금", score: 70 },
  { day: "토", score: 84 },
  { day: "일", score: 86 },
];

const VOICE_MEASUREMENTS = [
  { label: "말속도", value: "안정", detail: "분당 128음절", progress: 76 },
  { label: "음량", value: "충분", detail: "평균 62dB", progress: 68 },
  { label: "떨림", value: "낮음", detail: "변동 8%", progress: 22 },
  { label: "감정톤", value: "밝음", detail: "긍정 신호", progress: 84 },
];

const TONE_COLORS: Record<MetricTone, { bg: string; icon: string; soft: string }> = {
  blue: { bg: "#EAF2FF", icon: "#316BFF", soft: "#F5F8FF" },
  teal: { bg: "#E8F8F5", icon: "#0E9384", soft: "#F3FCFA" },
  green: { bg: "#EEF9EF", icon: "#2E9B57", soft: "#F7FCF7" },
  amber: { bg: "#FFF3DB", icon: "#D47A18", soft: "#FFFAF0" },
};

function MetricCard({
  label,
  value,
  unit,
  change,
  icon: Icon,
  tone,
}: (typeof METRICS)[number]) {
  const colors = TONE_COLORS[tone];

  return (
    <View style={[styles.metricCard, { backgroundColor: colors.soft }]}>
      <View style={[styles.metricIcon, { backgroundColor: colors.bg }]}>
        <Icon size={21} color={colors.icon} strokeWidth={2.4} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
      <Text style={[styles.metricChange, { color: colors.icon }]}>{change}</Text>
    </View>
  );
}

export default function DashboardPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const chartBarWidth = Math.max(18, Math.min(28, (width - 112) / WEEK.length));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>보호자 홈</Text>
          <Text style={styles.headerTitle}>{ELDER.name}님의 오늘</Text>
        </View>
        <Pressable style={styles.bellButton} accessibilityRole="button" accessibilityLabel="알림">
          <Bell size={22} color="#0F2342" strokeWidth={2.3} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 116 }]}
      >
        <LinearGradient
          colors={["#0B1B34", "#123C69", "#0F766E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>{ELDER.relation} · 만 {ELDER.age}세</Text>
              <Text style={styles.heroTitle}>종합 건강 점수 {ELDER.healthScore}</Text>
            </View>
            <View style={styles.statusPill}>
              <ShieldCheck size={15} color="#BFFFEF" />
              <Text style={styles.statusPillText}>{ELDER.status}</Text>
            </View>
          </View>

          <View style={styles.heroScoreRow}>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreText}>{ELDER.healthScore}</Text>
              <Text style={styles.scoreUnit}>/100</Text>
            </View>
            <View style={styles.heroFacts}>
              <View style={styles.heroFact}>
                <Sparkles size={17} color="#BFFFEF" />
                <Text style={styles.heroFactText}>목소리 톤 {ELDER.voiceMood}</Text>
              </View>
              <View style={styles.heroFact}>
                <Activity size={17} color="#BFD9FF" />
                <Text style={styles.heroFactText}>위험도 {ELDER.riskLevel}</Text>
              </View>
              <Text style={styles.heroUpdated}>{ELDER.checkedAt} 업데이트</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.quickActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push("/(guardian)/report")}
            accessibilityRole="button"
          >
            <TrendingUp size={20} color="#0F766E" />
            <Text style={styles.actionText}>리포트</Text>
          </Pressable>
          <Pressable style={styles.actionButton} accessibilityRole="button">
            <Phone size={20} color="#316BFF" />
            <Text style={styles.actionText}>연락</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => router.push("/(guardian)/family")}
            accessibilityRole="button"
          >
            <Users size={20} color="#D47A18" />
            <Text style={styles.actionText}>가족</Text>
          </Pressable>
        </View>

        <View style={styles.voiceCard}>
          <View style={styles.voiceHeader}>
            <View style={styles.voiceTitleRow}>
              <View style={styles.voiceIcon}>
                <Mic size={23} color="#DFFFF8" strokeWidth={2.5} />
              </View>
              <View style={styles.voiceTitleCopy}>
                <Text style={styles.voiceKicker}>오늘의 목소리 측정</Text>
                <Text style={styles.voiceTitle}>음성 건강 신호 91점</Text>
              </View>
            </View>
            <View style={styles.voiceBadge}>
              <AudioWaveform size={15} color="#78F2D6" />
              <Text style={styles.voiceBadgeText}>측정 완료</Text>
            </View>
          </View>

          <View style={styles.voiceScoreRow}>
            <View style={styles.voiceScoreCircle}>
              <Text style={styles.voiceScoreText}>91</Text>
              <Text style={styles.voiceScoreUnit}>점</Text>
            </View>
            <View style={styles.voiceSummary}>
              <View style={styles.voiceSummaryItem}>
                <Gauge size={17} color="#BFD9FF" />
                <Text style={styles.voiceSummaryText}>최근 7일 평균보다 또렷해요</Text>
              </View>
              <View style={styles.voiceSummaryItem}>
                <Volume2 size={17} color="#BFFFEF" />
                <Text style={styles.voiceSummaryText}>음량과 발화 지속시간이 안정적이에요</Text>
              </View>
              <Text style={styles.voiceMeasuredAt}>30초 문장 읽기 · 오늘 오전 9:42</Text>
            </View>
          </View>

          <View style={styles.voiceMetrics}>
            {VOICE_MEASUREMENTS.map((item) => (
              <View key={item.label} style={styles.voiceMetric}>
                <View style={styles.voiceMetricTop}>
                  <Text style={styles.voiceMetricLabel}>{item.label}</Text>
                  <Text style={styles.voiceMetricValue}>{item.value}</Text>
                </View>
                <View style={styles.voiceProgressTrack}>
                  <View style={[styles.voiceProgressFill, { width: `${item.progress}%` }]} />
                </View>
                <Text style={styles.voiceMetricDetail}>{item.detail}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>주요 지표</Text>
          <Text style={styles.sectionMeta}>실시간 요약</Text>
        </View>
        <View style={styles.metricsGrid}>
          {METRICS.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </View>

        <View style={styles.alertBand}>
          <View style={styles.alertIconWrap}>
            <AlertTriangle size={22} color="#D47A18" />
          </View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>오늘은 큰 이상 징후가 없어요</Text>
            <Text style={styles.alertBody}>다만 오후 활동량이 낮아 산책이나 가벼운 통화를 권장합니다.</Text>
          </View>
          <ChevronRight size={20} color="#8A98AA" />
        </View>

        <View style={styles.weekCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>7일 컨디션 흐름</Text>
              <Text style={styles.cardSub}>음성 기록과 생활 지표 기반</Text>
            </View>
            <CalendarDays size={22} color="#316BFF" />
          </View>
          <View style={styles.chartRow}>
            {WEEK.map((item) => (
              <View key={item.day} style={styles.chartItem}>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: `${item.score}%`,
                        width: chartBarWidth,
                        backgroundColor: item.score >= 80 ? "#0F766E" : "#316BFF",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.chartDay}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘의 타임라인</Text>
          <Pressable onPress={() => router.push("/(guardian)/report")}>
            <Text style={styles.linkText}>자세히</Text>
          </Pressable>
        </View>
        <View style={styles.timeline}>
          {INSIGHTS.map((item, index) => {
            const Icon = item.icon;
            return (
              <View key={item.title} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={styles.timelineDot}>
                    <Icon size={16} color="#0F766E" />
                  </View>
                  {index < INSIGHTS.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineTitleRow}>
                    <Text style={styles.timelineTitle}>{item.title}</Text>
                    <Text style={styles.timelineTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.timelineBody}>{item.body}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCopy: {
    gap: 3,
  },
  kicker: {
    color: "#0F766E",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  headerTitle: {
    color: "#0F2342",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
  },
  bellButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10213A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  hero: {
    borderRadius: 28,
    padding: 22,
    gap: 22,
    shadowColor: "#0B1B34",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 8,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroLabel: {
    color: "#BFD9FF",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
    marginTop: 4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(191,255,239,0.14)",
    borderWidth: 1,
    borderColor: "rgba(191,255,239,0.28)",
  },
  statusPillText: {
    color: "#DFFFF8",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "900",
  },
  heroScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  scoreRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 10,
    borderColor: "#78F2D6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  scoreText: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  scoreUnit: {
    color: "#BFD9FF",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
  },
  heroFacts: {
    flex: 1,
    gap: 9,
  },
  heroFact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroFactText: {
    color: "#F3FAFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  heroUpdated: {
    color: "#AFC8E8",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5EBF2",
  },
  actionText: {
    color: "#1D3557",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  voiceCard: {
    borderRadius: 26,
    padding: 18,
    gap: 18,
    backgroundColor: "#10233F",
    borderWidth: 1,
    borderColor: "rgba(191,217,255,0.16)",
    shadowColor: "#0B1B34",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  voiceHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  voiceTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  voiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "rgba(15,118,110,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceTitleCopy: {
    flex: 1,
    gap: 2,
  },
  voiceKicker: {
    color: "#AFC8E8",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  voiceTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  voiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(120,242,214,0.12)",
    borderWidth: 1,
    borderColor: "rgba(120,242,214,0.24)",
  },
  voiceBadgeText: {
    color: "#DFFFF8",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "900",
  },
  voiceScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  voiceScoreCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 8,
    borderColor: "#78F2D6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  voiceScoreText: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
  },
  voiceScoreUnit: {
    color: "#BFD9FF",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },
  voiceSummary: {
    flex: 1,
    gap: 8,
  },
  voiceSummaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  voiceSummaryText: {
    flex: 1,
    color: "#F3FAFF",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  voiceMeasuredAt: {
    color: "#AFC8E8",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  voiceMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  voiceMetric: {
    width: "48%",
    minHeight: 92,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(191,217,255,0.12)",
    gap: 7,
  },
  voiceMetricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  voiceMetricLabel: {
    color: "#AFC8E8",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  voiceMetricValue: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  voiceProgressTrack: {
    height: 7,
    borderRadius: 7,
    backgroundColor: "rgba(191,217,255,0.18)",
    overflow: "hidden",
  },
  voiceProgressFill: {
    height: 7,
    borderRadius: 7,
    backgroundColor: "#78F2D6",
  },
  voiceMetricDetail: {
    color: "#D8E7FA",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  sectionHeader: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#0F2342",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
  },
  sectionMeta: {
    color: "#6E7D90",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    width: "48%",
    minHeight: 154,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E7EDF4",
    gap: 8,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    color: "#5B6B80",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  metricValue: {
    color: "#0F2342",
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
  },
  metricUnit: {
    color: "#5B6B80",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
  },
  metricChange: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  alertBand: {
    minHeight: 82,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EDF4",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 13,
  },
  alertIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFF3DB",
    alignItems: "center",
    justifyContent: "center",
  },
  alertCopy: {
    flex: 1,
    gap: 3,
  },
  alertTitle: {
    color: "#0F2342",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  alertBody: {
    color: "#5B6B80",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  weekCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    gap: 18,
    borderWidth: 1,
    borderColor: "#E7EDF4",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: "#0F2342",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  cardSub: {
    color: "#6E7D90",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  chartRow: {
    height: 154,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  chartItem: {
    alignItems: "center",
    gap: 8,
  },
  chartTrack: {
    width: 30,
    height: 124,
    borderRadius: 15,
    backgroundColor: "#EEF3F8",
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
  },
  chartBar: {
    borderRadius: 14,
  },
  chartDay: {
    color: "#6E7D90",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  linkText: {
    color: "#316BFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  timeline: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E7EDF4",
  },
  timelineRow: {
    flexDirection: "row",
    gap: 13,
  },
  timelineRail: {
    alignItems: "center",
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E8F8F5",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 42,
    backgroundColor: "#E7EDF4",
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 18,
  },
  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  timelineTitle: {
    flex: 1,
    color: "#0F2342",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  timelineTime: {
    color: "#8A98AA",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  timelineBody: {
    color: "#5B6B80",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 4,
  },
});

import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronDown, ChevronUp, Info } from "lucide-react-native";
import { colors } from "../../styles/tokens";

const G = colors.guardian;

// 음성 건강 가이드 — 리포트와 분리된 정적 웰니스 정보 페이지.
// 화면에는 특정 질환명이나 의료 판단을 노출하지 않고 음성 변화 연구의 맥락만 안내한다.
interface GuideSection {
  id: string;
  icon: string;
  title: string;
  body: string;
  metrics?: string[];
  mappings?: Array<{ change: string; research: string }>;
}

const SECTIONS: GuideSection[] = [
  {
    id: "rhythm",
    icon: "💬",
    title: "말의 속도와 리듬",
    body:
      "평소보다 말이 느려지거나 말 사이의 멈춤이 길어지는 변화는 인지 기능이나 신경계 변화와 관련하여 연구되는 음성 특징 중 하나입니다. MOA는 이러한 변화를 장기간 비교하여 작은 변화를 살펴봅니다.",
    metrics: ["말하는 속도", "말 사이 쉬는 시간(Pause)", "말의 리듬"],
  },
  {
    id: "stability",
    icon: "🎙️",
    title: "목소리의 안정성",
    body:
      "목소리가 떨리거나 일정하지 않은 변화는 성대 움직임과 신경계 조절 변화에서 함께 연구되는 음성 특징입니다. MOA는 이러한 미세한 변화를 매일 비교합니다.",
    metrics: ["Jitter", "Shimmer", "HNR"],
  },
  {
    id: "breath",
    icon: "💨",
    title: "호흡과 발성 지속력",
    body:
      "숨이 쉽게 끊기거나 목소리를 오래 유지하기 어려운 변화는 호흡과 발성 기능 변화를 살펴보는 데 활용되는 특징입니다.",
    metrics: ["MPT", "RMS", "HNR"],
  },
  {
    id: "language",
    icon: "🧠",
    title: "단어 선택과 말의 흐름",
    body:
      "말을 하다가 자주 멈추거나 같은 표현을 반복하거나 단어를 찾는 시간이 길어지는 변화는 인지 기능 변화 연구에서 함께 살펴보는 특징입니다.",
    metrics: ["Silent Pause", "Filled Pause", "Speaking Rate"],
  },
  {
    id: "connections",
    icon: "🧭",
    title: "목소리 변화는 어떤 건강 변화와 관련이 있나요?",
    body:
      "MOA는 특정 질환을 판단하지 않고, 연구에서 알려진 음성 특징을 참고하여 목소리 변화의 경향을 살펴봅니다.",
    mappings: [
      {
        change: "목소리가 떨리거나 불안정함",
        research: "신경계 조절 변화 연구에서 참고",
      },
      {
        change: "말이 느려지고 리듬이 달라짐",
        research: "운동 기능 및 인지 변화 연구에서 참고",
      },
      {
        change: "말 사이 멈춤이 길어짐",
        research: "인지 부하 및 단어 탐색 변화 연구에서 참고",
      },
      {
        change: "발성이 짧아지고 숨이 자주 끊김",
        research: "호흡·발성 기능 변화 연구에서 참고",
      },
    ],
  },
];

export default function VoiceGuidePage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(SECTIONS[0].id);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={8}
        >
          <ChevronLeft size={26} color={G.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>목소리 건강 가이드</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* 면책 배너 */}
        <View style={styles.banner}>
          <Info size={18} color={G.amber} />
          <Text style={styles.bannerText}>
            MOA는 진단이 아닌 목소리 변화의 경향을 살펴보는 참고용 웰니스 서비스입니다.
          </Text>
        </View>

        {/* 섹션별 아코디언 */}
        <View style={styles.list}>
          {SECTIONS.map((s) => {
            const open = openId === s.id;
            return (
              <View key={s.id} style={styles.accordion}>
                <Pressable
                  style={styles.accordionHead}
                  onPress={() => setOpenId(open ? null : s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <Text style={styles.accordionIcon}>{s.icon}</Text>
                  <Text style={styles.accordionTitle}>{s.title}</Text>
                  {open ? (
                    <ChevronUp size={20} color={G.textSecondary} />
                  ) : (
                    <ChevronDown size={20} color={G.textSecondary} />
                  )}
                </Pressable>
                {open ? (
                  <View style={styles.accordionBody}>
                    <Text style={styles.accordionBodyText}>{s.body}</Text>
                    {s.metrics?.length ? (
                      <View style={styles.metricsBox}>
                        <Text style={styles.detailLabel}>참고 지표</Text>
                        <View style={styles.metricList}>
                          {s.metrics.map((metric) => (
                            <View key={metric} style={styles.metricRow}>
                              <View style={styles.metricDot} />
                              <Text style={styles.metricText}>{metric}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {s.mappings?.length ? (
                      <View style={styles.mappingList}>
                        {s.mappings.map((mapping) => (
                          <View key={mapping.change} style={styles.mappingRow}>
                            <Text style={styles.mappingChange}>{mapping.change}</Text>
                            <Text style={styles.mappingArrow}>→</Text>
                            <Text style={styles.mappingResearch}>{mapping.research}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* 출처 */}
        <Text style={styles.source}>
          참고: 음성 바이오마커 관련 연구 기반 일반 정보이며, 진단이나 치료 판단에는 사용할 수
          없습니다.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: G.bgPage },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Pretendard-ExtraBold",
    fontSize: 18,
    color: G.textPrimary,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 6, gap: 16 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: G.cardPeach,
    borderRadius: 14,
    padding: 14,
  },
  bannerText: {
    flex: 1,
    fontFamily: "Pretendard-Medium",
    fontSize: 15,
    lineHeight: 22,
    color: G.textPrimary,
  },

  list: { gap: 12 },
  accordion: {
    backgroundColor: G.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: G.border,
    overflow: "hidden",
  },
  accordionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  accordionIcon: { fontSize: 20 },
  accordionTitle: {
    flex: 1,
    fontFamily: "Pretendard-Bold",
    fontSize: 17,
    lineHeight: 24,
    color: G.textPrimary,
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 2,
  },
  accordionBodyText: {
    fontFamily: "Pretendard-Medium",
    fontSize: 16,
    lineHeight: 25,
    color: G.textSecondary,
  },

  metricsBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: G.cardPeach,
  },
  detailLabel: {
    fontFamily: "Pretendard-Bold",
    fontSize: 15,
    lineHeight: 21,
    color: G.textPrimary,
    marginBottom: 8,
  },
  metricList: { gap: 7 },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  metricDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: G.amber,
  },
  metricText: {
    flex: 1,
    fontFamily: "Pretendard-Medium",
    fontSize: 15,
    lineHeight: 22,
    color: G.textPrimary,
  },

  mappingList: {
    marginTop: 14,
    gap: 10,
  },
  mappingRow: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: G.cardPeach,
    borderLeftWidth: 4,
    borderLeftColor: G.amber,
  },
  mappingChange: {
    fontFamily: "Pretendard-Bold",
    fontSize: 15,
    lineHeight: 22,
    color: G.textPrimary,
  },
  mappingArrow: {
    fontFamily: "Pretendard-Bold",
    fontSize: 16,
    lineHeight: 21,
    color: G.amber,
    marginVertical: 2,
  },
  mappingResearch: {
    fontFamily: "Pretendard-Medium",
    fontSize: 15,
    lineHeight: 22,
    color: G.textSecondary,
  },

  source: {
    fontFamily: "Pretendard-Light",
    fontSize: 13,
    lineHeight: 20,
    color: G.textSecondary,
    textAlign: "center",
    paddingTop: 4,
  },
});

import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronDown, ChevronUp, Info } from "lucide-react-native";
import { colors } from "../../styles/tokens";

const G = colors.guardian;

// 음성 건강 가이드 — 리포트와 완전히 분리된 정적 정보 페이지.
// 일반적인 건강 정보만 제공하며 개인 진단/병명과 무관하다.
interface GuideSection {
  id: string;
  icon: string;
  title: string;
  body: string;
}

const SECTIONS: GuideSection[] = [
  {
    id: "rate",
    icon: "🗣️",
    title: "발화 속도란?",
    body:
      "발화 속도는 말을 할 때 단어와 문장이 이어지는 빠르기를 뜻해요. 사람마다 평소 속도가 다르기 때문에, 절대적인 빠르기보다 '평소 대비 변화'를 살펴보는 것이 의미가 있어요. 발화 속도의 변화는 인지 부하와 연관이 있다고 알려져 있어요.",
  },
  {
    id: "stability",
    icon: "🎵",
    title: "성대 진동 안정성 (Jitter / Shimmer)",
    body:
      "목소리는 성대가 규칙적으로 진동하면서 만들어져요. Jitter는 진동 주기의 미세한 흔들림, Shimmer는 소리 크기의 미세한 흔들림을 나타내는 일반적인 음성 지표예요. 이 값들은 컨디션이나 발성 습관에 따라 자연스럽게 달라질 수 있어요.",
  },
  {
    id: "breath",
    icon: "😮‍💨",
    title: "호흡 패턴",
    body:
      "말을 할 때는 숨을 들이쉬고 내쉬는 리듬이 함께 작동해요. 한 번에 이어 말하는 길이나 문장 사이 호흡의 규칙성은 사람마다 다르며, 평소와 비교했을 때의 흐름을 관찰하는 데 참고가 돼요.",
  },
  {
    id: "language",
    icon: "🧠",
    title: "언어 패턴 (휴지기 / 필러)",
    body:
      "휴지기는 말과 말 사이의 멈춤, 필러는 '음…', '그…' 같은 메우는 말을 뜻해요. 적절한 휴지기와 필러는 누구에게나 자연스럽게 나타나요. 단어를 찾는 시간이 평소보다 길어지는 흐름을 살펴보는 데 참고가 돼요.",
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
            본 내용은 일반적인 건강 정보이며 개인 진단에 활용할 수 없습니다
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
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* 출처 */}
        <Text style={styles.source}>참고: 관련 임상 연구 기반 일반 정보</Text>
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
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 16,
    color: G.textPrimary,
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 2,
  },
  accordionBodyText: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    lineHeight: 22,
    color: G.textSecondary,
  },

  source: {
    fontFamily: "Pretendard-Light",
    fontSize: 12,
    color: G.textSecondary,
    textAlign: "center",
    paddingTop: 4,
  },
});

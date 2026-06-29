import { View, Text, ScrollView, StyleSheet, useWindowDimensions, Modal, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/authStore";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryScatter,
  VictoryTheme,
  VictoryArea,
} from "victory-native";

// mock 데이터 — 실제 연동 시 API 응답으로 교체
const WEEK_DATA = [
  { day: "월", score: 68 },
  { day: "화", score: 72 },
  { day: "수", score: 58 },
  { day: "목", score: 75 },
  { day: "금", score: 45 },
  { day: "토", score: 80 },
  { day: "일", score: 78 },
];

const STATUS_BADGE = (score: number) => {
  if (score >= 70) return { label: "안정적", color: "#2ECC71", bg: "#edfaf3" };
  if (score >= 50) return { label: "주의 필요", color: "#E8943A", bg: "#fff5e6" };
  return { label: "변화 감지", color: "#E8943A", bg: "#fff5e6" };
};

const latestScore = WEEK_DATA[WEEK_DATA.length - 1].score;
const badge = STATUS_BADGE(latestScore);

export default function ReportPage() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chartWidth = width - 40;
  const myName = useAuthStore((s) => s.name) || "나";

  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  useEffect(() => {
    async function checkDisclaimer() {
      try {
        const consented = Platform.OS === "web" 
          ? globalThis.localStorage?.getItem("moa.disclaimer.consented")
          : await SecureStore.getItemAsync("moa.disclaimer.consented");
        if (consented !== "true") {
          setDisclaimerVisible(true);
        }
      } catch {
        setDisclaimerVisible(true);
      }
    }
    checkDisclaimer();
  }, []);

  const handleAgreeDisclaimer = async () => {
    try {
      if (Platform.OS === "web") {
        globalThis.localStorage?.setItem("moa.disclaimer.consented", "true");
      } else {
        await SecureStore.setItemAsync("moa.disclaimer.consented", "true");
      }
    } catch (err) {
      console.warn("면책 동의 저장 실패:", err);
    }
    setDisclaimerVisible(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* 1. [Compliance] 의료기기 규제 회피를 위한 비의료기기 면책 팝업 모달 */}
      <Modal
        visible={disclaimerVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📋 중요 안내 및 면책 조항</Text>
            
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>
                본 서비스(MOA)에서 제공하는 목소리 분석, 최근 위험도 및 변화 패턴 보고서는 직접사용자의 일상 건강 관리를 돕기 위한 <Text style={styles.boldText}>비진단 목적의 일상 웰니스 정보</Text>입니다.{"\n\n"}
                MOA는 식품의약품안전처 등이 공인한 <Text style={styles.boldText}>의료 기기가 아니며</Text>, 의학적 진단, 예방, 치료, 경감 또는 의사의 처방을 대체할 수 없습니다.{"\n\n"}
                분석된 변화 패턴은 통계적 분석에 기초한 참고 자료일 뿐이므로, 의학적 판단이나 증상 해석이 필요할 경우에는 반드시 전문 의료 기관 및 의사와 상담하시기 바랍니다.
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.modalBtn} onPress={handleAgreeDisclaimer}>
              <Text style={styles.modalBtnText}>내용을 확인했으며 동의합니다</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 변화 패턴 리포트</Text>
        <Text style={styles.headerSub}>{myName} 님 · 최근 7일</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >

        {/* 현재 상태 배지 */}
        <View style={[styles.badgeCard, { backgroundColor: badge.bg }]}>
          <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
          <Text style={[styles.badgeLabel, { color: badge.color }]}>{badge.label}</Text>
          <Text style={styles.badgeSub}>참고용 패턴 분석 결과입니다</Text>
        </View>

        {/* 차트 카드 */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>📈  7일 목소리 패턴 변화</Text>
          <VictoryChart
            width={chartWidth}
            height={220}
            theme={VictoryTheme.grayscale}
            padding={{ top: 16, bottom: 40, left: 40, right: 16 }}
            domainPadding={{ x: 16 }}
          >
            <VictoryAxis
              tickFormat={(t: string) => t}
              style={{
                tickLabels: { fontSize: 12, fill: "#b6aaa5" },
                axis: { stroke: "#f0e8e2" },
                grid: { stroke: "transparent" },
              }}
            />
            <VictoryAxis
              dependentAxis
              domain={[0, 100]}
              tickValues={[0, 25, 50, 75, 100]}
              tickFormat={(t: number) => `${t}`}
              style={{
                tickLabels: { fontSize: 11, fill: "#b6aaa5" },
                axis: { stroke: "transparent" },
                grid: { stroke: "#f5eeea", strokeDasharray: "4" },
              }}
            />
            <VictoryArea
              data={WEEK_DATA}
              x="day"
              y="score"
              style={{
                data: {
                  fill: "#FF7955",
                  fillOpacity: 0.08,
                  stroke: "transparent",
                },
              }}
              interpolation="catmullRom"
            />
            <VictoryLine
              data={WEEK_DATA}
              x="day"
              y="score"
              style={{
                data: { stroke: "#FF7955", strokeWidth: 2.5 },
              }}
              interpolation="catmullRom"
            />
            <VictoryScatter
              data={WEEK_DATA}
              x="day"
              y="score"
              size={4}
              style={{ data: { fill: "#FF7955", stroke: "white", strokeWidth: 2 } }}
            />
          </VictoryChart>
          <Text style={styles.chartDisclaimer}>
            * 이 그래프는 참고용 패턴이며 의학적 근거 자료가 아닙니다.
          </Text>
        </View>

        {/* 요일별 요약 */}
        <View style={styles.tableCard}>
          <Text style={styles.cardTitle}>일별 변화 요약</Text>
          {WEEK_DATA.map(({ day, score }) => {
            const b = STATUS_BADGE(score);
            return (
              <View key={day} style={styles.tableRow}>
                <Text style={styles.tableDay}>{day}요일</Text>
                <View style={styles.tableBar}>
                  <View
                    style={[
                      styles.tableBarFill,
                      { width: `${score}%`, backgroundColor: b.color },
                    ]}
                  />
                </View>
                <View style={[styles.tableBadge, { backgroundColor: b.bg }]}>
                  <Text style={[styles.tableBadgeText, { color: b.color }]}>{b.label}</Text>
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
  container: { flex: 1, backgroundColor: "#FFF9F2" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#342C28" },
  headerSub: { fontSize: 16, color: "#765E52" },
  scroll: { paddingHorizontal: 20, gap: 14 },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0e8e2",
  },
  badgeDot: { width: 10, height: 10, borderRadius: 5 },
  badgeLabel: { fontSize: 18, fontWeight: "700" },
  badgeSub: { flex: 1, fontSize: 13, color: "#765E52", textAlign: "right" },
  chartCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    alignItems: "flex-start",
    gap: 4,
  },
  chartTitle: { fontSize: 17, fontWeight: "700", color: "#40332D" },
  chartDisclaimer: { fontSize: 12, color: "#c4b5ae", paddingTop: 4 },
  tableCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#f0e8e2",
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#40332D", marginBottom: 4 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tableDay: { width: 42, fontSize: 15, color: "#5f4c45", fontWeight: "600" },
  tableBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#f0e8e2",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableBarFill: { height: 8, borderRadius: 4 },
  tableBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tableBadgeText: { fontSize: 12, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(52, 44, 40, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#342C28",
    textAlign: "center",
  },
  modalScroll: {
    maxHeight: 240,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#765E52",
  },
  boldText: {
    fontWeight: "800",
    color: "#FF7955",
  },
  modalBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "white",
  },
});

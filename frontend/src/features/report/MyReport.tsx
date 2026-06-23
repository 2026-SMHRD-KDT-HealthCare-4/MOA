import { View, Text, StyleSheet } from "react-native";

// "내 리포트" 칩 선택 시 표시되는 빈 화면 (추후 본인 음성 리포트로 구현 예정)
export function MyReport() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>📊</Text>
      <Text style={styles.title}>내 리포트는 준비 중이에요</Text>
      <Text style={styles.sub}>
        본인 음성 체크인 기록이 쌓이면{"\n"}이곳에서 변화 패턴을 확인할 수 있어요
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  icon: { fontSize: 48 },
  title: {
    fontFamily: "Pretendard-Bold",
    fontSize: 18,
    color: "#3B2318",
  },
  sub: {
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
    lineHeight: 22,
    color: "#765E52",
    textAlign: "center",
  },
});

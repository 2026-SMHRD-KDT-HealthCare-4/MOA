import { Stack } from "expo-router";

// 가족 탭 내부 스택: 허브(index) → 부모 상세 리포트([elderlyId]) drill-down.
// 상세로 들어가도 하단 보호자 탭바는 유지된다.
export default function FamilyStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[elderlyId]" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

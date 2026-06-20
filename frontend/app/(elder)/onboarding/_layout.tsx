import { Stack } from "expo-router";

// 직접사용자 온보딩(생년월일→성별→가족력)은 탭 밖 풀스크린 Stack 으로 처리한다.
export default function ElderOnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}

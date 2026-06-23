import { useEffect } from "react";
import { Tabs, useRouter, useSegments } from "expo-router";
import { ElderBottomNav } from "../../src/components/layout/BottomNav";
import { useAuthStore } from "../../src/stores/authStore";

export default function ElderLayout() {
  const router = useRouter();
  const segments = useSegments();
  const role = useAuthStore((s) => s.role);
  const onboardingDone = useAuthStore((s) => s.onboardingDone);

  // 온보딩 경로 자체에서는 게이트를 적용하지 않는다(리다이렉트 루프 방지).
  const inOnboarding = segments.includes("onboarding");

  // 직접사용자가 온보딩을 끝내지 않았으면 온보딩(가족력) 화면으로 보낸다.
  // 생년월일·성별은 초대코드 클레임 화면에서 받으므로 가족력이 온보딩의 유일한 단계다.
  useEffect(() => {
    if (role === "elder" && !onboardingDone && !inOnboarding) {
      router.replace("/(elder)/onboarding/family-history");
    }
  }, [role, onboardingDone, inOnboarding, router]);

  return (
    <Tabs
      tabBar={(props) => <ElderBottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: "홈" }} />
      <Tabs.Screen name="record"   options={{ title: "기록" }} />
      <Tabs.Screen name="history"  options={{ title: "히스토리" }} />
      <Tabs.Screen name="settings" options={{ title: "설정" }} />
      {/* 온보딩은 탭 밖 풀스크린 — 탭 항목으로 노출하지 않는다(href: null). */}
      <Tabs.Screen name="onboarding" options={{ href: null }} />
    </Tabs>
  );
}

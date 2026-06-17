import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../src/stores/authStore";

// 인증/역할 라우트 가드.
// 로그인 상태·역할을 보고 (auth)/(elder)/(guardian) 영역으로 정리한다.
// - 비로그인: 보호 영역((elder)/(guardian)/onboarding) 접근 시 역할 선택으로.
// - 직접사용자: (guardian) 접근 차단.
// - 보호자: (elder) 접근 차단. 온보딩은 보호자 전용.
function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    if (!hydrated) return; // 세션 복원 전에는 분기하지 않음(깜빡임 방지)

    const root = segments[0]; // undefined(인트로) | "(auth)" | "(elder)" | "(guardian)" | "onboarding" | "chat" | "done"
    const inElder = root === "(elder)";
    const inGuardian = root === "(guardian)";
    const inOnboarding = root === "onboarding";
    const inProtected = inElder || inGuardian || inOnboarding;

    if (!isLoggedIn) {
      // 보호 영역에 들어와 있으면 역할 선택으로 돌려보낸다. 인트로/(auth)는 통과.
      if (inProtected) router.replace("/(auth)/role-select");
      return;
    }

    // 교차 역할 접근 차단. ((auth)→홈 자동 이동은 각 화면이 직접 처리 — race 방지)
    if (role === "elder" && (inGuardian || inOnboarding)) {
      router.replace("/(elder)/");
    } else if (role === "guardian" && inElder) {
      router.replace("/(guardian)/");
    }
  }, [hydrated, isLoggedIn, role, segments, router]);
}

export default function RootLayout() {
  // 앱 시작 시 저장된 토큰으로 세션 복원 → 가드가 분기.
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useAuthGuard();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index"      options={{ animation: "none" }} />
        <Stack.Screen name="(auth)"     options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="(elder)" />
        <Stack.Screen name="(guardian)" />
        <Stack.Screen name="onboarding" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="chat" />
        <Stack.Screen name="done" />
      </Stack>
    </SafeAreaProvider>
  );
}

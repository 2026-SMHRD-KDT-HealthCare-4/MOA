import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "../src/stores/authStore";
import { GlobalWakeWordListener } from "../src/components/GlobalWakeWordListener";
import { useMedicationStore } from "../src/stores/medicationStore";

// 인증/역할 라우트 가드.
// 로그인 상태·역할을 보고 (auth)/(elder)/(guardian) 영역으로 정리한다.
// - 비로그인: 보호 영역((elder)/(guardian)/onboarding) 접근 시 역할 선택으로.
// - 직접사용자: (guardian) 접근 차단. 동의 미완료면 동의/클레임 흐름으로.
// - 보호자: (elder) 접근 차단. 온보딩은 보호자 전용.
function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const role = useAuthStore((s) => s.role);
  const consentDone = useAuthStore((s) => s.consentDone);
  const hasGuardianTab = useAuthStore((s) => s.hasGuardianTab);

  useEffect(() => {
    if (!hydrated) return; // 세션 복원 전에는 분기하지 않음(깜빡임 방지)

    const root = segments[0]; // undefined(인트로) | "(auth)" | "(elder)" | "(guardian)" | "onboarding" | "chat" | "done"
    const inAuth = root === "(auth)";
    const inElder = root === "(elder)";
    const inGuardian = root === "(guardian)";
    const inOnboarding = root === "onboarding";
    const inHome = root === "home";
    const inProtected = inElder || inGuardian || inOnboarding || inHome;

    if (!isLoggedIn) {
      // 보호 영역에 들어와 있으면 역할 선택으로 돌려보낸다. 인트로/(auth)는 통과.
      if (inProtected) router.replace("/(auth)/role-select");
      return;
    }

    // 직접사용자 동의 미완료 → 동의/클레임 흐름으로. ((auth) 안에서는 통과시켜 흐름 진행)
    if (role === "elder" && !consentDone && !inAuth) {
      router.replace("/(auth)/elder-consent");
      return;
    }

    // 교차 역할 접근 차단. ((auth)→홈 자동 이동은 각 화면이 직접 처리 — race 방지)
    if (role === "elder" && (inGuardian || inOnboarding)) {
      router.replace("/(elder)/");
    } else if (role === "guardian" && inElder) {
      router.replace(hasGuardianTab ? "/(guardian)/family" : "/(guardian)/");
    }
  }, [hydrated, isLoggedIn, role, consentDone, hasGuardianTab, segments, router]);
}

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Jua: require("../assets/fonts/BMJUA.ttf"),
    "Pretendard-Light": require("../assets/fonts/Pretendard-Light.ttf"),
    "Pretendard-Medium": require("../assets/fonts/Pretendard-Medium.ttf"),
    "Pretendard-Bold": require("../assets/fonts/Pretendard-Bold.ttf"),
    "Pretendard-ExtraBold": require("../assets/fonts/Pretendard-ExtraBold.ttf"),
  });
  // 앱 시작 시 저장된 토큰으로 세션 복원 → 가드가 분기.
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      const reminderId = typeof data.medicationReminderId === "string" ? data.medicationReminderId : null;
      const localMedicationId = typeof data.localMedicationId === "string" ? data.localMedicationId : null;
      const prompt = typeof data.medicationPrompt === "string" ? data.medicationPrompt : undefined;
      if (!reminderId && !localMedicationId) return;
      if (localMedicationId && data.isRetry !== true) useMedicationStore.getState().markPending(localMedicationId);

      router.push({
        pathname: "/(elder)",
        params: { medicationReminderId: reminderId ?? undefined, localMedicationId: localMedicationId ?? undefined, medicationPrompt: prompt },
      });
    });
    return () => subscription.remove();
  }, [router]);

  useAuthGuard();

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <GlobalWakeWordListener />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index"      options={{ animation: "none" }} />
        <Stack.Screen name="(auth)"     options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="(elder)" />
        <Stack.Screen name="(guardian)" />
        <Stack.Screen name="onboarding" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="home" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="done" />
      </Stack>
    </SafeAreaProvider>
  );
}

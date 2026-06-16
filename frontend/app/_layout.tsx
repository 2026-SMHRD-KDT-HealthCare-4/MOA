import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../src/stores/authStore";

export default function RootLayout() {
  // 앱 시작 시 저장된 토큰으로 세션 복원 (mock: 기본 어른 세션 유지 → 관문 없이 진입).
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

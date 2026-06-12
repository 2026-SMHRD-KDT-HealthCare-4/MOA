import "../global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index"      options={{ animation: "none" }} />
        <Stack.Screen name="(auth)"     options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="(elder)" />
        <Stack.Screen name="(guardian)" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="done" />
      </Stack>
    </SafeAreaProvider>
  );
}

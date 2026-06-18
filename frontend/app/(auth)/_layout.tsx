import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="role-select" />
      <Stack.Screen name="login" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="register" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="guardian-invite" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="elder-consent" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="elder-claim" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}

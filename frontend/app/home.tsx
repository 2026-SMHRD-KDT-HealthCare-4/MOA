import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../src/stores/authStore";

export default function HomeRedirect() {
  const { fromIntro } = useLocalSearchParams<{ fromIntro?: string }>();
  const role = useAuthStore((s) => s.role);
  const pathname = role === "guardian" ? "/(guardian)" : "/(elder)";

  return <Redirect href={{ pathname, params: { fromIntro } }} />;
}

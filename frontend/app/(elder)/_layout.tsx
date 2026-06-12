import { Tabs } from "expo-router";
import { ElderBottomNav } from "../../src/components/layout/BottomNav";

export default function ElderLayout() {
  return (
    <Tabs
      tabBar={(props) => <ElderBottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: "홈" }} />
      <Tabs.Screen name="record"   options={{ title: "기록" }} />
      <Tabs.Screen name="history"  options={{ title: "히스토리" }} />
      <Tabs.Screen name="settings" options={{ title: "설정" }} />
    </Tabs>
  );
}

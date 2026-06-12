import { Tabs } from "expo-router";
import { GuardianBottomNav } from "../../src/components/layout/BottomNav";

export default function GuardianLayout() {
  return (
    <Tabs
      tabBar={(props) => <GuardianBottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: "대시보드" }} />
      <Tabs.Screen name="family"   options={{ title: "가족" }} />
      <Tabs.Screen name="report"   options={{ title: "리포트" }} />
      <Tabs.Screen name="settings" options={{ title: "설정" }} />
    </Tabs>
  );
}

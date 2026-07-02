import { Tabs } from "expo-router";
import { GuardianBottomNav } from "../../src/components/layout/BottomNav";

export default function GuardianLayout() {
  return (
    <Tabs
      tabBar={(props) => <GuardianBottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "홈" }} />
      <Tabs.Screen name="family" options={{ title: "가족" }} />
      <Tabs.Screen name="report" options={{ title: "리포트" }} />
      <Tabs.Screen name="settings" options={{ title: "설정" }} />
      {/* 자기 음성 체크인 — 탭바엔 노출하지 않고 챗봇 메인에서 진입 */}
      <Tabs.Screen name="record" options={{ title: "기록" }} />
      {/* 음성 건강 가이드 — 탭바엔 노출하지 않고 리포트에서 진입 */}
      <Tabs.Screen name="report-guide" options={{ title: "음성 건강 가이드" }} />
      {/* 근처 전문의 찾기 — 탭바엔 노출하지 않고 리포트에서 진입 */}
      <Tabs.Screen name="nearby-hospitals" options={{ title: "근처 전문의 찾기" }} />
      {/* PDF 공유 — 탭바엔 노출하지 않고 리포트 PDF 내보내기 후 진입 */}
      <Tabs.Screen name="report-share" options={{ title: "PDF 공유" }} />
    </Tabs>
  );
}

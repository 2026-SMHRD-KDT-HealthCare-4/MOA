import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { type ComponentProps } from "react";
import type { Tabs } from "expo-router";
import {
  Home, CalendarDays, Settings,
  LayoutDashboard, Users, FileText,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";

type BottomTabBarProps = NonNullable<ComponentProps<typeof Tabs>["tabBar"]> extends (props: infer P) => unknown ? P : never;

interface TabConfig {
  name: string;
  icon: LucideIcon;
  label: string;
}

// ── 탭 설정 ────────────────────────────────────────────────
const ELDER_TABS: TabConfig[] = [
  { name: "index",    icon: Home,         label: "홈" },
  { name: "history",  icon: CalendarDays, label: "기록" },
  { name: "settings", icon: Settings,     label: "설정" },
];

const GUARDIAN_TABS: TabConfig[] = [
  { name: "index",    icon: LayoutDashboard, label: "대시보드" },
  { name: "family",   icon: Users,           label: "가족" },
  { name: "report",   icon: FileText,        label: "리포트" },
  { name: "settings", icon: Settings,        label: "설정" },
];

// ── 공통 베이스 ────────────────────────────────────────────
function BottomNavBase({ state, navigation, tabs }: BottomTabBarProps & { tabs: TabConfig[] }) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 7) }]}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeRouteName === tab.name;

        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => navigation.navigate(tab.name)}
            accessibilityLabel={tab.label}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Icon size={27} color={isActive ? "#FF7657" : "#6D5A51"} fill={isActive ? "#FF7657" : "transparent"} />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── 역할별 export ──────────────────────────────────────────
export function ElderBottomNav(props: BottomTabBarProps) {
  return <BottomNavBase {...props} tabs={ELDER_TABS} />;
}

export function GuardianBottomNav(props: BottomTabBarProps) {
  return <BottomNavBase {...props} tabs={GUARDIAN_TABS} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    minHeight: 90,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(117,76,42,0.08)",
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingTop: 12,
    paddingHorizontal: 18,
    boxShadow: "0 -10px 26px rgba(75, 52, 42, 0.08)",
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 24,
    paddingVertical: 4,
  },
  tabActive: { backgroundColor: "rgba(255,118,87,0.10)" },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: "#6D5A51" },
  labelActive: { color: "#FF7657" },
});

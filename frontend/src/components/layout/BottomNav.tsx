import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { type ComponentProps } from "react";
import type { Tabs } from "expo-router";
import { CalendarDays, FileText, Home, Settings, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";

type BottomTabBarProps = NonNullable<ComponentProps<typeof Tabs>["tabBar"]> extends (
  props: infer P
) => unknown
  ? P
  : never;

interface TabConfig {
  name: string;
  icon: LucideIcon;
  label: string;
}

const ELDER_TABS: TabConfig[] = [
  { name: "index", icon: Home, label: "홈" },
  { name: "history", icon: CalendarDays, label: "기록" },
  { name: "settings", icon: Settings, label: "설정" },
];

const GUARDIAN_TABS: TabConfig[] = [
  { name: "index", icon: Home, label: "홈" },
  { name: "family", icon: Users, label: "가족" },
  { name: "report", icon: FileText, label: "리포트" },
  { name: "settings", icon: Settings, label: "설정" },
];

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
            activeOpacity={0.72}
          >
            <Icon
              size={26}
              color={isActive ? "#0F766E" : "#64748B"}
              fill={isActive ? "#0F766E" : "transparent"}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

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
    borderColor: "rgba(15,35,66,0.08)",
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingTop: 12,
    paddingHorizontal: 14,
    boxShadow: "0 -12px 30px rgba(15, 35, 66, 0.10)",
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
  tabActive: {
    backgroundColor: "rgba(15,118,110,0.10)",
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#64748B",
  },
  labelActive: {
    color: "#0F766E",
  },
});

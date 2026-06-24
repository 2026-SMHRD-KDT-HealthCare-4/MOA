import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { type ComponentProps } from "react";
import { type Tabs } from "expo-router";
import { CalendarDays, FileText, Home, Pill, Settings, Users } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";
import { useAuthStore } from "../../stores/authStore";

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

interface NavTheme {
  iconSize: number;
  labelSize: number;
  labelLineHeight: number;
  activeColor: string;
  inactiveColor: string;
  activeBg: string;
  containerBorder: string;
  containerBg: string;
  areaColors: [string, string, string];
  areaTopPadding: number;
  shadow: string;
  safeBackground?: string;
}

const ELDER_THEME: NavTheme = {
  iconSize: 30,
  labelSize: 19,
  labelLineHeight: 24,
  activeColor: "#173F73",
  inactiveColor: "#6D5A51",
  activeBg: "rgba(23,63,115,0.10)",
  containerBorder: "rgba(94,65,40,0.12)",
  containerBg: "rgba(255,249,241,0.92)",
  // Match the home-screen fade end color so the video background flows into the tab area.
  areaColors: ["#F7D6AC", "#F7D6AC", "#F7D6AC"],
  areaTopPadding: 0,
  shadow: "0 -12px 30px rgba(75, 52, 42, 0.08)",
};

const GUARDIAN_THEME: NavTheme = {
  iconSize: 26,
  labelSize: 15,
  labelLineHeight: 20,
  activeColor: "#173F73",
  inactiveColor: "#9B8A7D",
  activeBg: "rgba(23,63,115,0.10)",
  containerBorder: "rgba(94,65,40,0.12)",
  containerBg: "rgba(255,249,241,0.92)",
  areaColors: ["#F6E3C2", "#F6E3C2", "#F6E3C2"],
  areaTopPadding: 12,
  shadow: "0 -8px 20px rgba(53,90,138,0.08)",
  safeBackground: "#F6E3C2",
};

const ELDER_TABS: TabConfig[] = [
  { name: "index", icon: Home, label: "홈" },
  { name: "history", icon: CalendarDays, label: "기록" },
  { name: "health", icon: Pill, label: "복약/병원" },
  { name: "settings", icon: Settings, label: "설정" },
];

const GUARDIAN_TABS: TabConfig[] = [
  { name: "index", icon: Home, label: "홈" },
  { name: "family", icon: Users, label: "가족" },
  { name: "report", icon: FileText, label: "리포트" },
  { name: "settings", icon: Settings, label: "설정" },
];

function BottomNavBase({
  state,
  navigation,
  tabs,
  theme,
}: BottomTabBarProps & { tabs: TabConfig[]; theme: NavTheme }) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;

  // 온보딩 등 풀스크린 흐름에서는 탭바를 숨긴다.
  if (activeRouteName === "onboarding") return null;

  return (
    <LinearGradient
      colors={theme.areaColors}
      locations={[0, 0.42, 1]}
      style={[
        styles.area,
        {
          paddingTop: theme.areaTopPadding,
          paddingBottom: Math.max(insets.bottom, 0),
        },
      ]}
    >
      {theme.safeBackground && <View style={[styles.bottomSafeBg, { backgroundColor: theme.safeBackground }]} />}
      <View
        style={[
          styles.container,
          {
            borderColor: theme.containerBorder,
            backgroundColor: theme.containerBg,
            boxShadow: theme.shadow,
          },
        ]}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeRouteName === tab.name;
          const isHomeTab = tab.name === "index";
          const activeColor = theme.activeColor;
          const activeBg = theme.activeBg;

          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, isActive && { backgroundColor: activeBg }]}
              onPress={() => navigation.navigate(tab.name)}
              accessibilityLabel={tab.label}
              accessibilityRole="button"
              activeOpacity={0.72}
            >
              <Icon
                size={theme.iconSize}
                color={isActive ? activeColor : theme.inactiveColor}
                fill={isActive ? activeColor : "transparent"}
              />
              <Text
                style={[
                  styles.label,
                  {
                    fontSize: theme.labelSize,
                    lineHeight: theme.labelLineHeight,
                    color: theme.inactiveColor,
                  },
                  isActive && { color: activeColor },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </LinearGradient>
  );
}

export function ElderBottomNav(props: BottomTabBarProps) {
  return <BottomNavBase {...props} tabs={ELDER_TABS} theme={ELDER_THEME} />;
}

export function GuardianBottomNav(props: BottomTabBarProps) {
  const hasGuardianTab = useAuthStore((s) => s.hasGuardianTab);
  const tabs = hasGuardianTab ? GUARDIAN_TABS : GUARDIAN_TABS.filter((tab) => tab.name !== "family");
  return <BottomNavBase {...props} tabs={tabs} theme={GUARDIAN_THEME} />;
}

const styles = StyleSheet.create({
  area: {
    position: "relative",
    overflow: "visible",
    zIndex: 20,
    elevation: 20,
  },
  bottomSafeBg: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  container: {
    position: "relative",
    flexDirection: "row",
    minHeight: 100,
    marginHorizontal: 19,
    marginBottom: 7,
    borderRadius: 34,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    elevation: 8,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 22,
    paddingVertical: 5,
    marginHorizontal: 1,
  },
  label: {
    fontFamily: "Pretendard-Bold",
    fontWeight: "800",
  },
});

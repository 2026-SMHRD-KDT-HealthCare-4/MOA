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

// ── 역할별 네비 테마 ───────────────────────────────────────
// 직접사용자: 따뜻한 코랄 + 큰 글씨(친근·심플). 보호자: 네이비/틸 스마트 톤(삼성헬스풍).
// 두 화면이 BottomNavBase를 공유하므로, 톤이 섞이지 않도록 테마로 분리한다.
interface NavTheme {
  iconSize: number;
  labelSize: number;
  labelLineHeight: number;
  activeColor: string;
  inactiveColor: string;
  activeBg: string;
  containerBorder: string;
  containerBg: string;
  shadow: string;
}

// 직접사용자 화면 라벨은 규칙상 최소 18pt 유지.
const ELDER_THEME: NavTheme = {
  iconSize: 27,
  labelSize: 18,
  labelLineHeight: 23,
  activeColor: "#FF7657",
  inactiveColor: "#6D5A51",
  activeBg: "rgba(255,118,87,0.10)",
  containerBorder: "rgba(117,76,42,0.08)",
  containerBg: "rgba(255,255,255,0.92)",
  shadow: "0 -10px 26px rgba(75, 52, 42, 0.08)",
};

// 보호자: 따뜻한 화이트 배경 + 비활성 textSecondary + 활성 amber (tokens.guardian과 동일 톤).
const GUARDIAN_THEME: NavTheme = {
  iconSize: 26,
  labelSize: 15,
  labelLineHeight: 20,
  activeColor: "#E8943A",
  inactiveColor: "#8A8A86",
  activeBg: "rgba(232,148,58,0.14)",
  containerBorder: "rgba(74,74,72,0.08)",
  containerBg: "rgba(252,248,243,0.98)",
  shadow: "0 -12px 30px rgba(74, 74, 72, 0.08)",
};

// ── 탭 설정 ────────────────────────────────────────────────
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

// ── 공통 베이스 ────────────────────────────────────────────
function BottomNavBase({
  state,
  navigation,
  tabs,
  theme,
}: BottomTabBarProps & { tabs: TabConfig[]; theme: NavTheme }) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 7),
          borderColor: theme.containerBorder,
          backgroundColor: theme.containerBg,
          boxShadow: theme.shadow,
        },
      ]}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeRouteName === tab.name;

        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tab, isActive && { backgroundColor: theme.activeBg }]}
            onPress={() => navigation.navigate(tab.name)}
            accessibilityLabel={tab.label}
            accessibilityRole="button"
            activeOpacity={0.72}
          >
            <Icon
              size={theme.iconSize}
              color={isActive ? theme.activeColor : theme.inactiveColor}
              fill={isActive ? theme.activeColor : "transparent"}
            />
            <Text
              style={[
                styles.label,
                { fontSize: theme.labelSize, lineHeight: theme.labelLineHeight, color: theme.inactiveColor },
                isActive && { color: theme.activeColor },
              ]}
            >
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
  return <BottomNavBase {...props} tabs={ELDER_TABS} theme={ELDER_THEME} />;
}

export function GuardianBottomNav(props: BottomTabBarProps) {
  return <BottomNavBase {...props} tabs={GUARDIAN_TABS} theme={GUARDIAN_THEME} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    minHeight: 90,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 32,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 14,
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
  label: {
    fontWeight: "800",
  },
});

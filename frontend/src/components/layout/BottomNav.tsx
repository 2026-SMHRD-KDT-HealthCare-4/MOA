import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { type ComponentProps } from "react";
import { useRouter, type Tabs } from "expo-router";
import { CalendarDays, FileText, Home, MessageCircle, Settings, Users } from "lucide-react-native";
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
}

const ELDER_THEME: NavTheme = {
  iconSize: 30,
  labelSize: 19,
  labelLineHeight: 24,
  activeColor: "#FF7657",
  inactiveColor: "#6D5A51",
  activeBg: "rgba(255,118,87,0.11)",
  containerBorder: "rgba(117,76,42,0.08)",
  containerBg: "rgba(255,255,255,0.88)",
  areaColors: ["#FFF0DD", "#F8D3AA", "#FFF0DD"],
  areaTopPadding: 0,
  shadow: "0 -12px 30px rgba(75, 52, 42, 0.08)",
};

const GUARDIAN_THEME: NavTheme = {
  iconSize: 26,
  labelSize: 15,
  labelLineHeight: 20,
  activeColor: "#E8943A",
  inactiveColor: "#8A8A86",
  activeBg: "rgba(232,148,58,0.14)",
  containerBorder: "rgba(74,74,72,0.08)",
  containerBg: "rgba(252,248,243,0.98)",
  areaColors: ["rgba(252,248,243,0)", "#FCF8F3", "#F4EEE7"],
  areaTopPadding: 12,
  shadow: "0 -12px 30px rgba(74, 74, 72, 0.08)",
};

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

function BottomNavBase({
  state,
  navigation,
  tabs,
  theme,
}: BottomTabBarProps & { tabs: TabConfig[]; theme: NavTheme }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeRouteName = state.routes[state.index]?.name;
  const isElderTabs = tabs === ELDER_TABS;

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
                  {
                    fontSize: theme.labelSize,
                    lineHeight: theme.labelLineHeight,
                    color: theme.inactiveColor,
                  },
                  isActive && { color: theme.activeColor },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isElderTabs && (
        <TouchableOpacity
          style={styles.floatingChat}
          onPress={() => router.push("/chat")}
          accessibilityLabel="모아와 대화하기"
          accessibilityRole="button"
          activeOpacity={0.78}
        >
          <View style={styles.floatingChatHighlight} />
          <MessageCircle size={31} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      )}
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
  },
  container: {
    flexDirection: "row",
    minHeight: 100,
    marginHorizontal: 19,
    marginBottom: 7,
    borderRadius: 34,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 17,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 22,
    paddingVertical: 5,
    marginHorizontal: 2,
  },
  label: {
    fontWeight: "800",
  },
  floatingChat: {
    position: "absolute",
    right: 15,
    top: -28,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#6FA163",
    borderWidth: 6,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 20,
    boxShadow: "0 10px 20px rgba(72, 106, 63, 0.22)",
    elevation: 12,
  },
  floatingChatHighlight: {
    position: "absolute",
    top: 6,
    left: 10,
    right: 10,
    height: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});

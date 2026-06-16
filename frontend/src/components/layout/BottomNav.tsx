import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { type ComponentProps } from "react";
import { useRouter, type Tabs } from "expo-router";
import { CalendarDays, FileText, Home, MessageCircle, Settings, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
// 어르신: 따뜻한 코랄 + 큰 글씨(친근·심플). 보호자: 네이비/틸 스마트 톤(삼성헬스풍).
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
  areaColors: [string, string, string];
  areaTopPadding: number;
  shadow: string;
}

// 어르신 화면 라벨은 규칙상 최소 18pt 유지.
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
  activeColor: "#0F766E",
  inactiveColor: "#64748B",
  activeBg: "rgba(15,118,110,0.10)",
  containerBorder: "rgba(15,35,66,0.08)",
  containerBg: "rgba(255,255,255,0.94)",
  areaColors: ["rgba(248,250,252,0.0)", "#F8FAFC", "#EEF6F8"],
  areaTopPadding: 16,
  shadow: "0 -12px 30px rgba(15, 35, 66, 0.10)",
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

// ── 역할별 export ──────────────────────────────────────────
export function ElderBottomNav(props: BottomTabBarProps) {
  return <BottomNavBase {...props} tabs={ELDER_TABS} theme={ELDER_THEME} />;
}

export function GuardianBottomNav(props: BottomTabBarProps) {
  return <BottomNavBase {...props} tabs={GUARDIAN_TABS} theme={GUARDIAN_THEME} />;
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

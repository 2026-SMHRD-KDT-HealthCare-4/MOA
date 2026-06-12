import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  Home, CalendarDays, Clock, Settings,
  LayoutDashboard, Users, FileText,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LucideIcon } from "lucide-react-native";

interface TabConfig {
  name: string;
  icon: LucideIcon;
  label: string;
}

// ── 탭 설정 ────────────────────────────────────────────────
const ELDER_TABS: TabConfig[] = [
  { name: "index",    icon: Home,         label: "홈" },
  { name: "record",   icon: CalendarDays, label: "기록" },
  { name: "history",  icon: Clock,        label: "히스토리" },
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

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 7) }]}>
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = state.index === index;

        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => navigation.navigate(tab.name)}
            accessibilityLabel={tab.label}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Icon size={20} color={isActive ? "#FF706D" : "#b6aaa5"} />
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
    height: 70,
    borderTopWidth: 1,
    borderTopColor: "#eee5e0",
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingTop: 8,
    paddingHorizontal: 10,
    shadowColor: "#4b342a",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 13,
    paddingVertical: 4,
  },
  tabActive: { backgroundColor: "#fff1ee" },
  label: { fontSize: 12, fontWeight: "600", color: "#b6aaa5" },
  labelActive: { color: "#FF706D" },
});

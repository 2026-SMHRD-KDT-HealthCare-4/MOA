import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ArrowLeft, Menu, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TopBarProps {
  back?: boolean;
  onBack?: () => void;
}

export function TopBar({ back = false, onBack }: TopBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={back ? onBack : undefined}
        accessibilityLabel={back ? "뒤로 가기" : "메뉴"}
        activeOpacity={0.7}
      >
        {back
          ? <ArrowLeft size={21} color="#756a66" />
          : <Menu size={21} color="#756a66" />}
      </TouchableOpacity>

      <Text style={styles.title}>모아</Text>

      <TouchableOpacity style={styles.iconButton} accessibilityLabel="설정" activeOpacity={0.7}>
        <Settings size={20} color="#756a66" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  title: {
    color: "#4d403b",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  // 터치 타깃 56px (CLAUDE.md 절대 규칙)
  iconButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
});

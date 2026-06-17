import { View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet, Alert } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/authStore";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Bell, LogOut, Info, ChevronRight } from "lucide-react-native";
import * as Notifications from "expo-notifications";

export default function SettingsPage() {
  const insets = useSafeAreaInsets();
  const { role, logout } = useAuthStore();
  const router = useRouter();
  const [notifEnabled, setNotifEnabled] = useState(false);

  async function handleNotifToggle(next: boolean) {
    if (next) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "알림 권한 필요",
          "기기 설정에서 알림을 허용해 주세요.",
          [{ text: "확인", style: "default" }]
        );
        return;
      }
    }
    setNotifEnabled(next);
  }

  function handleLogout() {
    Alert.alert("로그아웃", "정말 로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/");
        },
      },
    ]);
  }

  const isElder = role === "elder";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#F7D6AC", "#FFF2DE", "#FFF0DD"]} style={StyleSheet.absoluteFill} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >

        {/* 알림 설정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Bell size={18} color="#FF7955" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>
                    {isElder ? "건강 기록 알림" : "직접사용자 상태 알림"}
                  </Text>
                  <Text style={styles.rowSub}>
                    {isElder
                      ? "매일 오전 기록을 도와드려요"
                      : "직접사용자 변화가 감지되면 알려드려요"}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={handleNotifToggle}
                trackColor={{ false: "#e8ddd9", true: "#FF7955" }}
                thumbColor="white"
              />
            </View>
          </View>
        </View>

        {/* 앱 정보 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 정보</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Info size={18} color="#8b7871" />
                </View>
                <Text style={styles.rowTitle}>버전</Text>
              </View>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Info size={18} color="#8b7871" />
                </View>
                <Text style={styles.rowTitle}>개인정보 처리방침</Text>
              </View>
              <ChevronRight size={18} color="#c4b5ae" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 계정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <View style={styles.roleDot} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>현재 역할</Text>
                  <Text style={styles.rowSub}>{isElder ? "직접사용자" : "보호자"}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 로그아웃 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <LogOut size={20} color="#E8943A" />
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
  },
  headerTitle: { fontSize: 31, lineHeight: 38, fontWeight: "900", color: "#3B2318" },
  scroll: { paddingHorizontal: 20, gap: 8 },
  section: { gap: 9 },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: "#80675C",
    paddingLeft: 4,
    marginTop: 10,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 20,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(117,76,42,0.08)",
    shadowColor: "#7C513B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,118,87,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 17, fontWeight: "800", color: "#342C28" },
  rowSub: { fontSize: 13, color: "#765E52", marginTop: 2, fontWeight: "600" },
  rowValue: { fontSize: 16, color: "#8B7871", fontWeight: "700" },
  divider: { height: 1, backgroundColor: "rgba(117,76,42,0.08)", marginHorizontal: 16 },
  roleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF7955" },
  logoutBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,118,87,0.34)",
    backgroundColor: "rgba(255,255,255,0.74)",
  },
  logoutText: { fontSize: 18, fontWeight: "800", color: "#C7753D" },
});

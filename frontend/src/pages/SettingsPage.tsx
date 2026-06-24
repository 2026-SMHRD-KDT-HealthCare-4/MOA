import { View, Text, Switch, ScrollView, StyleSheet, Alert, Platform, Pressable, Modal, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../stores/authStore";
import { useRouter } from "expo-router";
import { Bell, LogOut, Info, ChevronRight, ShieldCheck, UserRound, Mail } from "lucide-react-native";
import * as Notifications from "expo-notifications";
import { colors } from "../styles/tokens";

export default function SettingsPage() {
  const insets = useSafeAreaInsets();
  const { user, role, logout } = useAuthStore();
  const router = useRouter();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

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

  async function performLogout() {
    await logout();
    router.replace("/(auth)/role-select");
  }

  function handleLogout() {
    // 직접사용자(고령층)는 재로그인이 어려우므로(랜덤 credential) 바텀시트 모달로 더 신중히 확인한다.
    // (Alert 와 달리 RN Web 에서도 동작하므로 플랫폼 분기 없이 모달 하나로 처리)
    if (isElder) {
      setLogoutModalVisible(true);
      return;
    }

    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.("정말 로그아웃 하시겠어요?") ?? true;
      if (confirmed) void performLogout();
      return;
    }

    Alert.alert("로그아웃", "정말 로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  }

  function confirmElderLogout() {
    setLogoutModalVisible(false);
    void performLogout();
  }

  const isElder = role === "elder";
  const accountName = user?.name || "사용자";
  const accountEmail = user?.email || "이메일 정보 없음";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 — 가족/리포트 탭과 동일 구조 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
        <Text style={styles.headerSub}>서비스 환경을 관리해요</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* 계정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <UserRound size={22} color={C.blue} strokeWidth={2.2} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.accountName}>{accountName}</Text>
                  <Text style={styles.rowSub}>로그인된 계정</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Mail size={22} color={C.blue} strokeWidth={2.2} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>이메일</Text>
                  <Text style={styles.accountEmail}>{accountEmail}</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <UserRound size={22} color={C.blue} strokeWidth={2.2} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>현재 역할</Text>
                  <Text style={styles.roleValue}>{isElder ? "본인" : "보호자"}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 알림 설정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림</Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <Bell size={22} color={C.blue} strokeWidth={2.2} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>
                    {isElder ? "건강 기록 알림" : "가족 상태 알림"}
                  </Text>
                  <Text style={styles.rowSub}>
                    {isElder
                      ? "매일 오전 기록을 도와드려요"
                      : "가족의 변화가 감지되면 알려드려요"}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={handleNotifToggle}
                trackColor={{ false: "#E7EAF0", true: C.blue }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E7EAF0"
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
                  <Info size={22} color={C.blue} strokeWidth={2.2} />
                </View>
                <Text style={styles.rowTitle}>버전</Text>
              </View>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>

            <View style={styles.divider} />

            <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} accessibilityRole="button">
              <View style={styles.rowLeft}>
                <View style={styles.rowIcon}>
                  <ShieldCheck size={22} color={C.blue} strokeWidth={2.2} />
                </View>
                <Text style={styles.rowTitle}>개인정보 처리방침</Text>
              </View>
              <ChevronRight size={20} color={C.blue} strokeWidth={2.4} />
            </Pressable>
          </View>
        </View>

        {/* 로그아웃 — 위험 행동처럼 보이지 않는 Secondary 스타일 */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
          onPress={handleLogout}
          accessibilityRole="button"
        >
          <LogOut size={20} color={C.blueDark} strokeWidth={2.2} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </ScrollView>

      {/* 직접사용자 로그아웃 확인 — 하단 바텀시트 모달 */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLogoutModalVisible(false)}
            accessibilityLabel="닫기"
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>앱 나가기</Text>
            <Text style={styles.modalBody}>
              나가시고, 다시 들어오려면{"\n"}자녀분께 도움을 받으셔야 해요.{"\n"}정말 나가시겠어요?
            </Text>
            <TouchableOpacity
              style={styles.modalStayBtn}
              onPress={() => setLogoutModalVisible(false)}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.modalStayText}>아니요, 계속 쓸게요</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalLeaveBtn}
              onPress={confirmElderLogout}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.modalLeaveText}>나갈게요</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// 설정 화면 팔레트 — 가족/리포트 탭과 동일한 네이비 중심 시스템.
// 신뢰감 70% / 따뜻함 30%. 코랄·오렌지 제거, 베이지 배경 유지.
const C = {
  mainText: "#3F2A1D",
  subText: "#6F5A49",
  inactiveText: "#9B8A7D",
  bg: "#F6E3C2",
  cardBg: "#FFF9F1",
  cardBorder: "rgba(94,65,40,0.12)",
  blue: "#173F73",
  blueDark: "#12345F",
  blueLight: "#F6E3C2",
  cardShadow: "0 8px 20px rgba(63,42,29,0.08)",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 10,
    gap: 4,
  },
  headerTitle: { fontSize: 34, lineHeight: 41, fontWeight: "900", color: C.mainText },
  headerSub: { fontSize: 15, color: C.subText, fontWeight: "600" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  section: { gap: 10, marginTop: 8 },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: C.subText,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.cardBorder,
    boxShadow: C.cardShadow,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  rowPressed: { backgroundColor: C.blueLight },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  rowTextWrap: { flex: 1, gap: 2 },
  rowIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 17, fontWeight: "800", color: C.mainText },
  rowSub: { fontSize: 13, color: C.subText, fontWeight: "600", lineHeight: 18 },
  rowValue: { fontSize: 16, color: C.blue, fontWeight: "700" },
  accountName: { fontSize: 20, lineHeight: 26, fontWeight: "900", color: C.mainText },
  accountEmail: { fontSize: 14, lineHeight: 19, color: C.subText, fontWeight: "700" },
  roleValue: { fontSize: 16, color: C.blueDark, fontWeight: "700" },
  divider: { height: 1, backgroundColor: C.cardBorder, marginHorizontal: 16 },
  logoutBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#173F73",
    backgroundColor: "#173F73",
  },
  logoutBtnPressed: { backgroundColor: C.blueLight },
  logoutText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },

  // 직접사용자 로그아웃 바텀시트 — 코랄/웜 톤(직접사용자 화면 팔레트). 색은 tokens.ts 참조.
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)", // 반투명 어두운 오버레이(브랜드 색 아님)
  },
  modalSheet: {
    width: "100%",
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: "800", color: colors.text.primary, marginBottom: 12 },
  modalBody: { fontSize: 18, lineHeight: 28, color: colors.text.secondary, marginBottom: 20 },
  modalStayBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.brand.coral,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  modalStayText: { fontSize: 18, fontWeight: "700", color: "white" },
  modalLeaveBtn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalLeaveText: { fontSize: 18, fontWeight: "600", color: colors.text.muted },
});

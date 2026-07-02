import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, FileText, Download, Share2, Stethoscope } from "lucide-react-native";
import * as Sharing from "expo-sharing";
import { colors } from "../../src/styles/tokens";

const NAVY = colors.guardianNavy;

// 리포트 PDF 공유 화면. 앞선 리포트 화면에서 생성한 로컬 PDF uri 를 받아
// 저장/공유/의사에게 공유(공유시트 경유) 를 제공한다. 강제 저장(MediaLibrary)은 쓰지 않는다.
export default function ReportShareScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { uri, fileName, createdAt } = useLocalSearchParams<{
    uri?: string;
    fileName?: string;
    createdAt?: string;
  }>();

  const [busy, setBusy] = useState(false);

  async function share(dialogTitle: string) {
    if (!uri || busy) return;
    setBusy(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        // 웹 등 공유시트 미지원 환경 안내.
        Alert.alert("공유를 사용할 수 없어요", "모바일 앱에서 저장·공유할 수 있어요.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle,
      });
    } catch {
      Alert.alert("공유 실패", "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  function shareToDoctor() {
    if (Platform.OS === "web") {
      void share("의사에게 공유");
      return;
    }
    // 진입 전 안내 문구 노출 후 공유시트 오픈.
    Alert.alert(
      "의사에게 공유",
      "진료 시 참고자료로 제시해주세요.",
      [
        { text: "취소", style: "cancel" },
        { text: "공유하기", onPress: () => void share("의사에게 공유") },
      ],
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={8}
        >
          <ArrowLeft size={24} color={NAVY.textMain} />
        </Pressable>
        <Text style={styles.headerTitle}>PDF 공유</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {/* 미리보기 카드 */}
        <View style={styles.previewCard}>
          <View style={styles.previewIcon}>
            <FileText size={34} color={NAVY.primary} strokeWidth={2} />
          </View>
          <Text style={styles.fileName} numberOfLines={2}>
            {fileName ?? "MOA_report.pdf"}
          </Text>
          <Text style={styles.createdAt}>생성일 {createdAt ?? "-"}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, (pressed || busy) && styles.pressed]}
            onPress={() => share("기기에 저장")}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="기기에 저장"
          >
            <Download size={20} color={NAVY.primary} strokeWidth={2.2} />
            <Text style={styles.secondaryText}>기기에 저장</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.pressed]}
            onPress={() => share("리포트 공유")}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="공유하기"
          >
            <Share2 size={20} color="#FFFFFF" strokeWidth={2.2} />
            <Text style={styles.primaryText}>공유하기</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.doctorBtn, (pressed || busy) && styles.pressed]}
            onPress={shareToDoctor}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="의사에게 공유"
          >
            <Stethoscope size={20} color={NAVY.primary} strokeWidth={2.2} />
            <Text style={styles.secondaryText}>의사에게 공유</Text>
          </Pressable>
          <Text style={styles.doctorNote}>진료 시 참고자료로 제시해주세요.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NAVY.bgPage },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Pretendard-ExtraBold", fontSize: 18, color: NAVY.textMain },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 12, justifyContent: "space-between" },

  previewCard: {
    backgroundColor: NAVY.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: NAVY.border,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  previewIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: NAVY.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  fileName: {
    fontFamily: "Pretendard-Bold",
    fontSize: 17,
    lineHeight: 24,
    color: NAVY.textMain,
    textAlign: "center",
  },
  createdAt: { fontFamily: "Pretendard-Medium", fontSize: 14, color: NAVY.textSub },

  actions: { gap: 12 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 58,
    borderRadius: 15,
    backgroundColor: NAVY.primary,
  },
  primaryText: { fontFamily: "Pretendard-Bold", fontSize: 18, color: "#FFFFFF" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 58,
    borderRadius: 15,
    backgroundColor: NAVY.card,
    borderWidth: 1.5,
    borderColor: NAVY.primary,
  },
  doctorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 58,
    borderRadius: 15,
    backgroundColor: NAVY.card,
    borderWidth: 1.5,
    borderColor: NAVY.border,
  },
  secondaryText: { fontFamily: "Pretendard-Bold", fontSize: 18, color: NAVY.primary },
  doctorNote: {
    fontFamily: "Pretendard-Medium",
    fontSize: 13,
    color: NAVY.textSub,
    textAlign: "center",
    marginTop: 2,
  },
  pressed: { opacity: 0.85 },
});

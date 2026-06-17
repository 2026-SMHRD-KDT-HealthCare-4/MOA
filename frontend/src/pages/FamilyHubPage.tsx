import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  UserPlus,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Share2,
} from "lucide-react-native";
import { useAuthStore, type FamilyLink } from "../stores/authStore";
import { getParentMeta, PARENT_STATUS_LABEL, type ParentStatus } from "../mocks/family";

// 가족 구성 허브 — 돌보는 부모 카드 + 함께 돌보는 가족 + 연결 대기/추가.
// 카드 탭 → 부모 상세 리포트(detail)로 drill-down.
export default function FamilyHubPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const links = useAuthStore((s) => s.links);

  const active = links.filter((l) => l.status === "ACTIVE");
  const pending = links.filter((l) => l.status === "PENDING");

  async function resharePairingCode(link: FamilyLink) {
    if (!link.pairingCode) return;
    await Share.share({
      message: `MOA 페어링 코드: ${link.pairingCode}\n${link.counterpartName}님 기기에서 이 코드를 입력해 연결을 완료해 주세요.`,
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>돌보는 분</Text>
        <Text style={styles.headerSub}>가족의 오늘을 함께 살펴봐요</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        {active.length === 0 && pending.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>아직 연결된 부모님이 없어요</Text>
            <Text style={styles.emptyBody}>부모님을 등록하고 페어링 코드를 전달하면 연결돼요.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/onboarding")} activeOpacity={0.85}>
              <UserPlus size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>부모님 연결하기</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 연동된 부모 카드 */}
        {active.map((link) => {
          const meta = getParentMeta(link.counterpartName);
          return (
            <TouchableOpacity
              key={link.linkId}
              style={styles.memberCard}
              activeOpacity={0.88}
              onPress={() => router.push(`/(guardian)/family/${link.counterpartId}`)}
              accessibilityRole="button"
              accessibilityLabel={`${link.counterpartName}님 상세 리포트 보기`}
            >
              <View style={styles.profileRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>{link.counterpartName[0]}</Text>
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.nameArea}>
                  <Text style={styles.memberName}>{link.counterpartName} 님</Text>
                  <View style={styles.lastRow}>
                    <Clock size={13} color="#a99a92" />
                    <Text style={styles.lastText}>마지막 안부 {meta.lastGreeting}</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#c4b5ae" />
              </View>

              {/* 오늘 상태 — 색+아이콘+텍스트 병행 */}
              <StatusPill status={meta.status} />

              <View style={styles.divider} />

              {/* 함께 돌보는 가족 */}
              <View style={styles.siblingsWrap}>
                <Text style={styles.siblingsLabel}>함께 돌보는 가족</Text>
                <View style={styles.siblingsRow}>
                  {meta.siblings.map((s, i) => (
                    <View key={`${s.name}-${i}`} style={styles.siblingChip}>
                      <View style={styles.siblingAvatar}>
                        <Text style={styles.siblingInitial}>{s.name[0]}</Text>
                      </View>
                      <Text style={styles.siblingName}>{s.name}</Text>
                      <Text style={styles.siblingRole}>{s.role}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* 연결 대기 중 */}
        {pending.map((link) => (
          <View key={link.linkId} style={styles.pendingCard}>
            <View style={styles.pendingHead}>
              <Clock size={20} color="#E8943A" strokeWidth={2.4} />
              <Text style={styles.pendingTitle}>{link.counterpartName}님 연결 대기 중</Text>
            </View>
            <Text style={styles.pendingBody}>
              {link.counterpartName}님 기기에서 아래 코드를 입력하면 연결이 완료돼요.
            </Text>
            {link.pairingCode ? <Text style={styles.pendingCode}>{link.pairingCode}</Text> : null}
            <TouchableOpacity
              style={styles.reshareBtn}
              onPress={() => resharePairingCode(link)}
              activeOpacity={0.85}
              disabled={!link.pairingCode}
            >
              <Share2 size={18} color="#FF7955" />
              <Text style={styles.reshareText}>페어링 코드 재공유</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* 부모님 추가 */}
        {(active.length > 0 || pending.length > 0) && (
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => router.push("/onboarding")}>
            <UserPlus size={22} color="#FF7955" />
            <Text style={styles.addBtnText}>부모님 연결 추가</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function StatusPill({ status }: { status: ParentStatus }) {
  const normal = status === "normal";
  const color = normal ? "#2ECC71" : "#E8943A";
  const bg = normal ? "#EAF8F0" : "#FBEFDD";
  const Icon = normal ? CheckCircle2 : AlertTriangle;
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Icon size={18} color={color} strokeWidth={2.4} />
      <Text style={[styles.statusPillText, { color }]}>오늘 상태 · {PARENT_STATUS_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9F2" },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 4 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#342C28" },
  headerSub: { fontSize: 16, color: "#765E52" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },

  memberCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    shadowColor: "#c0a99f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
    gap: 14,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffede9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontWeight: "800", color: "#FF7955" },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "white",
    backgroundColor: "#2ECC71",
  },
  nameArea: { flex: 1, gap: 3 },
  memberName: { fontSize: 18, fontWeight: "700", color: "#342C28" },
  lastRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  lastText: { fontSize: 13, color: "#a99a92" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusPillText: { fontSize: 15, fontWeight: "800" },

  divider: { height: 1, backgroundColor: "#f5eeea" },
  siblingsWrap: { gap: 10 },
  siblingsLabel: { fontSize: 13, fontWeight: "700", color: "#a99a92" },
  siblingsRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  siblingChip: { alignItems: "center", gap: 3 },
  siblingAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3ece6",
    alignItems: "center",
    justifyContent: "center",
  },
  siblingInitial: { fontSize: 16, fontWeight: "800", color: "#8a766c" },
  siblingName: { fontSize: 13, fontWeight: "700", color: "#40332D" },
  siblingRole: { fontSize: 11, color: "#a99a92" },

  pendingCard: {
    backgroundColor: "#FFFDF9",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F3DFC2",
    gap: 10,
  },
  pendingHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  pendingTitle: { fontSize: 17, fontWeight: "800", color: "#9A6B25" },
  pendingBody: { fontSize: 14, lineHeight: 20, color: "#765E52" },
  pendingCode: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 3,
    color: "#342C28",
    paddingVertical: 4,
  },
  reshareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD3C6",
    backgroundColor: "white",
  },
  reshareText: { fontSize: 16, fontWeight: "800", color: "#FF7955" },

  emptyCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    gap: 10,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 19, fontWeight: "800", color: "#342C28" },
  emptyBody: { fontSize: 15, lineHeight: 22, color: "#765E52", textAlign: "center" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    alignSelf: "stretch",
    borderRadius: 15,
    backgroundColor: "#FF7955",
    marginTop: 6,
  },
  primaryBtnText: { fontSize: 18, fontWeight: "800", color: "white" },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#FF7955",
    backgroundColor: "white",
  },
  addBtnText: { fontSize: 18, fontWeight: "600", color: "#FF7955" },
});

import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Share, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Share2,
  UserPlus,
  Users,
} from "lucide-react-native";
import {
  useAuthStore,
  type FamilyLink,
  type GuardianMember,
} from "../stores/authStore";
import { getParentMeta, PARENT_STATUS_LABEL, type ParentStatus } from "../mocks/family";
import * as authApi from "../api/auth";

export default function FamilyHubPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const links = useAuthStore((s) => s.links);
  const familyGroupId = useAuthStore((s) => s.familyGroupId);
  const guardianMemberRole = useAuthStore((s) => s.guardianMemberRole);
  const guardianMembers = useAuthStore((s) => s.guardianMembers);
  const setGuardianMembers = useAuthStore((s) => s.setGuardianMembers);

  const [inviteName, setInviteName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  const active = links.filter((l) => l.status === "ACTIVE");
  const pending = links.filter((l) => l.status === "PENDING");
  const isOwner = guardianMemberRole === "OWNER";

  async function resharePairingCode(link: FamilyLink) {
    if (!link.pairingCode) return;
    await Share.share({
      message: `MOA 페어링 코드: ${link.pairingCode}\n${link.counterpartName}님 기기에서 이 코드를 입력해 연결해 주세요.`,
    });
  }

  async function shareGuardianInvite(code: string) {
    await Share.share({
      message: `MOA 가족 초대 코드: ${code}\n보호자로 가입한 뒤 이 코드를 입력하면 함께 돌볼 수 있어요.`,
    });
  }

  async function handleInviteGuardian() {
    if (!familyGroupId || !user) return setInviteError("가족 그룹을 먼저 만들어 주세요.");
    if (!inviteName.trim()) return setInviteError("초대할 보호자 이름을 입력해 주세요.");

    setInviting(true);
    try {
      const res = await authApi.inviteGuardian({
        familyGroupId,
        inviterGuardianId: user.id,
        name: inviteName.trim(),
      });
      setGuardianMembers([...guardianMembers, res.data.guardianMember]);
      setInviteCode(res.data.inviteCode);
      setInviteError("");
      setInviteName("");
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "보호자 초대에 실패했어요.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>돌보는 부모님</Text>
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
                    <Text style={styles.lastText}>마지막 인사 {meta.lastGreeting}</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#c4b5ae" />
              </View>

              <StatusPill status={meta.status} />
            </TouchableOpacity>
          );
        })}

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
              <Text style={styles.reshareText}>페어링 코드 공유</Text>
            </TouchableOpacity>
          </View>
        ))}

        {(active.length > 0 || pending.length > 0) && (
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => router.push("/onboarding")}>
            <UserPlus size={22} color="#FF7955" />
            <Text style={styles.addBtnText}>부모님 연결 추가</Text>
          </TouchableOpacity>
        )}

        {(active.length > 0 || pending.length > 0 || guardianMembers.length > 0) && (
          <View style={styles.guardianCard}>
            <View style={styles.guardianHeader}>
              <Users size={20} color="#765E52" />
              <Text style={styles.guardianTitle}>함께 돌보는 보호자</Text>
            </View>

            {guardianMembers.map((member) => (
              <GuardianMemberRow key={member.id} member={member} />
            ))}

            {isOwner ? (
              <View style={styles.inviteBox}>
                <Text style={styles.inviteTitle}>부보호자 초대</Text>
                <TextInput
                  style={styles.inviteInput}
                  value={inviteName}
                  onChangeText={setInviteName}
                  placeholder="예: 김지훈"
                  placeholderTextColor="#c4b5ae"
                />
                {inviteError ? <Text style={styles.inviteError}>{inviteError}</Text> : null}
                <TouchableOpacity
                  style={[styles.inviteBtn, inviting && styles.disabled]}
                  onPress={handleInviteGuardian}
                  activeOpacity={0.85}
                  disabled={inviting}
                >
                  <Text style={styles.inviteBtnText}>{inviting ? "초대 중..." : "초대 코드 발급"}</Text>
                </TouchableOpacity>
                {inviteCode ? (
                  <TouchableOpacity
                    style={styles.inviteCodeBtn}
                    onPress={() => shareGuardianInvite(inviteCode)}
                    activeOpacity={0.85}
                  >
                    <Share2 size={17} color="#FF7955" />
                    <Text style={styles.inviteCodeText}>{inviteCode}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function GuardianMemberRow({ member }: { member: GuardianMember }) {
  const active = member.status === "ACTIVE";
  return (
    <View style={styles.guardianRow}>
      <View style={[styles.guardianDot, active ? styles.guardianDotActive : styles.guardianDotPending]} />
      <View style={styles.guardianCopy}>
        <Text style={styles.guardianName}>{member.guardianName}</Text>
        <Text style={styles.guardianRole}>
          {member.memberRole === "OWNER" ? "대표보호자" : "부보호자"} · {active ? "참여 중" : "초대 대기"}
        </Text>
      </View>
      {member.inviteCode && member.status === "PENDING" ? (
        <Text style={styles.guardianCode}>{member.inviteCode}</Text>
      ) : null}
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
  pendingCode: { fontSize: 26, fontWeight: "900", letterSpacing: 3, color: "#342C28" },
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
  guardianCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#f0e8e2",
    gap: 12,
  },
  guardianHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  guardianTitle: { fontSize: 18, fontWeight: "800", color: "#342C28" },
  guardianRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  guardianDot: { width: 10, height: 10, borderRadius: 5 },
  guardianDotActive: { backgroundColor: "#2ECC71" },
  guardianDotPending: { backgroundColor: "#E8943A" },
  guardianCopy: { flex: 1, gap: 2 },
  guardianName: { fontSize: 15, fontWeight: "800", color: "#40332D" },
  guardianRole: { fontSize: 12, color: "#a99a92", fontWeight: "700" },
  guardianCode: { fontSize: 13, fontWeight: "900", color: "#765E52" },
  inviteBox: { gap: 8, borderTopWidth: 1, borderTopColor: "#f5eeea", paddingTop: 12 },
  inviteTitle: { fontSize: 14, fontWeight: "800", color: "#765E52" },
  inviteInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "#e8ddd9",
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#342C28",
    backgroundColor: "#FFFDF9",
  },
  inviteBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FF7955",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtnText: { fontSize: 16, fontWeight: "800", color: "white" },
  disabled: { opacity: 0.6 },
  inviteError: { fontSize: 13, fontWeight: "700", color: "#E8943A" },
  inviteCodeBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FFD3C6",
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  inviteCodeText: { fontSize: 17, fontWeight: "900", color: "#FF7955", letterSpacing: 1 },
});

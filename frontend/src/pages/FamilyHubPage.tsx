import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, Share, TextInput, Modal, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Share2,
  UserPlus,
  Users,
} from "lucide-react-native";
import { useAuthStore, type GuardianMember } from "../stores/authStore";
import { getParentMeta, PARENT_STATUS_LABEL, type ParentStatus } from "../mocks/family";
import * as authApi from "../api/auth";
import { colors } from "../styles/tokens";

export default function FamilyHubPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const links = useAuthStore((s) => s.links);
  const familyGroupId = useAuthStore((s) => s.familyGroupId);
  const guardianMembers = useAuthStore((s) => s.guardianMembers);
  const setGuardianMembers = useAuthStore((s) => s.setGuardianMembers);
  const setLinks = useAuthStore((s) => s.setLinks);

  const [inviteName, setInviteName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ linkId: string; name: string } | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");
  const [relinkTarget, setRelinkTarget] = useState<{ seniorId: string; name: string } | null>(null);
  const [relinkCode, setRelinkCode] = useState("");
  const [relinkExpiresAt, setRelinkExpiresAt] = useState("");
  const [relinkLoading, setRelinkLoading] = useState(false);
  const [relinkError, setRelinkError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = links.filter((l) => l.status === "ACTIVE");

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const refreshLinks = useCallback(async () => {
    if (!user || user.role !== "guardian") return;
    const response = await authApi.getGuardianSeniors(user.id);
    setLinks(response.data);
    setListError("");
  }, [setLinks, user]);

  useFocusEffect(
    useCallback(() => {
      void refreshLinks().catch(() => {
        setListError("목록을 불러오지 못했어요. 아래로 당겨 다시 시도해 주세요.");
      });
    }, [refreshLinks]),
  );

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshLinks();
    } catch {
      setListError("목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setRefreshing(false);
    }
  }

  async function shareGuardianInvite(code: string) {
    await Share.share({
      message: `MOA 가족 초대 코드: ${code}\n보호자로 가입한 뒤 이 코드를 입력하면 함께 돌볼 수 있어요.`,
    });
  }

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => setToastMessage(""), 1800);
  }

  function openUnlinkModal(linkId: string, name: string) {
    setUnlinkError("");
    setUnlinkTarget({ linkId, name });
  }

  function closeUnlinkModal() {
    if (unlinking) return;
    setUnlinkTarget(null);
    setUnlinkError("");
  }

  async function confirmUnlink() {
    if (!unlinkTarget || unlinking) return;
    setUnlinking(true);
    setUnlinkError("");
    try {
      await authApi.updateLinkStatus({
        linkId: unlinkTarget.linkId,
        link_status: "REVOKED",
      });
      setLinks(links.filter((link) => link.linkId !== unlinkTarget.linkId));
      setUnlinkTarget(null);
      showToast("연결을 해제했어요.");
    } catch (error) {
      setUnlinkError(error instanceof Error ? error.message : "연결 해제에 실패했어요.");
    } finally {
      setUnlinking(false);
    }
  }

  async function openRelinkModal(seniorId: string, name: string) {
    setRelinkTarget({ seniorId, name });
    setRelinkCode("");
    setRelinkExpiresAt("");
    setRelinkError("");
    setRelinkLoading(true);
    try {
      const res = await authApi.requestRelinkCode(seniorId);
      setRelinkCode(res.data.code);
      setRelinkExpiresAt(res.data.expired_at);
    } catch (error) {
      setRelinkError(error instanceof Error ? error.message : "재연결 코드를 받지 못했어요.");
    } finally {
      setRelinkLoading(false);
    }
  }

  function closeRelinkModal() {
    setRelinkTarget(null);
    setRelinkCode("");
    setRelinkExpiresAt("");
    setRelinkError("");
  }

  async function shareRelinkCode() {
    if (!relinkCode) return;
    await Share.share({
      message: `MOA 기기 재연결 코드: ${relinkCode}\n부모님 기기에서 이 코드를 입력하면 다시 연결돼요. (24시간 유효)`,
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#4F76A8"]}
            tintColor="#4F76A8"
          />
        }
      >
        {listError ? <Text style={styles.listError}>{listError}</Text> : null}
        {active.length === 0 ? (
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
            <View key={link.linkId} style={styles.memberCard}>
              <TouchableOpacity
                style={styles.reportTapArea}
                activeOpacity={0.88}
                onPress={() => router.push(`/(guardian)/report?elderId=${link.counterpartId}`)}
                accessibilityRole="button"
                accessibilityLabel={`${link.counterpartName}님 리포트 보기`}
              >
                <View style={styles.profileRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>{link.counterpartName[0]}</Text>
                    <View style={styles.onlineDot} />
                  </View>
                  <View style={styles.nameArea}>
                    <Text style={styles.memberName}>{link.counterpartName} 님</Text>
                    <View style={styles.lastRow}>
                      <Clock size={13} color="#9B8A7D" />
                      <Text style={styles.lastText}>마지막 인사 {meta.lastGreeting}</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#9B8A7D" />
                </View>

                <StatusPill status={meta.status} />
                <View style={styles.reportLinkRow}>
                  <Text style={styles.reportLinkText}>리포트 보기</Text>
                  <ChevronRight size={18} color="#4F76A8" strokeWidth={2.4} />
                </View>
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.relinkButton}
                  onPress={() => openRelinkModal(link.counterpartId, link.counterpartName)}
                  accessibilityRole="button"
                  accessibilityLabel={`${link.counterpartName}님 기기 재연결 코드`}
                >
                  {({ pressed }) => (
                    <Text style={[styles.relinkButtonText, pressed && styles.relinkButtonTextPressed]}>
                      기기 재연결 코드
                    </Text>
                  )}
                </Pressable>
                <View style={styles.actionDivider} />
                <Pressable
                  style={styles.unlinkButton}
                  onPress={() => openUnlinkModal(link.linkId, link.counterpartName)}
                  accessibilityRole="button"
                  accessibilityLabel={`${link.counterpartName}님 연결 해제`}
                >
                  {({ pressed }) => (
                    <Text style={[styles.unlinkButtonText, pressed && styles.unlinkButtonTextPressed]}>
                      연결 해제
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}

        {active.length > 0 && (
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={() => router.push("/onboarding")}>
            <UserPlus size={22} color="#355A8A" />
            <Text style={styles.addBtnText}>부모님 연결 추가</Text>
          </TouchableOpacity>
        )}

        {(active.length > 0 || guardianMembers.length > 0) && (
          <View style={styles.guardianCard}>
            <View style={styles.guardianHeader}>
              <Users size={20} color="#9B8A7D" />
              <Text style={styles.guardianTitle}>함께 돌보는 보호자</Text>
            </View>

            {guardianMembers.map((member) => (
              <GuardianMemberRow key={member.id} member={member} />
            ))}

            {/* 평탄 모델: 모든 보호자가 동등하게 다른 보호자를 초대할 수 있다. */}
            <View style={styles.inviteBox}>
              <Text style={styles.inviteTitle}>보호자 초대</Text>
              <TextInput
                style={styles.inviteInput}
                value={inviteName}
                onChangeText={setInviteName}
                placeholder="예: 김지훈"
                placeholderTextColor="#B7A99D"
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
                  <Share2 size={17} color="#4F76A8" />
                  <Text style={styles.inviteCodeText}>{inviteCode}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={unlinkTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeUnlinkModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityRole="alert">
            <Text style={styles.modalTitle}>연결을 해제할까요?</Text>
            <Text style={styles.modalBody}>
              해제 후에는 {unlinkTarget?.name ? `${unlinkTarget.name} 님의 ` : ""}리포트를 확인할 수 없어요.
            </Text>
            {unlinkError ? <Text style={styles.modalError}>{unlinkError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeUnlinkModal}
                disabled={unlinking}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, unlinking && styles.disabled]}
                onPress={confirmUnlink}
                disabled={unlinking}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>{unlinking ? "해제 중..." : "해제하기"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={relinkTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRelinkModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityRole="alert">
            <Text style={styles.modalTitle}>재연결 코드</Text>
            <Text style={styles.modalBody}>
              아래 코드를 부모님 기기에서 입력해 주세요
              {relinkExpiresAt ? ` (${formatRelinkValidity(relinkExpiresAt)})` : ""}
            </Text>

            {relinkLoading ? (
              <ActivityIndicator color={G.primary} style={styles.relinkSpinner} />
            ) : relinkError ? (
              <Text style={styles.modalError}>{relinkError}</Text>
            ) : (
              <>
                <View style={styles.relinkCodeBox}>
                  <Text style={styles.relinkCodeText} accessibilityLabel={`재연결 코드 ${relinkCode}`}>
                    {relinkCode}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.relinkShareBtn}
                  onPress={shareRelinkCode}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="재연결 코드 공유"
                >
                  <Share2 size={18} color="#FFFFFF" />
                  <Text style={styles.relinkShareText}>코드 공유</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.relinkCloseBtn}
              onPress={closeRelinkModal}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.relinkCloseText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toastMessage ? (
        <View style={[styles.toast, { bottom: insets.bottom + 22 }]} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

// 재연결 코드 유효시간을 응답 expired_at 기준으로 사람이 읽기 좋은 문구로 변환.
// 백엔드 발급 정책(real 1시간 / mock 24시간)이 바뀌어도 표시가 자동으로 맞춰진다.
function formatRelinkValidity(expiresAt: string): string {
  const remainMs = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remainMs) || remainMs <= 0) return "잠시 후 만료";
  const hours = Math.round(remainMs / (60 * 60 * 1000));
  if (hours >= 1) return `약 ${hours}시간 유효`;
  const minutes = Math.max(1, Math.round(remainMs / (60 * 1000)));
  return `약 ${minutes}분 유효`;
}

function GuardianMemberRow({ member }: { member: GuardianMember }) {
  const active = member.status === "ACTIVE";
  return (
    <View style={styles.guardianRow}>
      <View style={[styles.guardianDot, active ? styles.guardianDotActive : styles.guardianDotPending]} />
      <View style={styles.guardianCopy}>
        <Text style={styles.guardianName}>{member.guardianName}</Text>
        <Text style={styles.guardianRole}>
          가족 보호자 · {active ? "참여 중" : "초대 대기"}
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
  // 안정 상태는 따뜻한 세이지 그린(병원식 채도 높은 초록 대신), 주의는 앰버
  const color = normal ? "#6F9C7A" : "#C9793F";
  const bg = normal ? "#EDF5EF" : "#FBEFDD";
  const Icon = normal ? CheckCircle2 : AlertTriangle;
  // "정상" 같은 진단 어감 대신 "안정적"으로 부드럽게 표기
  const label = normal ? "안정적" : PARENT_STATUS_LABEL[status];
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Icon size={16} color={color} strokeWidth={2.4} />
      <Text style={[styles.statusPillText, { color }]}>오늘 상태 · {label}</Text>
    </View>
  );
}

// 가족 탭(보호자 모니터링) 팔레트 — 4색 체계: 네이비 + 베이지 + 세이지그린 + 앰버.
// 레드 사용 금지. 신뢰감 70% / 따뜻함 30%. CTA·핵심 액션은 브랜드 블루(#4F76A8~#355A8A).
const C = {
  mainText: "#3B2318",
  subText: "#765E52",
  bg: "#FFF8EF",
  cardBg: "#FFFFFF",
  cardBorder: "#E5ECF5",
  blue: "#4F76A8",
  blueDark: "#355A8A",
  blueLight: "#EEF4FB",
  divider: "#F1E1D2",
  iconMuted: "#9B8A7D",
  sage: "#6F9C7A", // 안정 상태 텍스트·아이콘
  sageBg: "#EDF5EF", // 안정 배지 배경
  sageDot: "#7FA38A", // 온라인/참여 상태 점(부드럽게)
  unlinkText: "#7B8796", // 보조 액션(연결 해제) — 존재감 낮춘 차분한 블루그레이
  cardShadow: "0 8px 20px rgba(53,90,138,0.08)",
};

// 재연결 코드 버튼·모달 전용 — tokens.ts 네이비 팔레트만 참조(하드코딩 금지).
const G = colors.guardianNavy;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 10, gap: 4 },
  headerTitle: { fontSize: 24, fontWeight: "900", color: C.mainText },
  headerSub: { fontSize: 16, color: C.subText },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  listError: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FBEFDD",
    color: "#9A6B25",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
  memberCard: {
    backgroundColor: C.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.cardBorder,
    boxShadow: C.cardShadow,
  },
  reportTapArea: { padding: 19, gap: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontWeight: "800", color: C.blue },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: C.sageDot,
  },
  nameArea: { flex: 1, gap: 3 },
  memberName: { fontSize: 18, fontWeight: "700", color: C.mainText },
  lastRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  lastText: { fontSize: 13, color: C.iconMuted },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 15, fontWeight: "800" },
  reportLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingTop: 2,
  },
  reportLinkText: { fontSize: 16, fontWeight: "800", color: C.blue },
  cardActions: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  actionDivider: { width: 1, backgroundColor: C.divider, marginVertical: 12 },
  relinkButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  relinkButtonText: { fontSize: 15, fontWeight: "700", color: G.primary },
  relinkButtonTextPressed: { color: G.primaryDark },
  unlinkButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  unlinkButtonText: { fontSize: 15, fontWeight: "700", color: C.unlinkText },
  unlinkButtonTextPressed: { color: "#5C6675" },
  relinkSpinner: { paddingVertical: 18 },
  relinkCodeBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: G.primaryLight,
    borderWidth: 1,
    borderColor: G.border,
  },
  relinkCodeText: { fontSize: 28, fontWeight: "900", color: G.primaryDark, letterSpacing: 3 },
  relinkShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 16,
    backgroundColor: G.primary,
    boxShadow: "0 8px 18px rgba(53,90,138,0.18)",
  },
  relinkShareText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  relinkCloseBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.border,
    alignItems: "center",
    justifyContent: "center",
  },
  relinkCloseText: { fontSize: 17, fontWeight: "800", color: G.textSub },
  emptyCard: {
    backgroundColor: C.cardBg,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: C.cardBorder,
    boxShadow: C.cardShadow,
    gap: 10,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 19, fontWeight: "800", color: C.mainText },
  emptyBody: { fontSize: 15, lineHeight: 22, color: C.subText, textAlign: "center" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 58,
    alignSelf: "stretch",
    borderRadius: 16,
    backgroundColor: C.blue,
    boxShadow: "0 8px 18px rgba(53,90,138,0.18)",
    marginTop: 6,
  },
  primaryBtnText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 64,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#A9BEDC",
    backgroundColor: C.blueLight,
  },
  addBtnText: { fontSize: 18, fontWeight: "700", color: C.blueDark },
  guardianCard: {
    backgroundColor: C.cardBg,
    borderRadius: 24,
    padding: 19,
    borderWidth: 1,
    borderColor: C.cardBorder,
    boxShadow: C.cardShadow,
    gap: 12,
  },
  guardianHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  guardianTitle: { fontSize: 18, fontWeight: "800", color: C.mainText },
  guardianRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  guardianDot: { width: 10, height: 10, borderRadius: 5 },
  guardianDotActive: { backgroundColor: C.sageDot },
  guardianDotPending: { backgroundColor: "#E8943A" },
  guardianCopy: { flex: 1, gap: 2 },
  guardianName: { fontSize: 15, fontWeight: "800", color: C.mainText },
  guardianRole: { fontSize: 12, color: C.subText, fontWeight: "700" },
  guardianCode: { fontSize: 13, fontWeight: "900", color: C.subText },
  inviteBox: { gap: 8, borderTopWidth: 1, borderTopColor: C.cardBorder, paddingTop: 14 },
  inviteTitle: { fontSize: 14, fontWeight: "800", color: C.subText },
  inviteInput: {
    height: 54,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: C.mainText,
    backgroundColor: "#FFFDF9",
  },
  inviteBtn: {
    height: 58,
    borderRadius: 16,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 18px rgba(53,90,138,0.18)",
  },
  inviteBtnText: { fontSize: 16, fontWeight: "900", color: "#FFFFFF" },
  disabled: { opacity: 0.6 },
  inviteError: { fontSize: 13, fontWeight: "700", color: "#B07A48" },
  inviteCodeBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#A9BEDC",
    backgroundColor: C.blueLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  inviteCodeText: { fontSize: 17, fontWeight: "900", color: C.blue, letterSpacing: 1 },
  modalBackdrop: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: "rgba(59,35,24,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    padding: 22,
    backgroundColor: "#FFFDF9",
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 14,
  },
  modalTitle: { fontSize: 22, lineHeight: 29, fontWeight: "900", color: C.mainText },
  modalBody: { fontSize: 17, lineHeight: 25, fontWeight: "600", color: C.subText },
  modalError: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: "#B07A48" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { fontSize: 17, fontWeight: "800", color: C.subText },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: C.mainText,
  },
  toastText: { fontSize: 16, lineHeight: 22, fontWeight: "800", color: "#FFFFFF" },
});

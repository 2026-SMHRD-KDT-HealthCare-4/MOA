import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Bell, Hospital, Mic, Pill } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../stores/authStore";
import { listMedications, type MedicationResponse } from "../api/medication";
import { listHospitalVisits, type HospitalVisitResponse } from "../api/hospital";
import { listScriptRecords } from "../api/record";

// real 모드에서만 서버 조회. 그 외/실패 시 빈 목록(목업 없음).
const REAL_API = process.env.EXPO_PUBLIC_AUTH_API_MODE === "real";

// "HH:MM:SS"/"HH:MM" → "오전/오후 h:mm"
function timeLabel(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m ?? 0).padStart(2, "0")}`;
}

// 오늘 기준 방문일까지 남은 일수(음수면 지난 일정).
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

// 백엔드 measured_at 은 타임존 표기 없는 UTC(utcnow) → 'Z'를 붙여 UTC로 해석한다.
function parseServerDate(s: string): Date {
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : `${s}Z`);
}

// 해당 시각이 (로컬 기준) 오늘인지.
function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function NotificationCenterPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 복약관리 화면과 동일한 seniorId 산출(직접사용자=본인, 보호자=연동 직접사용자).
  const authUser = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const links = useAuthStore((s) => s.links);
  const seniorId =
    role === "elder"
      ? authUser?.id || ""
      : links.find((l) => l.status === "ACTIVE")?.counterpartId || "";

  const [medications, setMedications] = useState<MedicationResponse[]>([]);
  const [visits, setVisits] = useState<HospitalVisitResponse[]>([]);
  // '음성 검사' = 지정문구 낭독. 오늘 지정문구 기록이 있으면 완료로 본다.
  const [voiceCheckDone, setVoiceCheckDone] = useState(false);

  // 화면 진입 시 실제 DB에서 약·병원 일정·지정문구 기록을 조회한다(복약관리와 동일 소스).
  useFocusEffect(
    useCallback(() => {
      if (!REAL_API || !seniorId) {
        setMedications([]);
        setVisits([]);
        setVoiceCheckDone(false);
        return;
      }
      let alive = true;
      (async () => {
        try {
          const [meds, hv, records] = await Promise.all([
            listMedications(seniorId, true),
            listHospitalVisits(seniorId, true),
            listScriptRecords(seniorId).catch(() => []),
          ]);
          if (!alive) return;
          setMedications(meds);
          setVisits(hv);
          setVoiceCheckDone(records.some((r) => isToday(parseServerDate(r.measuredAt))));
        } catch {
          if (alive) {
            setMedications([]);
            setVisits([]);
            setVoiceCheckDone(false);
          }
        }
      })();
      return () => {
        alive = false;
      };
    }, [seniorId]),
  );

  // 약은 (같은 약이 복용 시간마다 행으로 오므로) 약 이름별로 묶어 한 카드로 보여준다.
  const medGroups = Object.values(
    medications.reduce<Record<string, { name: string; times: string[] }>>((acc, m) => {
      const g = acc[m.medicine_name] ?? { name: m.medicine_name, times: [] };
      g.times.push(m.intake_time);
      acc[m.medicine_name] = g;
      return acc;
    }, {}),
  ).map((g) => ({ ...g, times: g.times.sort() }));

  // 다가오는 가장 가까운 병원 방문(지난 일정 제외).
  const upcomingVisit = visits
    .filter((v) => daysUntil(v.visit_date) >= 0)
    .sort((a, b) => a.visit_date.localeCompare(b.visit_date))[0];
  const dday = upcomingVisit ? daysUntil(upcomingVisit.visit_date) : null;

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#F7D6AC", "#FFF2DE", "#F7D6AC"]} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Bell size={29} color="#3B2318" />
        <Text style={styles.title}>알림센터</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.subtitle}>오늘 확인해야 할 알림이에요</Text>

        {medGroups.map((m) => (
          <TouchableOpacity
            key={m.name}
            style={styles.card}
            onPress={() => router.push({ pathname: "/(elder)/health", params: { section: "medication" } })}
          >
            <View style={[styles.icon, styles.pending]}>
              <Pill color="#D4783B" size={25} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{m.name} · 복약 안내</Text>
              <Text style={styles.cardSub}>
                {m.times.map(timeLabel).join(", ")} · 복약/병원 화면에서 확인해요
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {upcomingVisit && (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({ pathname: "/(elder)/hospital-form", params: { id: upcomingVisit.visit_id } })
            }
          >
            <View style={[styles.icon, styles.hospital]}>
              <Hospital color="#7B6AB0" size={24} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>
                {dday === 0 ? "오늘 병원 방문 일정이 있어요" : `병원 방문까지 ${dday}일 남았어요`}
              </Text>
              <Text style={styles.cardSub}>{upcomingVisit.hospital_name} · 일정을 확인해요</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 음성 검사 = 지정문구 낭독. 오늘 기록이 없을 때만 '미완료' 알림을 띄운다. */}
        {!voiceCheckDone && (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/(elder)/record")}
          >
            <View style={[styles.icon, styles.voice]}>
              <Mic color="#3B7895" size={24} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>오늘 음성 검사 미완료</Text>
              <Text style={styles.cardSub}>지금 지정문구 낭독으로 건강을 확인해요</Text>
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 24, paddingVertical: 22 },
  title: { fontSize: 30, fontWeight: "900", color: "#3B2318" },
  list: { padding: 20, gap: 12 },
  subtitle: { fontSize: 18, fontWeight: "900", color: "#765E52", marginBottom: 2 },
  card: {
    minHeight: 92,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.88)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderWidth: 1,
    borderColor: "rgba(117,76,42,0.10)",
  },
  icon: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  pending: { backgroundColor: "#FFF0D9" },
  hospital: { backgroundColor: "#EEE9FA" },
  voice: { backgroundColor: "#E0F0F5" },
  cardBody: { flex: 1, gap: 5 },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#3B2318" },
  cardSub: { fontSize: 14, fontWeight: "600", color: "#765E52" },
});

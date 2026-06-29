import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronRight,
  Clock3,
  Pill,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useState, useEffect, useCallback } from "react";
import { useMedicationStore } from "../stores/medicationStore";
import type { HospitalSchedule } from "../stores/medicationStore";
import { cancelMedicationNotifications } from "../utils/notificationHelper";
import { useAuthStore } from "../stores/authStore";
import { listMedications, deleteMedication as deleteMedicationApi, MedicationResponse } from "../api/medication";
import { listHospitalVisits, HospitalVisitResponse } from "../api/hospital";


const timeLabel = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;
};

const dateLabel = (date: string, time: string) => {
  const d = new Date(`${date}T00:00:00`);
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${day}) ${timeLabel(time)}`;
};

const cycleLabel = (cycle: string) =>
  cycle === "weekly" ? "주 1회" : cycle === "custom_days" ? "특정 요일" : "매일";

const medicationTimes = (medication: {
  times?: string[];
  scheduledTime?: string;
}) =>
  medication.times?.length
    ? medication.times
    : medication.scheduledTime
      ? [medication.scheduledTime]
      : [];

type GroupedMedication = {
  id: string;
  medicineName: string;
  times: string[];
  cycleType: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

export default function HealthManagementPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [active, setActive] = useState<"medication" | "hospital">(
    "medication"
  );

  const authUser = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const links = useAuthStore((s) => s.links);
  const seniorId = role === "elder"
    ? (authUser?.id || "")
    : (links.find((l) => l.status === "ACTIVE")?.counterpartId || "");

  const [medicationList, setMedicationList] = useState<MedicationResponse[]>([]);
  const [hospitalList, setHospitalList] = useState<HospitalVisitResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!seniorId) return;
    setLoading(true);
    try {
      const meds = await listMedications(seniorId);
      const visits = await listHospitalVisits(seniorId);
      setMedicationList(meds);
      setHospitalList(visits);
    } catch (err) {
      console.error("Failed to load health data:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setActive("medication");
      loadData();
    }, [seniorId])
  );

  // Medication Grouping
  const getGroupedMedications = (list: MedicationResponse[]): GroupedMedication[] => {
    const groups: { [key: string]: GroupedMedication } = {};
    list.forEach((item) => {
      const timeStr = item.intake_time.slice(0, 5); 
      if (!groups[item.medicine_name]) {
        groups[item.medicine_name] = {
          id: item.medication_id,
          medicineName: item.medicine_name,
          times: [timeStr],
          cycleType: "daily",
          startDate: item.start_date,
          endDate: item.end_date,
          isActive: item.is_active,
        };
      } else {
        if (!groups[item.medicine_name].times.includes(timeStr)) {
          groups[item.medicine_name].times.push(timeStr);
        }
      }
    });
    return Object.values(groups);
  };

  const medications = getGroupedMedications(medicationList);

  const mappedSchedules = hospitalList.map(visit => ({
    id: visit.visit_id,
    hospitalName: visit.hospital_name,
    visitDate: visit.visit_date,
    visitTime: visit.visit_time.slice(0, 5),
    memo: visit.memo || undefined,
    enabled: visit.is_active,
    createdAt: visit.created_at || new Date().toISOString(),
    updatedAt: visit.created_at || new Date().toISOString()
  }));

  const upcoming = mappedSchedules.filter(
    (item) => new Date(`${item.visitDate}T23:59:59`) >= new Date()
  );

  const past = mappedSchedules.filter(
    (item) => new Date(`${item.visitDate}T23:59:59`) < new Date()
  );

  const daysLeft = (date: string) =>
    Math.ceil(
      (new Date(`${date}T00:00:00`).getTime() -
        new Date(new Date().toDateString()).getTime()) /
        86400000
    );

  const confirmDeleteMedication = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteMedicationApi(id);
        // 로컬 상태 동기화
        setMedicationList(prev => prev.filter(m => m.medication_id !== id));
        
        // 기존 Zustand 스토어도 지워줌 (캐싱 대응)
        useMedicationStore.getState().deleteMedication(id);
      } catch (err) {
        console.error("Failed to delete medication:", err);
        Alert.alert("삭제 실패", "약 정보를 삭제하지 못했습니다.");
      }
    };

    if (Platform.OS === "web") {
      const ok = window.confirm(
        "정말 삭제할까요?\n이 약 정보를 삭제하면 되돌릴 수 없어요."
      );
      if (ok) void performDelete();
      return;
    }

    Alert.alert(
      "정말 삭제할까요?",
      "이 약 정보를 삭제하면 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: () => {
            void performDelete();
          },
        },
      ]
    );
  };

  const openMedicationCreate = () => {
    router.push({
      pathname: "/medication-form",
      params: {
        reset: Date.now().toString(),
      },
    });
  };

  const openMedicationEdit = (medication: GroupedMedication) => {
    router.push({
      pathname: "/medication-form",
      params: {
        id: medication.id,
        medicineName: medication.medicineName,
        cycleType: medication.cycleType,
        times: JSON.stringify(medication.times),
        startDate: medication.startDate,
        endDate: medication.endDate ?? "",
        enabled: medication.isActive ? "true" : "false",
      },
    });
  };

  const openHospitalCreate = () => {
    router.push({
      pathname: "/hospital-form",
      params: {
        reset: Date.now().toString(),
      },
    });
  };

  const openHospitalEdit = (schedule: HospitalSchedule) => {
    router.push({
      pathname: "/hospital-form",
      params: {
        id: schedule.id,
        hospitalName: schedule.hospitalName,
        visitDate: schedule.visitDate,
        visitTime: schedule.visitTime,
        memo: schedule.memo ?? "",
        enabled: schedule.enabled ? "true" : "false",
      },
    });
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#F7D6AC", "#FFF2DE", "#F7D6AC"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>복약/병원</Text>
        <Text style={styles.description}>건강 관리를 위해 오늘 확인해요</Text>

        <View style={styles.segment}>
          <TouchableOpacity
            onPress={() => setActive("medication")}
            style={[
              styles.segmentItem,
              active === "medication" && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                active === "medication" && styles.segmentTextActive,
              ]}
            >
              복약 관리
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActive("hospital")}
            style={[
              styles.segmentItem,
              active === "hospital" && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                active === "hospital" && styles.segmentTextActive,
              ]}
            >
              병원 일정
            </Text>
          </TouchableOpacity>
        </View>

        {active === "medication" ? (
          <>
            <Text style={styles.sectionTitle}>오늘 복용해야 할 약</Text>

            <View style={styles.cardGroup}>
              {medications
                .filter((m) => m.isActive)
                .map((medication) => (
                  <TouchableOpacity
                    key={medication.id}
                    style={styles.medRow}
                    onPress={() => openMedicationEdit(medication)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillIcon}>
                      <Pill color="#A46234" size={21} />
                    </View>

                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>
                        {medication.medicineName}
                      </Text>

                      <View style={styles.timeBadges}>
                        {medicationTimes(medication).map((time) => (
                          <View key={time} style={styles.timeBadge}>
                            <Clock3 color="#8A5638" size={14} />
                            <Text style={styles.timeBadgeText}>
                              {timeLabel(time)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <ChevronRight color="#9D8173" size={24} />
                  </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openMedicationCreate}
            >
              <Plus color="white" size={22} />
              <Text style={styles.primaryText}>약 추가하기</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>등록된 약</Text>

            <View style={styles.cardGroup}>
              {medications.map((medication) => (
                <View key={medication.id} style={styles.listRow}>
                  <TouchableOpacity
                    style={styles.editRow}
                    onPress={() => openMedicationEdit(medication)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pillIcon}>
                      <Pill color="#A46234" size={21} />
                    </View>

                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>
                        {medication.medicineName}
                      </Text>

                      <Text style={styles.rowSub}>
                        {cycleLabel(medication.cycleType)} ·{" "}
                        {medicationTimes(medication).map(timeLabel).join(", ")}
                      </Text>
                    </View>

                    <ChevronRight color="#9D8173" size={24} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDeleteMedication(medication.id)}
                  >
                    <Trash2 color="#C85D50" size={19} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>병원 일정</Text>

            <Text style={styles.hospitalDescription}>
              예정된 병원 방문 일정을 관리해요. 알림을 통해 미리 알려드릴게요.
            </Text>

            <Text style={styles.smallTitle}>예정된 일정</Text>

            <ScheduleList
              schedules={upcoming}
              onPress={openHospitalEdit}
              daysLeft={daysLeft}
            />

            <Text style={styles.smallTitle}>지난 일정</Text>

            <ScheduleList
              schedules={past}
              onPress={openHospitalEdit}
              daysLeft={daysLeft}
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openHospitalCreate}
            >
              <Plus color="white" size={22} />
              <Text style={styles.primaryText}>병원 일정 추가하기</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ScheduleList({
  schedules,
  onPress,
  daysLeft,
}: {
  schedules: ReturnType<typeof useMedicationStore.getState>["hospitalSchedules"];
  onPress: (schedule: HospitalSchedule) => void;
  daysLeft: (date: string) => number;
}) {
  if (!schedules.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.rowSub}>등록된 일정이 없어요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.cardGroup}>
      {schedules.map((schedule) => {
        const remaining = daysLeft(schedule.visitDate);

        return (
          <TouchableOpacity
            key={schedule.id}
            style={styles.scheduleCard}
            onPress={() => onPress(schedule)}
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{schedule.hospitalName}</Text>

              <Text style={styles.rowSub}>
                {dateLabel(schedule.visitDate, schedule.visitTime)}
              </Text>

              {schedule.memo ? (
                <Text style={styles.memo}>{schedule.memo}</Text>
              ) : null}

              {remaining >= 0 && remaining <= 3 ? (
                <Text style={styles.daysLeft}>
                  {remaining === 0 ? "오늘이에요" : `${remaining}일 남았어요`}
                </Text>
              ) : null}
            </View>

            <ChevronRight color="#9D8173" size={24} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: 20, gap: 12 },
  title: {
    fontSize: 31,
    fontWeight: "900",
    color: "#3F2A1D",
    marginTop: 10,
  },
  description: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6F5A49",
    marginBottom: 8,
  },
  segment: {
    height: 58,
    backgroundColor: "rgba(255,249,241,0.7)",
    padding: 5,
    borderRadius: 18,
    flexDirection: "row",
    marginBottom: 10,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  segmentActive: {
    backgroundColor: "#173F73",
  },
  segmentText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#6F5A49",
  },
  segmentTextActive: {
    color: "white",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#3F2A1D",
    marginTop: 8,
  },
  smallTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#6F5A49",
    marginTop: 6,
  },
  hospitalDescription: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: "#6F5A49",
  },
  cardGroup: {
    backgroundColor: "rgba(255,249,241,0.92)",
    borderRadius: 21,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(94,65,40,0.12)",
  },
  medRow: {
    minHeight: 94,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(94,65,40,0.12)",
  },
  listRow: {
    minHeight: 82,
    paddingVertical: 10,
    paddingLeft: 15,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "rgba(94,65,40,0.12)",
  },
  editRow: {
    flex: 1,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scheduleCard: {
    minHeight: 110,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(94,65,40,0.12)",
  },
  pillIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#F6E3C2",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    gap: 5,
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#3F2A1D",
  },
  rowSub: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6F5A49",
    lineHeight: 21,
  },
  timeBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#F6E3C2",
  },
  timeBadgeText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#3F2A1D",
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#FBE8E5",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#173F73",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginVertical: 4,
  },
  primaryText: {
    fontSize: 19,
    fontWeight: "900",
    color: "white",
  },
  memo: {
    fontSize: 16,
    fontWeight: "800",
    color: "#3F2A1D",
  },
  daysLeft: {
    alignSelf: "flex-start",
    marginTop: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#F6E3C2",
    fontSize: 14,
    fontWeight: "900",
    color: "#3F2A1D",
  },
  empty: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "rgba(255,249,241,0.7)",
  },
});

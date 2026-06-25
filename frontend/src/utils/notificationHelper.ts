import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useMedicationStore } from "../stores/medicationStore";
import { useAuthStore } from "../stores/authStore";

export async function scheduleMedicationNotifications(medicationId: string, medicineName: string, times: string[]) {
  if (Platform.OS === "web") return;
  // First, cancel any existing alarms for this medication
  await cancelMedicationNotifications(medicationId);

  const isMasterNotifEnabled = !!useAuthStore.getState().user?.fcmToken;
  if (!isMasterNotifEnabled) return;

  for (const time of times) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
    const [hour, minute] = time.split(":").map(Number);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "복약 알림",
          body: `${medicineName} 복용할 시간이에요.`,
          data: {
            localMedicationId: medicationId,
            medicationPrompt: `${medicineName} 드셨나요?`,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    } catch (err) {
      console.error(`Failed to schedule medication alarm for ${time}:`, err);
    }
  }
}

export async function cancelMedicationNotifications(medicationId: string) {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      const data = notif.content.data;
      if (data && data.localMedicationId === medicationId) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (err) {
    console.error("Failed to cancel medication notifications:", err);
  }
}

export async function scheduleHospitalNotifications(
  hospitalId: string,
  hospitalName: string,
  visitDate: string,
  visitTime: string
) {
  if (Platform.OS === "web") return;
  // First, cancel any existing alarms for this hospital schedule
  await cancelHospitalNotifications(hospitalId);

  const isMasterNotifEnabled = !!useAuthStore.getState().user?.fcmToken;
  if (!isMasterNotifEnabled) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(visitTime)) return;

  try {
    const visitDateTime = new Date(`${visitDate}T${visitTime}:00`);
    const now = new Date();

    // 1 day before
    const oneDayBefore = new Date(visitDateTime.getTime() - 24 * 60 * 60 * 1000);
    // 3 days before
    const threeDaysBefore = new Date(visitDateTime.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Set reminder time to 09:00 AM on those days
    oneDayBefore.setHours(9, 0, 0, 0);
    threeDaysBefore.setHours(9, 0, 0, 0);

    if (threeDaysBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "병원 방문 알림",
          body: `3일 뒤 ${hospitalName} 방문 일정이 있습니다 (${visitTime}).`,
          data: { localHospitalScheduleId: hospitalId },
        },
        trigger: threeDaysBefore,
      });
    }

    if (oneDayBefore > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "병원 방문 알림",
          body: `내일 ${hospitalName} 방문 일정이 있습니다 (${visitTime}).`,
          data: { localHospitalScheduleId: hospitalId },
        },
        trigger: oneDayBefore,
      });
    }
  } catch (err) {
    console.error("Failed to schedule hospital alarm:", err);
  }
}

export async function cancelHospitalNotifications(hospitalId: string) {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      const data = notif.content.data;
      if (data && data.localHospitalScheduleId === hospitalId) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (err) {
    console.error("Failed to cancel hospital notifications:", err);
  }
}

export async function scheduleAllAlarms() {
  if (Platform.OS === "web") return;
  const isMasterNotifEnabled = !!useAuthStore.getState().user?.fcmToken;
  if (!isMasterNotifEnabled) return;

  // 1. Cancel all first to prevent duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // 2. Schedule medications
  const medications = useMedicationStore.getState().medications;
  for (const med of medications) {
    if (med.isActive && med.cycleType === "daily") {
      await scheduleMedicationNotifications(med.id, med.medicineName, med.times);
    }
  }

  // 3. Schedule hospital visits
  const schedules = useMedicationStore.getState().hospitalSchedules;
  for (const visit of schedules) {
    if (visit.enabled) {
      await scheduleHospitalNotifications(visit.id, visit.hospitalName, visit.visitDate, visit.visitTime);
    }
  }
}

export async function cancelAllAlarms() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.error("Failed to cancel all local alarms:", err);
  }
}

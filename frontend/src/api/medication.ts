import { getToken } from "./session";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type MedicationReminderReply = {
  reminder_id: string;
  status: "PENDING" | "REMINDER_SCHEDULED" | "COMPLETED";
  reply: string;
};

export async function replyToMedicationReminder(reminderId: string, answer: string) {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/medication/reminders/${reminderId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ answer }),
  });

  if (!response.ok) throw new Error("MEDICATION_REMINDER_REPLY_FAILED");
  return (await response.json()) as MedicationReminderReply;
}

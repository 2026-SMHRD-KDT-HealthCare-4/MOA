import { Alert } from "react-native";
import { getToken } from "./session";

// const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://101.79.22.22";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function safeParseJson<T>(response: Response, pathDescription: string): Promise<T> {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (error) {
    console.error(`API 서버 응답이 JSON 형식이 아닙니다. 경로: ${pathDescription}, HTML 덤프:`, text);
    Alert.alert("서버 오류", "서버가 올바른 응답을 주지 않습니다. 관리자에게 문의하세요.");
    throw new Error("서버 응답 형식이 올바르지 않습니다.");
  }
}

function formatTimeForAPI(t: string): string {
  const trimmed = t.trim();
  if (/^\d:[0-5]\d$/.test(trimmed)) {
    return `0${trimmed}:00`;
  }
  if (/^\d{2}:[0-5]\d$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  return trimmed;
}

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
  return safeParseJson<MedicationReminderReply>(response, `/medication/reminders/${reminderId}/reply [POST]`);
}

export type MedicationResponse = {
  medication_id: string;
  senior_id: string;
  guardian_id: string;
  medicine_name: string;
  intake_time: string; // HH:MM:SS
  start_date: string;  // YYYY-MM-DD
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

export async function createMedication(
  seniorId: string,
  medicineName: string,
  intakeTimes: string[],
  startDate: string,
  endDate: string | null,
  isActive: boolean
): Promise<MedicationResponse[] | MedicationResponse> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/medication`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      senior_id: seniorId,
      medicine_name: medicineName,
      intake_times: intakeTimes.map(formatTimeForAPI),
      start_date: startDate,
      end_date: endDate || null,
      is_active: isActive,
    }),
  });

  if (!response.ok) throw new Error("CREATE_MEDICATION_FAILED");
  return safeParseJson<MedicationResponse[] | MedicationResponse>(response, "/medication [POST]");
}

export async function listMedications(seniorId: string, activeOnly: boolean = false): Promise<MedicationResponse[]> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/medication/senior/${seniorId}?active_only=${activeOnly}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) throw new Error("LIST_MEDICATIONS_FAILED");
  return safeParseJson<MedicationResponse[]>(response, `/medication/senior/${seniorId} [GET]`);
}

export async function updateMedication(
  medicationId: string,
  data: {
    medicine_name?: string;
    intake_time?: string;
    start_date?: string;
    end_date?: string | null;
    is_active?: boolean;
  }
): Promise<MedicationResponse> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/medication/${medicationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...data,
      ...(data.intake_time ? { intake_time: formatTimeForAPI(data.intake_time) } : {}),
    }),
  });

  if (!response.ok) throw new Error("UPDATE_MEDICATION_FAILED");
  return safeParseJson<MedicationResponse>(response, `/medication/${medicationId} [PATCH]`);
}

export async function deleteMedication(medicationId: string): Promise<{ status: string; message: string }> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/medication/${medicationId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) throw new Error("DELETE_MEDICATION_FAILED");
  return safeParseJson<{ status: string; message: string }>(response, `/medication/${medicationId} [DELETE]`);
}


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

export type HospitalVisitResponse = {
  visit_id: string;
  senior_id: string;
  guardian_id: string;
  hospital_name: string;
  visit_date: string;
  visit_time: string;
  memo: string | null;
  is_active: boolean;
  created_at: string;
};

export async function createHospitalVisit(
  seniorId: string,
  hospitalName: string,
  visitDate: string,
  visitTime: string,
  memo?: string,
  isActive: boolean = true
): Promise<HospitalVisitResponse> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/hospital`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      senior_id: seniorId,
      hospital_name: hospitalName,
      visit_date: visitDate,
      visit_time: formatTimeForAPI(visitTime),
      memo: memo || null,
      is_active: isActive,
    }),
  });

  if (!response.ok) throw new Error("CREATE_HOSPITAL_VISIT_FAILED");
  return safeParseJson<HospitalVisitResponse>(response, "/hospital [POST]");
}

export async function listHospitalVisits(seniorId: string, activeOnly: boolean = false): Promise<HospitalVisitResponse[]> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/hospital/senior/${seniorId}?active_only=${activeOnly}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) throw new Error("LIST_HOSPITAL_VISITS_FAILED");
  return safeParseJson<HospitalVisitResponse[]>(response, "/hospital/senior [GET]");
}

export async function updateHospitalVisit(
  visitId: string,
  data: {
    hospital_name?: string;
    visit_date?: string;
    visit_time?: string;
    memo?: string | null;
    is_active?: boolean;
  }
): Promise<HospitalVisitResponse> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/hospital/${visitId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...data,
      ...(data.visit_time ? { visit_time: formatTimeForAPI(data.visit_time) } : {}),
    }),
  });

  if (!response.ok) throw new Error("UPDATE_HOSPITAL_VISIT_FAILED");
  return safeParseJson<HospitalVisitResponse>(response, `/hospital/${visitId} [PATCH]`);
}

export async function deleteHospitalVisit(visitId: string): Promise<{ status: string; message: string }> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/hospital/${visitId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) throw new Error("DELETE_HOSPITAL_VISIT_FAILED");
  return safeParseJson<{ status: string; message: string }>(response, `/hospital/${visitId} [DELETE]`);
}

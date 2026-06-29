import { getToken } from "./session";

// const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://101.79.22.22";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
  return (await response.json()) as HospitalVisitResponse;
}

export async function listHospitalVisits(seniorId: string, activeOnly: boolean = false): Promise<HospitalVisitResponse[]> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/hospital/senior/${seniorId}?active_only=${activeOnly}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) throw new Error("LIST_HOSPITAL_VISITS_FAILED");
  return (await response.json()) as HospitalVisitResponse[];
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
  return (await response.json()) as HospitalVisitResponse;
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
  return (await response.json()) as { status: string; message: string };
}

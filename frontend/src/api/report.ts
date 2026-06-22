// 보호자 리포트 도메인 API.
// trend: 점수 비노출(보호자 안전) 추이 / stats: 해당 월 집계.
// 챗봇 영역과 무관하다.
import { apiFetch } from "./auth";

export type TrendStatus = "sunny" | "cloudy" | "rainy";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  status: TrendStatus;
}

interface TrendDto {
  status: string;
  data: { date: string; status: string; recorded_at: string }[];
}

function normalizeStatus(s: string): TrendStatus {
  return s === "rainy" || s === "cloudy" ? s : "sunny";
}

// GET /report/trend/{seniorId} — 최근 추이(날짜별 상태). 의학 점수는 내려오지 않는다.
export async function getReportTrend(seniorId: string, limit = 7): Promise<TrendPoint[]> {
  const res = await apiFetch<TrendDto>(`/report/trend/${seniorId}?limit=${limit}`, {
    method: "GET",
    auth: true,
  });
  return (res.data ?? []).map((d) => ({ date: d.date, status: normalizeStatus(d.status) }));
}

export interface MonthlyStats {
  measurementCount: number;
  riskAlertCount: number;
}

interface StatsDto {
  stats: { measurement_count: number; chat_session_count: number; risk_alert_count: number };
}

// GET /report/stats — 해당 월 집계(참여수·알림수). avg_risk(의학 점수)는 사용하지 않는다(규칙 6).
export async function getMonthlyStats(seniorId: string, reportMonth: string): Promise<MonthlyStats> {
  const res = await apiFetch<StatsDto>(
    `/report/stats?senior_id=${seniorId}&report_month=${reportMonth}`,
    { method: "GET", auth: true },
  );
  return {
    measurementCount: res.stats.measurement_count,
    riskAlertCount: res.stats.risk_alert_count,
  };
}

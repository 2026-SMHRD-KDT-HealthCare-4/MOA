// 보호자 리포트 도메인 API.
// trend: 점수 비노출(보호자 안전) 추이 / stats: 해당 월 집계.
// 챗봇 영역과 무관하다.
import { apiFetch } from "./auth";

export type TrendStatus = "sunny" | "cloudy" | "rainy";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  status: TrendStatus;
  recordedAt?: string; // ISO datetime — 해당 측정 시각(마지막 활동 시각 산출용)
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
  return (res.data ?? []).map((d) => ({
    date: d.date,
    status: normalizeStatus(d.status),
    recordedAt: d.recorded_at,
  }));
}

export interface MonthlyStats {
  measurementCount: number;
  riskAlertCount: number;
  participatedDays: number; // 체크인 참여 일수(가입일 기준)
  totalDays: number; // 체크인 분모(가입일 기준 경과 일수)
}

interface StatsDto {
  stats: {
    measurement_count: number;
    chat_session_count: number;
    risk_alert_count: number;
    participated_days: number;
    total_days: number;
  };
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
    participatedDays: res.stats.participated_days,
    totalDays: res.stats.total_days,
  };
}

// GET /report/available-months/{seniorId} — 리포트 데이터가 존재하는 월 목록(내림차순).
interface AvailableMonthsDto {
  months: string[];
}
export async function getAvailableMonths(seniorId: string): Promise<string[]> {
  const res = await apiFetch<AvailableMonthsDto>(`/report/available-months/${seniorId}`, {
    method: "GET",
    auth: true,
  });
  return res.months ?? [];
}

// GET /report/alerts/{seniorId}?month= — 해당 월 '변화 감지' 알림 이력(점수·병명 비노출).
export interface ReportAlert {
  date: string;
  text: string;
}
interface AlertsDto {
  alerts: ReportAlert[];
}
export async function getReportAlerts(seniorId: string, reportMonth: string): Promise<ReportAlert[]> {
  const res = await apiFetch<AlertsDto>(`/report/alerts/${seniorId}?month=${reportMonth}`, {
    method: "GET",
    auth: true,
  });
  return res.alerts ?? [];
}

// GET /report/patterns/{seniorId}?month= — '이번 달 주목할 변화'(음성 영역별 관찰).
// 질환 점수가 아니라 음향 피처의 월별 변화를 요약한 값이다(점수·병명 비노출).
export interface VoicePatternItem {
  area: string;
  status: "normal" | "caution";
  text: string;
}
interface PatternsDto {
  patterns: { area: string; status: string; text: string }[];
}
export async function getReportPatterns(
  seniorId: string,
  reportMonth: string,
): Promise<VoicePatternItem[]> {
  const res = await apiFetch<PatternsDto>(`/report/patterns/${seniorId}?month=${reportMonth}`, {
    method: "GET",
    auth: true,
  });
  return (res.patterns ?? []).map((p) => ({
    area: p.area,
    status: p.status === "caution" ? "caution" : "normal",
    text: p.text,
  }));
}

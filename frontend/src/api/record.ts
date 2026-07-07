// 낭독 기록(SCRIPT_RECORD) 저장 + 음성 분석(/analyze) API. 녹음 화면(RecordPage) 전용.
// 오늘의 지정문구 조회는 auth.ts의 getTodayScript 사용.
import { Platform, Alert } from "react-native";
import { apiFetch } from "./auth";
import { getToken } from "./session";

// const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://101.79.22.22").replace(
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

export interface ScriptRecord {
  recordId: string;
  measuredAt: string;
}

interface ScriptRecordResponseDto {
  record_id: string;
  senior_id: string;
  script_id: string;
  measured_at: string;
  created_at: string;
}

// POST /record/script-record — 지정문구 낭독 기록을 저장한다(직접사용자 본인만).
// 서버가 토큰의 senior_id를 사용하지만 요청 스키마상 senior_id 필드가 필수다.
export async function saveScriptRecord(scriptId: string, seniorId: string): Promise<ScriptRecord> {
  const res = await apiFetch<ScriptRecordResponseDto>("/record/script-record", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ 
      script_id: scriptId,
      senior_id: seniorId
    }),
  });
  return { recordId: res.record_id, measuredAt: res.measured_at };
}

// GET /record/script-record/{seniorId} — 지정문구 낭독 측정 이력(최근 30건).
// 본인 또는 연동 보호자만. 원본 음성은 저장되지 않으므로 측정 시각만 내려온다(ZDR).
export async function listScriptRecords(seniorId: string): Promise<ScriptRecord[]> {
  const res = await apiFetch<ScriptRecordResponseDto[]>(`/record/script-record/${seniorId}`, {
    method: "GET",
    auth: true,
  });
  return (res ?? []).map((r) => ({ recordId: r.record_id, measuredAt: r.measured_at }));
}

// 녹음 직후 피드백용 분석 요약 — 날씨/직전 비교는 백엔드 단일 소스(weather_status)에서 산출.
// 수치/점수는 직접사용자 화면 노출 금지(규칙6)라 의도적으로 반환하지 않는다.
export type VoiceWeather = "sunny" | "cloudy" | "rainy";
export type VoiceComparison = "first" | "similar" | "changed";
export interface AnalyzeResult {
  status: VoiceWeather | null;
  comparison: VoiceComparison | null;
}

// POST /analyze — 녹음 음성을 멀티파트로 전송해 음성 특징/위험도를 서버에 저장한다.
// multipart라 apiFetch(JSON 전용) 대신 직접 fetch. 업로드 후 사용 측에서 오디오를 즉시 해제해야 함(ZDR).
export async function analyzeVoice(
  audioUri: string,
  collectType: "SCRIPT" | "CHATBOT",
  sampleType?: "free_speech_intro" | "sustained_vowel" | "normal_chat",
  sampleStatus?: "ok" | "too_short" | "failed",
): Promise<AnalyzeResult> {
  const form = new FormData();
  form.append("collect_type", collectType);
  if (sampleType) form.append("sample_type", sampleType);
  if (sampleStatus) form.append("sample_status", sampleStatus);
  if (Platform.OS === "web") {
    const blob = await (await fetch(audioUri)).blob();
    form.append("file", blob, "recording.webm");
  } else {
    // RN FormData는 { uri, type, name } 객체를 파일처럼 처리한다.
    form.append("file", { uri: audioUri, type: "audio/m4a", name: "recording.m4a" } as unknown as Blob);
  }

  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    // Content-Type은 지정하지 않는다 — 브라우저가 multipart boundary를 자동 설정.
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error("ANALYZE_FAILED");
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    console.error("API 서버 응답이 JSON 형식이 아닙니다. 경로: /analyze, HTML 덤프:", text);
    Alert.alert("서버 오류", "서버가 올바른 응답을 주지 않습니다. 관리자에게 문의하세요.");
    throw new Error("서버 응답 형식이 올바르지 않습니다.");
  }
  return { status: json.status ?? null, comparison: json.comparison ?? null };
}

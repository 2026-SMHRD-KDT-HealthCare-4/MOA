// 낭독 기록(SCRIPT_RECORD) 저장 + 음성 분석(/analyze) API. 녹음 화면(RecordPage) 전용.
// 오늘의 지정문구 조회는 auth.ts의 getTodayScript 사용.
import { Platform } from "react-native";
import { apiFetch } from "./auth";
import { getToken } from "./session";

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://101.79.22.22").replace(
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
    body: JSON.stringify({ senior_id: seniorId, script_id: scriptId }),
  });
  return { recordId: res.record_id, measuredAt: res.measured_at };
}

// POST /analyze — 녹음 음성을 멀티파트로 전송해 음성 특징/위험도를 서버에 저장한다.
// multipart라 apiFetch(JSON 전용) 대신 직접 fetch. 업로드 후 사용 측에서 오디오를 즉시 해제해야 함(ZDR).
export async function analyzeVoice(
  audioUri: string,
  collectType: "SCRIPT" | "CHATBOT",
  sampleType?: "free_speech_intro" | "sustained_vowel" | "normal_chat",
  sampleStatus?: "ok" | "too_short" | "failed",
): Promise<void> {
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
}

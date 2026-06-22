// 지정문구(SCRIPT) / 낭독 기록 도메인 API.
// 녹음 화면(RecordPage) 전용 — 챗봇 영역과 무관하다.
import { apiFetch } from "./auth";

export interface TodayScript {
  scriptId: string;
  content: string;
}

interface ScriptResponseDto {
  script_id: string;
  content: string;
  created_at: string;
}

// GET /record/script/today — 오늘 배정된 지정문구를 가져온다(인증 필요).
export async function getTodayScript(): Promise<TodayScript> {
  const res = await apiFetch<ScriptResponseDto>("/record/script/today", {
    method: "GET",
    auth: true,
  });
  return { scriptId: res.script_id, content: res.content };
}

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

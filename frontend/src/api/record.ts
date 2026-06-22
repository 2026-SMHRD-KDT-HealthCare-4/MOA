// 낭독 기록(SCRIPT_RECORD) 저장 API. 녹음 화면(RecordPage) 전용 — 챗봇 영역과 무관.
// 오늘의 지정문구 조회는 auth.ts의 getTodayScript 사용.
import { apiFetch } from "./auth";

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

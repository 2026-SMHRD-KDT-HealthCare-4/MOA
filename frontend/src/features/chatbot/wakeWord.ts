export interface WakeWordMatch {
  detected: boolean;
  remainder: string;
}

const WAKE_WORD_PATTERN = /(^|\s)(모아야|모아)(?=\s|[,.!?]|$)/;

/** Rule-based call-word detection that always runs before an LLM request. */
export function detectWakeWord(text: string): WakeWordMatch {
  const trimmed = text.trim();
  const prefix = /^(모아야|모아)\s*/.exec(trimmed);
  const match = prefix ?? WAKE_WORD_PATTERN.exec(trimmed);
  if (!match || match.index === undefined) return { detected: false, remainder: trimmed };

  const wakeWord = match[match.length - 1];
  const start = match.index + match[0].length;
  const remainder = `${trimmed.slice(0, match.index)} ${trimmed.slice(start)}`
    .replace(wakeWord, "")
    .replace(/^[\s,，.!?]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return { detected: true, remainder };
}

export type VoiceCommand = "record" | "history" | "result" | null;

/** Commands are routed without asking the LLM to determine intent. */
export function detectVoiceCommand(text: string): VoiceCommand {
  const normalized = text.replace(/\s+/g, "").trim();
  if (/(녹음하러|녹음하자|녹음페이지|녹음하기)/.test(normalized)) return "record";
  if (/(기록보러|기록보자|기록페이지|기록보여|기록확인|기록으로가)/.test(normalized)) return "history";
  if (/(결과보여|결과페이지|분석결과|리포트보여)/.test(normalized)) return "result";
  return null;
}

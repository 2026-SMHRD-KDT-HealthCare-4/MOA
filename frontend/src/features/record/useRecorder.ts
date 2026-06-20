import { useState, useRef } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useWakeWordStore } from "../../stores/wakeWordStore";
import { getToken } from "../../api/session";

export type RecordState = "idle" | "recording" | "processing" | "done";

interface RecorderOptions {
  /** 대화 모드에서는 짧은 무음 뒤 한 발화를 자동 전송한다. */
  autoStopOnSilence?: boolean;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const MOCK_TRANSCRIPT =
  "오늘 날씨가 맑고 기분이 좋아요. 아침에 일어나서 산책도 하고 밥도 잘 먹었어요.";

async function whisperSTT(uri: string): Promise<string> {
  async function createFormData() {
    const form = new FormData();

    if (Platform.OS === "web") {
      const res = await fetch(uri);
      const blob = await res.blob();
      form.append("file", blob, "recording.webm");
    } else {
      // React Native FormData는 { uri, type, name } 객체를 Blob처럼 처리
      form.append("file", {
        uri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as unknown as Blob);
    }

    return form;
  }

  const token = await getToken();
  try {
    const response = await fetch(`${API_BASE_URL}/speech/transcribe`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: await createFormData(),
    });
    if (response.ok) {
      const data = (await response.json()) as { text?: string };
      return data.text ?? "";
    }
  } catch {
    // 개발 환경 또는 서버 연결 실패 시 기존 직접 호출 경로로 이어진다.
  }

  if (!OPENAI_API_KEY) return MOCK_TRANSCRIPT;

  const form = await createFormData();
  form.append("model", "whisper-1");
  form.append("language", "ko");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!response.ok) throw new Error("STT_FAILED");

  const data = (await response.json()) as { text?: string };
  return data.text ?? "";
}

export function useRecorder({ autoStopOnSilence = false }: RecorderOptions = {}) {
  const [state, setState] = useState<RecordState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSpeechAtRef = useRef(0);
  const autoStoppingRef = useRef(false);

  // FR-10: UC-01a 세션 진입/이탈 시 호출어 감지 on/off
  const { disable: disableWakeWord, enable: enableWakeWord } = useWakeWordStore();

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function start() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== "granted") {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      setError(null);
      disableWakeWord(); // UC-01a 시작 — 호출어 감지 중단

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      lastSpeechAtRef.current = 0;
      autoStoppingRef.current = false;
      recording.setProgressUpdateInterval(200);
      recording.setOnRecordingStatusUpdate((status) => {
        if (!autoStopOnSilence || autoStoppingRef.current || !status.isRecording) return;

        const duration = status.durationMillis;
        const metering = status.metering;
        // Native에서는 실제 dBFS 값을 사용한다. 웹 expo-av는 metering을 제공하지 않아
        // 한 발화의 최대 길이로만 자동 전송한다.
        if (typeof metering === "number" && metering > -45) {
          lastSpeechAtRef.current = duration;
        }

        const silenceElapsed = duration - lastSpeechAtRef.current;
        const shouldCommitFromSilence =
          typeof metering === "number" && duration >= 1000 && lastSpeechAtRef.current > 0 && silenceElapsed >= 1100;
        const fallbackTurnLimit = typeof metering === "number" ? 20000 : 7000;

        if (shouldCommitFromSilence || duration >= fallbackTurnLimit) {
          autoStoppingRef.current = true;
          void stop();
        }
      });
      setDurationMs(0);
      setState("recording");

      timerRef.current = setInterval(() => {
        setDurationMs((prev) => prev + 1000);
      }, 1000);
    } catch {
      enableWakeWord();
      setError("마이크를 시작하지 못했어요. 권한과 기기 연결을 확인해 주세요.");
      setState("idle");
    }
  }

  async function stop() {
    if (!recordingRef.current) return;
    clearTimer();
    setState("processing");

    const recording = recordingRef.current;
    recordingRef.current = null;
    autoStoppingRef.current = false;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      if (!uri) throw new Error("NO_URI");

      const text = await whisperSTT(uri);

      // 원시 음성 즉시 해제 (개인정보 원칙)
      if (Platform.OS !== "web") {
        await FileSystem.deleteAsync(uri); // v18+: options 없이 항상 idempotent
      }

      setTranscript(text);
      setState("done");
      enableWakeWord(); // UC-01a 종료 — 호출어 감지 재개
    } catch {
      enableWakeWord();
      setError("목소리를 글로 바꾸지 못했어요. 잠시 후 다시 말씀해 주세요.");
      setState("idle");
    }
  }

  function reset() {
    clearTimer();
    setTranscript(null);
    setDurationMs(0);
    setPermissionDenied(false);
    setError(null);
    autoStoppingRef.current = false;
    setState("idle");
    enableWakeWord();
  }

  return { state, transcript, durationMs, permissionDenied, error, start, stop, reset };
}

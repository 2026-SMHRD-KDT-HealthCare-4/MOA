import { useState, useRef } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useWakeWordStore } from "../../stores/wakeWordStore";

export type RecordState = "idle" | "recording" | "processing" | "done";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const MOCK_TRANSCRIPT =
  "오늘 날씨가 맑고 기분이 좋아요. 아침에 일어나서 산책도 하고 밥도 잘 먹었어요.";

async function whisperSTT(uri: string): Promise<string> {
  if (!OPENAI_API_KEY) return MOCK_TRANSCRIPT;

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

export function useRecorder() {
  const [state, setState] = useState<RecordState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // FR-10: UC-01a 세션 진입/이탈 시 호출어 감지 on/off
  const { disable: disableWakeWord, enable: enableWakeWord } = useWakeWordStore();

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function start() {
    const perm = await Audio.requestPermissionsAsync();
    if (perm.status !== "granted") {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    disableWakeWord(); // UC-01a 시작 — 호출어 감지 중단

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setDurationMs(0);
    setState("recording");

    timerRef.current = setInterval(() => {
      setDurationMs((prev) => prev + 1000);
    }, 1000);
  }

  async function stop() {
    if (!recordingRef.current) return;
    clearTimer();
    setState("processing");

    const recording = recordingRef.current;
    recordingRef.current = null;

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
      setState("idle");
    }
  }

  function reset() {
    clearTimer();
    setTranscript(null);
    setDurationMs(0);
    setPermissionDenied(false);
    setState("idle");
    enableWakeWord();
  }

  return { state, transcript, durationMs, permissionDenied, start, stop, reset };
}

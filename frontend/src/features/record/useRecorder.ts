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
  /** False for the global wake listener, which must not disable itself. */
  manageWakeWord?: boolean;
}

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const MOCK_TRANSCRIPT =
  "오늘 날씨가 맑고 기분이 좋아요. 아침에 일어나서 산책도 하고 밥도 잘 먹었어요.";
const MAX_RECORDING_DURATION_MS = 30_000;

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
  const hasRealSession = Boolean(token && !token.startsWith("mock-token-"));
  if (hasRealSession) {
    try {
      const response = await fetch(`${API_BASE_URL}/speech/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: await createFormData(),
      });
      if (response.ok) {
        const data = (await response.json()) as { text?: string };
        return data.text ?? "";
      }
    } catch {
      // 서버 연결 실패 시 개발용 직접 호출 경로로 이어진다.
    }
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

export function useRecorder({ autoStopOnSilence = false, manageWakeWord = true }: RecorderOptions = {}) {
  const [state, setState] = useState<RecordState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const autoStoppingRef = useRef(false);
  const webAudioContextRef = useRef<AudioContext | null>(null);
  const webSilenceStreamRef = useRef<MediaStream | null>(null);
  const webSilenceFrameRef = useRef<number | null>(null);

  function stopWebSilenceMonitor(stopTracks = true) {
    if (webSilenceFrameRef.current !== null) {
      cancelAnimationFrame(webSilenceFrameRef.current);
      webSilenceFrameRef.current = null;
    }
    if (stopTracks) webSilenceStreamRef.current?.getTracks().forEach((track) => track.stop());
    webSilenceStreamRef.current = null;
    void webAudioContextRef.current?.close();
    webAudioContextRef.current = null;
  }

  function startWebSilenceMonitor(stream: MediaStream) {
    if (!autoStopOnSilence || Platform.OS !== "web") return;

    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);

      const samples = new Uint8Array(analyser.fftSize);
      const startedAt = Date.now();
      let heardSpeech = false;
      let lastSpeechAt = Date.now();

      webSilenceStreamRef.current = stream;
      webAudioContextRef.current = context;

      const monitor = () => {
        if (autoStoppingRef.current || (!recordingRef.current && !webRecorderRef.current)) return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / samples.length);
        const now = Date.now();

        if (rms > 0.018) {
          heardSpeech = true;
          lastSpeechAt = now;
        }

        // 최소 700ms의 발화 뒤 900ms 조용하면 한 문장으로 확정한다.
        if (heardSpeech && now - lastSpeechAt >= 900 && now - startedAt >= 700) {
          autoStoppingRef.current = true;
          void stop();
          return;
        }

        webSilenceFrameRef.current = requestAnimationFrame(monitor);
      };
      webSilenceFrameRef.current = requestAnimationFrame(monitor);
    } catch {
      // expo-av의 녹음은 계속 유지한다. 웹 VAD만 사용할 수 없는 상태다.
    }
  }

  async function completeTranscription(uri: string, isWeb = false) {
    try {
      const text = await whisperSTT(uri);
      if (!isWeb) await FileSystem.deleteAsync(uri);
      setTranscript(text);
      setState("done");
      if (manageWakeWord) enableWakeWord();
    } catch {
      if (manageWakeWord) enableWakeWord();
      setError("목소리를 글로 바꾸지 못했어요. 잠시 후 다시 말씀해 주세요.");
      setState("idle");
    }
  }

  // FR-10: UC-01a 세션 진입/이탈 시 호출어 감지 on/off
  const { disable: disableWakeWord, enable: enableWakeWord } = useWakeWordStore();

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
  }

  function startDurationTimer() {
    recordingStartedAtRef.current = Date.now();
    const updateDuration = () => {
      setDurationMs(Math.min(Date.now() - recordingStartedAtRef.current, MAX_RECORDING_DURATION_MS));
    };

    updateDuration();
    // 100ms 단위 갱신으로 SVG 링이 30초 동안 자연스럽게 채워진다.
    timerRef.current = setInterval(updateDuration, 100);
    maxDurationTimeoutRef.current = setTimeout(() => {
      setDurationMs(MAX_RECORDING_DURATION_MS);
      void stop();
    }, MAX_RECORDING_DURATION_MS);
  }

  async function start() {
    try {
      if (Platform.OS === "web") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        webRecorderRef.current = recorder;
        webChunksRef.current = [];
        lastSpeechAtRef.current = 0;
        autoStoppingRef.current = false;
        setPermissionDenied(false);
        setError(null);
        if (manageWakeWord) disableWakeWord();

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) webChunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(webChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const uri = URL.createObjectURL(blob);
          stream.getTracks().forEach((track) => track.stop());
          webRecorderRef.current = null;
          void completeTranscription(uri, true).finally(() => URL.revokeObjectURL(uri));
        };

        recorder.start(250);
        setDurationMs(0);
        setState("recording");
        startDurationTimer();
        startWebSilenceMonitor(stream);
        return;
      }

      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== "granted") {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      setError(null);
      if (manageWakeWord) disableWakeWord(); // UC-01a 시작 — 호출어 감지 중단

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
        // Native에서는 실제 dBFS 값을 사용한다. 웹은 별도 Web Audio VAD를 사용한다.
        if (typeof metering === "number" && metering > -45) {
          lastSpeechAtRef.current = duration;
        }

        const silenceElapsed = duration - lastSpeechAtRef.current;
        const shouldCommitFromSilence =
          typeof metering === "number" && duration >= 1000 && lastSpeechAtRef.current > 0 && silenceElapsed >= 1100;
        const fallbackTurnLimit = 30000;

        if (shouldCommitFromSilence || duration >= fallbackTurnLimit) {
          autoStoppingRef.current = true;
          void stop();
        }
      });
      setDurationMs(0);
      setState("recording");

      startDurationTimer();

    } catch {
      if (manageWakeWord) enableWakeWord();
      setError("마이크를 시작하지 못했어요. 권한과 기기 연결을 확인해 주세요.");
      setState("idle");
    }
  }

  async function stop() {
    if (webRecorderRef.current) {
      clearTimer();
      stopWebSilenceMonitor(false);
      setState("processing");
      webRecorderRef.current.stop();
      return;
    }
    if (!recordingRef.current) return;
    clearTimer();
    stopWebSilenceMonitor();
    setState("processing");

    const recording = recordingRef.current;
    recordingRef.current = null;
    autoStoppingRef.current = false;

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      if (!uri) throw new Error("NO_URI");

      await completeTranscription(uri);
    } catch {
      if (manageWakeWord) enableWakeWord();
      setError("녹음을 마치지 못했어요. 잠시 후 다시 말씀해 주세요.");
      setState("idle");
    }
  }

  function reset() {
    clearTimer();
    stopWebSilenceMonitor();
    // 화면 전환/호출어 대기 해제 시 네이티브 녹음도 즉시 종료한다.
    // 그렇지 않으면 탭이 메모리에 남아 있는 동안 마이크가 계속 켜질 수 있다.
    if (recordingRef.current) {
      const recording = recordingRef.current;
      recordingRef.current = null;
      void recording.stopAndUnloadAsync().catch(() => undefined);
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    }
    if (webRecorderRef.current?.state === "recording") {
      webRecorderRef.current.onstop = null;
      webRecorderRef.current.stop();
      webRecorderRef.current = null;
    }
    setTranscript(null);
    setDurationMs(0);
    setPermissionDenied(false);
    setError(null);
    autoStoppingRef.current = false;
    setState("idle");
    if (manageWakeWord) enableWakeWord();
  }

  return { state, transcript, durationMs, permissionDenied, error, start, stop, reset };
}

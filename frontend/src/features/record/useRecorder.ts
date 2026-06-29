import { useState, useRef } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useWakeWordStore } from "../../stores/wakeWordStore";
import { getAuthApiMode } from "../../api/auth";
import { getToken } from "../../api/session";

export type RecordState = "idle" | "recording" | "processing" | "done";

interface RecorderOptions {
  /** 대화 모드에서는 짧은 무음 뒤 한 발화를 자동 전송한다. */
  autoStopOnSilence?: boolean;
  /** False for the global wake listener, which must not disable itself. */
  manageWakeWord?: boolean;
  /**
   * STT 후 녹음 오디오를 폐기하지 않고 보관해 `audioUri`로 노출한다(기본 false).
   * /analyze 전송용. 사용 측은 업로드 직후 반드시 clearAudio()로 해제해야 한다(ZDR).
   * 옵션을 켜지 않으면 기존과 동일하게 STT 직후 즉시 폐기된다.
   */
  keepAudio?: boolean;
  /** 챗봇 단일 파이프라인 통합을 위해 프론트 STT 처리를 건너뛰고 파일만 수집할지 여부 */
  skipSTT?: boolean;
}

// const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://101.79.22.22").replace(
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

const MAX_RECORDING_DURATION_MS = 8_000;
const NO_SPEECH_TIMEOUT_MS = 6_000;

// 한국어 Whisper는 무음·잡음 구간에서 학습 데이터에 흔하던 방송 클로징/자막 문구를
// 실제 발화처럼 만들어낸다("지금까지 ○○기자였습니다", "MBC 뉴스입니다",
// "시청해주셔서 감사합니다", "구독과 좋아요" 등). 사용자가 말하지 않았는데 이런
// 문장이 잡히면 발화로 처리하지 않고 무발화(no-speech)로 돌린다.
const HALLUCINATION_PATTERNS: RegExp[] = [
  /(MBC|KBS|SBS|YTN|JTBC|TV\s*조선|채널\s*A|연합뉴스)/i,
  /뉴스\s*(입니다|였습니다|데스크|룸)/,
  /기자\s*(입니다|였습니다)/,
  /앵커/,
  /시청\s*(해|해주|해 주)/,
  /구독|좋아요|알림\s*설정/,
  /(자막|번역)\s*(제공|제작|by)/i,
  /한글\s*자막/,
  /다음\s*(영상|시간)에서\s*(만나|뵙)/,
  /오늘도\s*(함께|시청)/,
];

function isWhisperHallucination(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  return HALLUCINATION_PATTERNS.some((pattern) => pattern.test(text));
}

async function whisperSTT(uri: string): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("STT_AUTH_TOKEN_MISSING");

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

  const response = await fetch(`${API_BASE_URL}/speech/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`STT_BACKEND_FAILED_${response.status}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text ?? "";
}

export function useRecorder({
  autoStopOnSilence = false,
  manageWakeWord = true,
  keepAudio = false,
  skipSTT = false,
}: RecorderOptions = {}) {
  const [state, setState] = useState<RecordState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noSpeechDetected, setNoSpeechDetected] = useState(false);
  // keepAudio=true일 때만 채워진다. 그 외에는 항상 null (기존 동작 유지).
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const keptAudioRef = useRef<{ uri: string; isWeb: boolean } | null>(null);

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
        console.log("[VAD] rms:", rms.toFixed(4));
        const now = Date.now();

        if (rms > 0.035) {
          heardSpeech = true;
          lastSpeechAt = now;
          lastSpeechAtRef.current = now - startedAt;
        }

        // 최소 700ms의 발화 뒤 900ms 조용하면 한 문장으로 확정한다.
        if (heardSpeech && now - lastSpeechAt >= 700 && now - startedAt >= 900) {
          autoStoppingRef.current = true;
          void finishRecording();
          return;
        }

        webSilenceFrameRef.current = requestAnimationFrame(monitor);
      };
      webSilenceFrameRef.current = requestAnimationFrame(monitor);
    } catch {
      // expo-av의 녹음은 계속 유지한다. 웹 VAD만 사용할 수 없는 상태다.
    }
  }

  // keepAudio로 보관된 오디오를 해제한다(ZDR). 사용 측이 업로드 후 호출.
  async function clearAudio() {
    const kept = keptAudioRef.current;
    keptAudioRef.current = null;
    setAudioUri(null);
    if (!kept) return;
    try {
      if (kept.isWeb) URL.revokeObjectURL(kept.uri);
      else await FileSystem.deleteAsync(kept.uri, { idempotent: true });
    } catch {
      // 해제 실패는 무시
    }
  }

  async function completeTranscription(uri: string, isWeb = false) {
    if (skipSTT) {
      if (keepAudio) {
        keptAudioRef.current = { uri, isWeb };
        setAudioUri(uri);
      }
      setTranscript("");
      setState("done");
      if (manageWakeWord) enableWakeWord();
      return;
    }
    try {
      const text = (await whisperSTT(uri)).trim();

      // 무음/잡음 구간의 Whisper 환각이나 빈 결과는 발화로 처리하지 않고
      // 무발화(no-speech) 경로로 보낸다 → ChatbotMain이 재안내/종료를 담당한다.
      if (!text || isWhisperHallucination(text)) {
        if (!isWeb) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }

        setTranscript(null);
        setNoSpeechDetected(true);
        setState("idle");

        if (manageWakeWord) {
          enableWakeWord();
        }

        setTimeout(() => {
          setNoSpeechDetected(false);
        }, 3000);

        return;
      }

      if (keepAudio) {
        // 폐기하지 않고 보관 → audioUri로 노출 (해제는 clearAudio가 담당)
        keptAudioRef.current = { uri, isWeb };
        setAudioUri(uri);
      } else if (!isWeb) {
        await FileSystem.deleteAsync(uri);
      }
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
    const timeoutMs =
    autoStopOnSilence
        ? NO_SPEECH_TIMEOUT_MS
        : MAX_RECORDING_DURATION_MS;
    maxDurationTimeoutRef.current = setTimeout(() => {
      setDurationMs(timeoutMs);
      void finishRecording(autoStopOnSilence && lastSpeechAtRef.current === 0);
    }, timeoutMs);
  }

  async function start() {
    try {
      if (Platform.OS === "web") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
        });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        webRecorderRef.current = recorder;
        webChunksRef.current = [];
        lastSpeechAtRef.current = 0;
        autoStoppingRef.current = false;
        setNoSpeechDetected(false);
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
          void completeTranscription(uri, true).finally(() => {
            // keepAudio면 보관해야 하므로 여기서 revoke하지 않는다(clearAudio가 해제).
            if (!keepAudio) URL.revokeObjectURL(uri);
          });
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
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          // Native VAD needs metering; without it foreground wake listening waits for the 30s limit.
          isMeteringEnabled: true,
        },
      );
      recordingRef.current = recording;
      lastSpeechAtRef.current = 0;
      autoStoppingRef.current = false;
      setNoSpeechDetected(false);
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
          typeof metering === "number" &&
          duration >= 1000 &&
          lastSpeechAtRef.current > 0 &&
          silenceElapsed >= 1000;
        const fallbackTurnLimit = 30000;

        if (shouldCommitFromSilence || duration >= fallbackTurnLimit) {
          autoStoppingRef.current = true;
          void finishRecording();
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

  async function finishRecording(discardSilence = false) {
    if (webRecorderRef.current) {
      clearTimer();
      stopWebSilenceMonitor(discardSilence);
      setState("processing");
      if (discardSilence) {
        webRecorderRef.current.onstop = null;
        webRecorderRef.current.stop();
        webRecorderRef.current = null;
        setTranscript(null);
        setNoSpeechDetected(true);
        setState("idle");
        if (manageWakeWord) enableWakeWord();
        return;
      }
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

      if (discardSilence) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        setTranscript(null);
        setNoSpeechDetected(true);
        setState("idle");

        setTimeout(() => {
          setNoSpeechDetected(false);
        }, 3000);
        if (manageWakeWord) enableWakeWord();
        return;
      }

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
    void clearAudio();
    setTranscript(null);
    setNoSpeechDetected(false);
    setDurationMs(0);
    setPermissionDenied(false);
    setError(null);
    autoStoppingRef.current = false;
    setState("idle");
    if (manageWakeWord) enableWakeWord();
  }

  return {
    state,
    transcript,
    durationMs,
    permissionDenied,
    error,
    noSpeechDetected,
    start,
    stop: () => finishRecording(),
    reset,
    audioUri,
    clearAudio,
  };
}

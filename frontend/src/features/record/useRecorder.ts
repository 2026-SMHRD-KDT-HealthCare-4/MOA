import { useState, useRef } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
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
  /** 최대 녹음 제한 시간 (ms 단위) */
  maxDurationMs?: number;
  /** 정밀 오디오 분석을 위해 에코 캔슬 및 노이즈 제거를 끌지 여부 (기본 false) */
  disableEchoCancellation?: boolean;
}

// const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://101.79.22.22").replace(
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

const MAX_RECORDING_DURATION_MS = 8_000;
const NO_SPEECH_TIMEOUT_MS = 6_000;
const WEB_SPEECH_DELTA_MAX_MS = 250;
const MOBILE_SPEECH_DELTA_MAX_MS = 350;

// expo-audio 녹음 옵션: HIGH_QUALITY 프리셋 + 미터링(발화 감지용) 활성화.
const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

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
  maxDurationMs,
  disableEchoCancellation = false,
}: RecorderOptions = {}) {
  const [state, setState] = useState<RecordState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noSpeechDetected, setNoSpeechDetected] = useState(false);
  const [speechDetectedDuringRecording, setSpeechDetectedDuringRecording] = useState(false);
  const [detectedSpeechDurationMs, setDetectedSpeechDurationMs] = useState(0);
  // keepAudio=true일 때만 채워진다. 그 외에는 항상 null (기존 동작 유지).
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const keptAudioRef = useRef<{ uri: string; isWeb: boolean } | null>(null);

  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const nativeRecordingRef = useRef(false);
  const meteringPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const previousSpeechDetectedAtRef = useRef<number | null>(null);
  const detectedSpeechDurationMsRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const autoStoppingRef = useRef(false);
  const webAudioContextRef = useRef<AudioContext | null>(null);
  const webSilenceStreamRef = useRef<MediaStream | null>(null);
  const webSilenceFrameRef = useRef<number | null>(null);
  const silenceTimeoutMsRef = useRef<number | null>(null);

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

  function startWebSilenceMonitor(
    stream: MediaStream,
    disableVAD = false,
    rawAudio = false,
    thresholdOverride?: number,
  ) {
    if (!autoStopOnSilence || disableVAD || Platform.OS !== "web") return;

    // raw(지속모음) 입력은 자동게인이 꺼져 있어 조용한 화자의 RMS가 낮게 잡히고,
    // 노이즈억제로 인한 게이팅도 없으므로 발화 감지 임계값을 낮춰 감지 실패를 막는다.
    // 호출 측이 임계값을 넘기면(지속모음 재시도 시 점진 하향) 그 값을 우선한다.
    const speechRmsThreshold = thresholdOverride ?? (rawAudio ? 0.02 : 0.035);

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
        if (autoStoppingRef.current || (!nativeRecordingRef.current && !webRecorderRef.current)) return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / samples.length);
        console.log("[VAD] rms:", rms.toFixed(4));
        const now = Date.now();

        if (rms > speechRmsThreshold) {
          heardSpeech = true;
          setSpeechDetectedDuringRecording(true);
          lastSpeechAt = now;
          lastSpeechAtRef.current = now - startedAt;
          if (previousSpeechDetectedAtRef.current !== null) {
            const delta = lastSpeechAtRef.current - previousSpeechDetectedAtRef.current;
            if (delta > 0 && delta <= WEB_SPEECH_DELTA_MAX_MS) {
              detectedSpeechDurationMsRef.current += delta;
              setDetectedSpeechDurationMs(detectedSpeechDurationMsRef.current);
            }
          }
          previousSpeechDetectedAtRef.current = lastSpeechAtRef.current;
        }

        const webSilenceThreshold = silenceTimeoutMsRef.current ?? 1500;
        const webSpeechDurationThreshold = Math.max(700, webSilenceThreshold - 200);

        if (heardSpeech && now - lastSpeechAt >= webSpeechDurationThreshold && now - startedAt >= webSilenceThreshold) {
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
    const limitMs = maxDurationMs ?? MAX_RECORDING_DURATION_MS;
    const updateDuration = () => {
      setDurationMs(Math.min(Date.now() - recordingStartedAtRef.current, limitMs));
    };

    updateDuration();
    // 100ms 단위 갱신으로 SVG 링이 30초 동안 자연스럽게 채워진다.
    timerRef.current = setInterval(updateDuration, 100);
    const timeoutMs =
    autoStopOnSilence
        ? NO_SPEECH_TIMEOUT_MS
        : limitMs;
    maxDurationTimeoutRef.current = setTimeout(() => {
      setDurationMs(timeoutMs);
      void finishRecording(autoStopOnSilence && lastSpeechAtRef.current === 0);
    }, timeoutMs);
  }

  // rawAudio=true: 지속모음('아…') 분석·감지 전용. 노이즈억제/자동게인을 끄고
  // 순수(raw) 마이크 입력을 받는다. 안드로이드 크롬(갤럭시)의 공격적인 WebRTC
  // 노이즈 억제가 일정한 지속모음을 배경소음으로 보고 깎아내려 RMS가 VAD 임계값
  // 밑으로 떨어져 '못 알아듣는' 문제를 막고, 동시에 가공 안 된 원본이라 음성분석
  // 품질도 올라간다. 대화 녹음(팀원 로직)에는 영향을 주지 않는다.
  // speechRmsThreshold: 발화 감지 RMS 임계값을 호출 측에서 덮어쓴다(web VAD 전용).
  // 지속모음 재시도 때 임계값을 점차 낮춰 감지가 더 쉽게 통과되도록 쓰인다.
  // 넘기지 않으면 rawAudio 여부에 따른 기본값을 사용한다.
  async function start(
    silenceTimeoutMs?: number,
    disableVAD = false,
    rawAudio = false,
    speechRmsThreshold?: number,
  ) {
    silenceTimeoutMsRef.current = silenceTimeoutMs ?? null;
    try {
      if (Platform.OS === "web") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: rawAudio
            ? {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : {
                echoCancellation: !disableEchoCancellation,
                noiseSuppression: !disableEchoCancellation,
                autoGainControl: true,
              },
        });
        
        let mimeType = "audio/webm";
        if (typeof MediaRecorder.isTypeSupported === "function") {
          if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            mimeType = "audio/webm;codecs=opus";
          } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
          } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
            mimeType = "audio/ogg;codecs=opus";
          } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          } else if (MediaRecorder.isTypeSupported("audio/aac")) {
            mimeType = "audio/aac";
          }
        }
        const recorder = new MediaRecorder(stream, { mimeType });
        webRecorderRef.current = recorder;
        webChunksRef.current = [];
        previousSpeechDetectedAtRef.current = null;
        detectedSpeechDurationMsRef.current = 0;
        lastSpeechAtRef.current = 0;
        autoStoppingRef.current = false;
        setSpeechDetectedDuringRecording(false);
        setDetectedSpeechDurationMs(0);
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
            if (!keepAudio) URL.revokeObjectURL(uri);
          });
        };

        recorder.start(250);
        setDurationMs(0);
        setState("recording");
        startDurationTimer();
        startWebSilenceMonitor(stream, disableVAD, rawAudio, speechRmsThreshold);
        return;
      }

      const perm = await requestRecordingPermissionsAsync();
      if (perm.status !== "granted") {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      setError(null);
      if (manageWakeWord) disableWakeWord();

      // 글로벌 웨이크 워드 리스너의 마이크 리소스가 완전히 언로드(unload)될 수 있도록 대기 시간을 늘립니다 (250ms -> 400ms).
      // 리소스 점유가 풀리기 전에 새로운 오디오 녹음 세션을 만들면 OS 수준에서 예외가 발생합니다.
      await new Promise((resolve) => setTimeout(resolve, 400));

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: "duckOthers",
        shouldRouteThroughEarpiece: false,
        shouldPlayInBackground: false,
      });

      await audioRecorder.prepareToRecordAsync();
      previousSpeechDetectedAtRef.current = null;
      detectedSpeechDurationMsRef.current = 0;
      lastSpeechAtRef.current = 0;
      autoStoppingRef.current = false;
      setSpeechDetectedDuringRecording(false);
      setDetectedSpeechDurationMs(0);
      setNoSpeechDetected(false);
      audioRecorder.record();
      nativeRecordingRef.current = true;

      // expo-av의 setOnRecordingStatusUpdate 대체: 200ms 간격으로 RecorderState(metering/duration)를
      // 폴링해 동일한 VAD(발화 감지 + 무음 자동전송) 로직을 수행한다.
      if (meteringPollRef.current) clearInterval(meteringPollRef.current);
      meteringPollRef.current = setInterval(() => {
        if (!autoStopOnSilence || disableVAD || autoStoppingRef.current) return;
        const status = audioRecorder.getStatus();
        if (!status.isRecording) return;

        const duration = status.durationMillis;
        const metering = status.metering;
        if (typeof metering === "number" && metering > -42) {
          setSpeechDetectedDuringRecording(true);
          if (previousSpeechDetectedAtRef.current !== null) {
            const delta = duration - previousSpeechDetectedAtRef.current;
            if (delta > 0 && delta <= MOBILE_SPEECH_DELTA_MAX_MS) {
              detectedSpeechDurationMsRef.current += delta;
              setDetectedSpeechDurationMs(detectedSpeechDurationMsRef.current);
            }
          }
          lastSpeechAtRef.current = duration;
          previousSpeechDetectedAtRef.current = duration;
        }

        const silenceElapsed = duration - lastSpeechAtRef.current;
        const silenceThreshold = silenceTimeoutMsRef.current ?? 1500;
        const shouldCommitFromSilence =
          typeof metering === "number" &&
          duration >= 1000 &&
          lastSpeechAtRef.current > 0 &&
          silenceElapsed >= silenceThreshold;
        const fallbackTurnLimit = 30000;

        if (shouldCommitFromSilence || duration >= fallbackTurnLimit) {
          autoStoppingRef.current = true;
          void finishRecording();
        }
      }, 200);
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
    if (!nativeRecordingRef.current) return;
    clearTimer();
    stopWebSilenceMonitor();
    setState("processing");
    if (meteringPollRef.current) {
      clearInterval(meteringPollRef.current);
      meteringPollRef.current = null;
    }
    nativeRecordingRef.current = false;
    autoStoppingRef.current = false;

    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = audioRecorder.uri;
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
    if (meteringPollRef.current) {
      clearInterval(meteringPollRef.current);
      meteringPollRef.current = null;
    }
    if (nativeRecordingRef.current) {
      nativeRecordingRef.current = false;
      void audioRecorder.stop().catch(() => undefined);
      // [주의] 여기서 allowsRecording: false 를 비동기로 동시 호출하면
      // 새로 시작하려는 화면 단의 오디오 세션(allowsRecording: true)을
      // 뒤늦게 덮어써버려 마이크 오작동(인식 실패)의 치명적인 원인이 됩니다.
      // 따라서 전역 오디오 모드 복원 처리는 정상 녹음 완료 시점인 finishRecording 에서만 제어하도록 격리합니다.
      // void setAudioModeAsync({ allowsRecording: false });
    }
    if (webRecorderRef.current?.state === "recording") {
      webRecorderRef.current.onstop = null;
      webRecorderRef.current.stop();
      webRecorderRef.current = null;
    }
    void clearAudio();
    setTranscript(null);
    setNoSpeechDetected(false);
    setSpeechDetectedDuringRecording(false);
    setDetectedSpeechDurationMs(0);
    setDurationMs(0);
    setPermissionDenied(false);
    setError(null);
    previousSpeechDetectedAtRef.current = null;
    detectedSpeechDurationMsRef.current = 0;
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
    speechDetectedDuringRecording,
    detectedSpeechDurationMs,
    start,
    stop: () => finishRecording(),
    reset,
    audioUri,
    clearAudio,
  };
}

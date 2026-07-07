import { AppState } from "react-native";
import { useEffect, useRef } from "react";
import { useRouter, useSegments } from "expo-router";
import { Audio } from "expo-av";
import { useAuthStore } from "../stores/authStore";
import { useWakeWordStore } from "../stores/wakeWordStore";
import { useRecorder } from "../features/record/useRecorder";
import { detectVoiceCommand, detectWakeWord } from "../features/chatbot/wakeWord";
import { playWakeChime } from "../features/chatbot/wakeChime";
import { playTTS } from "../features/chatbot/useMoaChat";

type ListenerMode = "wake" | "waitingCommand" | null;

/** Foreground-only listener shared by every signed-in screen. */
export function GlobalWakeWordListener() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const role = useAuthStore((s) => s.role);
  const wakeWordEnabled = useWakeWordStore((s) => s.isActive);
  const setWakePrompt = useWakeWordStore((s) => s.setWakePrompt);
  const { state, transcript, durationMs, noSpeechDetected, start, reset } = useRecorder({
    autoStopOnSilence: true,
    manageWakeWord: false,
  });
  const modeRef = useRef<ListenerMode>(null);
  const appActiveRef = useRef(AppState.currentState === "active");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledTranscriptRef = useRef<string | null>(null);
  const ttsSoundRef = useRef<Audio.Sound | null>(null);
  const ttsWebAudioRef = useRef<HTMLAudioElement | null>(null);

  const isReady = hydrated && isLoggedIn && Boolean(role) && wakeWordEnabled && appActiveRef.current;

  function startWakeListening() {
    if (!isReady || state === "recording" || state === "processing") return;
    modeRef.current = "wake";
    void start();
  }

  function routeCommand(command: ReturnType<typeof detectVoiceCommand>) {
    if (command === "record") {
      router.push((role === "guardian" ? "/(guardian)/record" : "/(elder)/record") as never);
      return true;
    }
    if (command === "history") {
      router.push((role === "guardian" ? "/(guardian)/report" : "/(elder)/history") as never);
      return true;
    }
    if (command === "result") {
      router.push((role === "guardian" ? "/(guardian)/report" : "/(elder)/history") as never);
      return true;
    }
    return false;
  }

  function openChatWith(text: string) {
    const pathname = role === "guardian" ? "/(guardian)/" : "/(elder)/";
    router.push({ pathname: pathname as never, params: { voiceText: text, voiceDurationMs: String(durationMs) } });
  }

  function beginCommandListening() {
    if (!appActiveRef.current) return;
    modeRef.current = "waitingCommand";
    void start();
  }

  async function enterWaitingCommand() {
    modeRef.current = "waitingCommand";
    setWakePrompt("네, 말씀하세요.");
    await playWakeChime().catch(() => undefined);
    await playTTS("네, 말씀하세요.", ttsSoundRef, ttsWebAudioRef);
    beginCommandListening();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (modeRef.current !== "waitingCommand") return;
      modeRef.current = null;
      reset();
      setWakePrompt("필요하시면 다시 불러주세요.");
      void playTTS("필요하시면 다시 불러주세요.", ttsSoundRef, ttsWebAudioRef).finally(() => {
        setTimeout(startWakeListening, 300);
      });
    }, 8000);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appActiveRef.current = nextState === "active";
      if (!appActiveRef.current) {
        modeRef.current = null;
        reset();
        return;
      }
      setTimeout(startWakeListening, 150);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isReady) {
      modeRef.current = null;
      reset();
      return;
    }
    const timer = setTimeout(startWakeListening, 150);
    return () => clearTimeout(timer);
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !noSpeechDetected || modeRef.current !== "wake") return;
    reset();
    const timer = setTimeout(startWakeListening, 150);
    return () => clearTimeout(timer);
  }, [isReady, noSpeechDetected, reset]);

  useEffect(() => {
    const text = transcript?.trim();
    if (!text || text === handledTranscriptRef.current) return;
    handledTranscriptRef.current = text;
    const mode = modeRef.current;
    reset();

    if (mode === "wake") {
      const wake = detectWakeWord(text);
      if (!wake.detected) {
        handledTranscriptRef.current = null;
        setTimeout(startWakeListening, 100);
      } else if (wake.remainder) {
        modeRef.current = null;
        if (!routeCommand(detectVoiceCommand(wake.remainder))) openChatWith(wake.remainder);
      } else {
        void enterWaitingCommand();
      }
      return;
    }

    if (mode === "waitingCommand") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      modeRef.current = null;
      if (!routeCommand(detectVoiceCommand(text))) openChatWith(text);
    }
  }, [transcript]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    void ttsSoundRef.current?.stopAsync().catch(() => undefined);
    reset();
  }, []);

  return null;
}

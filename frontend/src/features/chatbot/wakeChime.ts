import { Platform } from "react-native";
import { createAudioPlayer } from "expo-audio";

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    output += BASE64[(value >> 18) & 63] + BASE64[(value >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64[(value >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? BASE64[value & 63] : "=";
  }
  return output;
}

function createChimeUri(): string {
  const sampleRate = 8000;
  const samples = Math.floor(sampleRate * 0.16);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  [82, 73, 70, 70, 87, 65, 86, 69, 102, 109, 116, 32].forEach((value, index) => view.setUint8(index, value));
  view.setUint32(4, 36 + samples * 2, true);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  [100, 97, 116, 97].forEach((value, index) => view.setUint8(36 + index, value));
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    const envelope = Math.max(0, 1 - i / samples);
    const sample = Math.round(Math.sin((2 * Math.PI * 880 * i) / sampleRate) * 0.35 * envelope * 32767);
    view.setInt16(44 + i * 2, sample, true);
  }
  return `data:audio/wav;base64,${bytesToBase64(bytes)}`;
}

/** A short synthesized chime; no visual/design asset is required. */
export async function playWakeChime(): Promise<void> {
  if (Platform.OS === "web" && typeof AudioContext !== "undefined") {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.18, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.16);
    await new Promise<void>((resolve) => { oscillator.onended = () => { void context.close(); resolve(); }; });
    return;
  }
  const player = createAudioPlayer({ uri: createChimeUri() });
  await new Promise<void>((resolve) => {
    let settled = false;
    let fallback: ReturnType<typeof setTimeout>;
    function finish() {
      if (settled) return;
      settled = true;
      subscription.remove();
      clearTimeout(fallback);
      resolve();
    }
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) finish();
    });
    // 재생 종료 이벤트가 누락돼도 짧은 차임이 세션을 막지 않도록 안전 타임아웃.
    fallback = setTimeout(finish, 1500);
    player.play();
  });
  player.remove();
}

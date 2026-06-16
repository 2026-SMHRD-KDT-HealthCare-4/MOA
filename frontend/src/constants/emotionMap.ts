// React Native: require() returns number(native) | string(web) for media assets
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VideoAsset = any;

export type BotEmotion = "default" | "greeting" | "happy" | "worried" | "listening" | "thinking";

export const EMOTION_VIDEO_MAP: Record<BotEmotion, { idle: VideoAsset; talking?: VideoAsset }> = {
  default: { idle: require("../asset/기본.mp4") },
  greeting: {
    idle: require("../asset/모아인사.mp4"),
    talking: require("../asset/행복.mp4"),
  },
  happy: {
    idle: require("../asset/기쁨.mp4"),
    talking: require("../asset/설명.mp4"),
  },
  worried: { idle: require("../asset/걱정.mp4") },
  listening: { idle: require("../asset/듣기.mp4") },
  thinking: { idle: require("../asset/생각.mp4") },
};

export const FALLBACK_VIDEO: VideoAsset = require("../asset/기본.mp4");

export function resolveVideoSrc(emotion: BotEmotion, isTalking: boolean): VideoAsset {
  const videos = EMOTION_VIDEO_MAP[emotion];
  return (isTalking ? videos.talking : undefined) ?? videos.idle;
}

// ── 아바타 영상 레이어 (EMOTION_VIDEO_MAP에서 자동 생성) ────────────────
// 영상 추가·삭제·교체는 위 EMOTION_VIDEO_MAP 한 곳만 고치면 됨 (단일 소스).
export type AvatarVideoLayer = {
  key: string;
  emotion: BotEmotion;
  isTalking: boolean;
};

export const AVATAR_VIDEO_LAYERS: AvatarVideoLayer[] = (
  Object.keys(EMOTION_VIDEO_MAP) as BotEmotion[]
).flatMap((emotion) => {
  const layers: AvatarVideoLayer[] = [{ key: `${emotion}:idle`, emotion, isTalking: false }];
  if (EMOTION_VIDEO_MAP[emotion].talking) {
    layers.push({ key: `${emotion}:talking`, emotion, isTalking: true });
  }
  return layers;
});

export function getAvatarVideoKey(emotion: BotEmotion, isTalking: boolean): string {
  const useTalking = isTalking && Boolean(EMOTION_VIDEO_MAP[emotion]?.talking);
  return `${emotion}:${useTalking ? "talking" : "idle"}`;
}

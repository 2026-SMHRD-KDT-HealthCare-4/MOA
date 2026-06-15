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

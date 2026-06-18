// React Native: require() returns number(native) | string(web) for media assets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VideoAsset = any;

export type BotEmotion = "default" | "listening" | "thinking" | "happy" | "worried" | "clapping";

export const EMOTION_VIDEO_MAP: Record<BotEmotion, { idle: VideoAsset; talking?: VideoAsset }> = {
  default: { idle: require("../asset/기본2.mp4") },
  listening: { idle: require("../asset/듣기.mp4") },
  thinking: { idle: require("../asset/생각.mp4") },
  happy: {
    idle: require("../asset/행복.mp4"),
    talking: require("../asset/행복.mp4"),
  },
  worried: { idle: require("../asset/생각.mp4") },
  clapping: {
    idle: require("../asset/박수.mp4"),
    talking: require("../asset/박수.mp4"),
  },
};

export const INTRO_VIDEO: VideoAsset = require("../asset/인트로.mp4");
export const FALLBACK_VIDEO: VideoAsset = require("../asset/기본2.mp4");

export function resolveVideoSrc(emotion: BotEmotion, isTalking: boolean): VideoAsset {
  const videos = EMOTION_VIDEO_MAP[emotion];
  return (isTalking ? videos.talking : undefined) ?? videos.idle;
}

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

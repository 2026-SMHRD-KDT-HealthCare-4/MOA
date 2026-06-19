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
  worried: { idle: require("../asset/걱정.mp4") },
  clapping: {
    idle: require("../asset/박수.mp4"),
    talking: require("../asset/박수.mp4"),
  },
};

export const INTRO_VIDEO: VideoAsset = require("../asset/인트로.mp4");
export const FALLBACK_VIDEO: VideoAsset = require("../asset/기본2.mp4");

// 모든 영상의 시작/끝 프레임으로 사용된 중립 포즈 이미지.
// 영상 루프/전환 시 디코더가 잠깐 빈 프레임을 그릴 때(흰 화면 번쩍임의 원인) 이 이미지를
// 비디오 레이어 뒤에 항상 깔아두면, 그 틈에 흰 배경 대신 이 이미지가 보여서 번쩍임이 가려진다.
// ※ 영상 생성용 시드 이미지가 아니라 실제 영상(기본2.mp4)에서 추출한 첫 프레임을 사용한다.
//    시드 이미지는 924x1702, 실제 영상은 1080x1920으로 비율이 달라 cover 시 확대되어 보이는
//    문제가 있었음 — 영상과 동일한 해상도의 프레임을 써야 확대/튐 없이 자연스럽게 이어진다.
// 파일 위치: src/asset/중립프레임.png
export const NEUTRAL_POSE_IMAGE: VideoAsset = require("../asset/중립프레임.png");

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

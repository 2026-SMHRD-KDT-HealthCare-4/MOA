import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { resolveVideoSrc, type BotEmotion } from "../constants/emotionMap";

const CROSSFADE_MS = 300;

type AvatarVideoKey =
  | "default"
  | "greetingIdle"
  | "greetingTalking"
  | "happyIdle"
  | "happyTalking"
  | "worried"
  | "listening"
  | "thinking";

type AvatarVideoLayer = {
  key: AvatarVideoKey;
  emotion: BotEmotion;
  isTalking: boolean;
};

const AVATAR_VIDEO_LAYERS: AvatarVideoLayer[] = [
  { key: "default", emotion: "default", isTalking: false },
  { key: "greetingIdle", emotion: "greeting", isTalking: false },
  { key: "greetingTalking", emotion: "greeting", isTalking: true },
  { key: "happyIdle", emotion: "happy", isTalking: false },
  { key: "happyTalking", emotion: "happy", isTalking: true },
  { key: "worried", emotion: "worried", isTalking: false },
  { key: "listening", emotion: "listening", isTalking: false },
  { key: "thinking", emotion: "thinking", isTalking: false },
];

interface MoaAvatarProps {
  emotion?: BotEmotion;
  isTalking?: boolean;
  size?: number;
  showOnlineDot?: boolean;
  circular?: boolean;
  onActiveVideoLoop?: (state: { emotion: BotEmotion; isTalking: boolean }) => void;
}

function getAvatarVideoKey(emotion: BotEmotion, isTalking: boolean): AvatarVideoKey {
  if (emotion === "default") return "default";
  if (emotion === "greeting") return isTalking ? "greetingTalking" : "greetingIdle";
  if (emotion === "happy") return isTalking ? "happyTalking" : "happyIdle";
  return emotion;
}

function VideoLayer({
  layer,
  visible,
  size,
  contentFit,
  onActiveVideoLoop,
}: {
  layer: AvatarVideoLayer;
  visible: boolean;
  size: number;
  contentFit: "cover" | "contain";
  onActiveVideoLoop?: (state: { emotion: BotEmotion; isTalking: boolean }) => void;
}) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const videoSrc = resolveVideoSrc(layer.emotion, layer.isTalking);
  const player = useVideoPlayer(videoSrc, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.play();
  }, [player]);

  useEffect(() => {
    if (visible) {
      player.currentTime = 0;
      player.play();
    }

    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: CROSSFADE_MS,
      useNativeDriver: true,
    }).start();
  }, [opacity, player, visible]);

  useEventListener(player, "playToEnd", () => {
    if (!visible) return;
    onActiveVideoLoop?.({ emotion: layer.emotion, isTalking: layer.isTalking });
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.videoLayer,
        {
          width: size,
          height: size,
          opacity,
        },
      ]}
    >
      <VideoView
        player={player}
        style={{ width: size, height: size }}
        contentFit={contentFit}
        nativeControls={false}
        surfaceType="textureView"
      />
    </Animated.View>
  );
}

export function MoaAvatar({
  emotion = "greeting",
  isTalking = false,
  size = 235,
  showOnlineDot = true,
  circular = true,
  onActiveVideoLoop,
}: MoaAvatarProps) {
  const radius = size / 2;
  const dotSize = Math.round(size * 0.07);
  const dotOffset = Math.round(size * 0.085);
  const dotBorder = Math.max(2, Math.round(dotSize * 0.3));
  const activeVideoKey = getAvatarVideoKey(emotion, isTalking);
  const contentFit = circular ? "cover" : "contain";

  return (
    <View
      style={[
        circular ? styles.wrapperCircle : styles.wrapperFull,
        { width: size, height: size, borderRadius: circular ? radius : 0 },
      ]}
    >
      {AVATAR_VIDEO_LAYERS.map((layer) => (
        <VideoLayer
          key={layer.key}
          layer={layer}
          visible={activeVideoKey === layer.key}
          size={size}
          contentFit={contentFit}
          onActiveVideoLoop={onActiveVideoLoop}
        />
      ))}
      {showOnlineDot && circular && (
        <View
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              bottom: dotOffset,
              left: dotOffset,
              borderWidth: dotBorder,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapperCircle: {
    overflow: "hidden",
    backgroundColor: "#fff7f4",
    borderWidth: 3,
    borderColor: "#ffd4d1",
    shadowColor: "#c97a6e",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 40,
    elevation: 8,
  },
  wrapperFull: {
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  videoLayer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  onlineDot: {
    position: "absolute",
    backgroundColor: "#2ECC71",
    borderColor: "white",
  },
});

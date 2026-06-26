import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  AVATAR_VIDEO_LAYERS,
  getAvatarVideoKey,
  resolveVideoSrc,
  type AvatarVideoLayer,
  type BotEmotion,
} from "../constants/emotionMap";
import { installWebVideoPlayGuard, safePlay } from "../utils/videoPlayback";

const CROSSFADE_MS = 160;
const USE_NATIVE_DRIVER = Platform.OS !== "web";

installWebVideoPlayGuard();

interface MoaAvatarProps {
  emotion?: BotEmotion;
  isTalking?: boolean;
  size?: number;
  showOnlineDot?: boolean;
  circular?: boolean;
  onActiveVideoLoop?: (state: { emotion: BotEmotion; isTalking: boolean }) => void;
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
  const player = useVideoPlayer(videoSrc, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (visible) {
      void safePlay(player);
      Animated.timing(opacity, {
        toValue: 1,
        duration: CROSSFADE_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: CROSSFADE_MS,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(({ finished }) => {
        if (finished) player.pause();
      });
    }
  }, [visible, opacity, player]);

  useEventListener(player, "playToEnd", () => {
    if (!visible) return;
    onActiveVideoLoop?.({ emotion: layer.emotion, isTalking: layer.isTalking });
  });

  return (
    <Animated.View
      style={[styles.videoLayer, { width: size, height: size, opacity, pointerEvents: 'none' }]}
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
  emotion = "default",
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
      {AVATAR_VIDEO_LAYERS.map((layer, index) => (
        <VideoLayer
          key={`avatar-video-layer-${index}`}
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

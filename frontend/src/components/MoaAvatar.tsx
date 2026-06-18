import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  AVATAR_VIDEO_LAYERS,
  getAvatarVideoKey,
  resolveVideoSrc,
  type AvatarVideoLayer,
  type BotEmotion,
} from "../constants/emotionMap";

const CROSSFADE_MS = 300;

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
  // 모든 레이어를 mount해 소스를 미리 로드하되, 재생은 보이는 레이어만 (아래 effect).
  const player = useVideoPlayer(videoSrc, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // 첫 프레임 준비 여부 추적 — 준비된 뒤에만 페이드 인 (빈 화면 깜빡임 방지).
  const [ready, setReady] = useState(player.status === "readyToPlay");
  useEventListener(player, "statusChange", ({ status }) => {
    setReady(status === "readyToPlay");
  });

  useEffect(() => {
    if (visible) {
      player.play();
      if (ready) {
        Animated.timing(opacity, {
          toValue: 1,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }).start();
      }
      // 아직 준비 전이면 ready가 true로 바뀔 때 effect가 재실행되어 페이드 인.
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: CROSSFADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // 페이드 아웃 완료 후 정지 → 동시 재생 디코더를 최소화(끊김의 주원인 제거).
        if (finished) player.pause();
      });
    }
  }, [visible, ready, opacity, player]);

  // 자연스러운 전환 보조 신호 — 보이는(재생 중) 레이어에서만 발생.
  useEventListener(player, "playToEnd", () => {
    if (!visible) return;
    onActiveVideoLoop?.({ emotion: layer.emotion, isTalking: layer.isTalking });
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.videoLayer, { width: size, height: size, opacity }]}
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

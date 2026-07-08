import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { MoaAvatar } from "./MoaAvatar";
import {
  AVATAR_VIDEO_LAYERS,
  getAvatarVideoKey,
  INTRO_VIDEO,
  resolveVideoSrc,
  type BotEmotion,
  type VideoAsset,
} from "../constants/emotionMap";
import { installWebVideoPlayGuard, safePlay } from "../utils/videoPlayback";

const MEDIA_FIT = "cover";
const CROSSFADE_MS = 0;
const PREPARE_DELAY_MS = 350;
const USE_NATIVE_DRIVER = Platform.OS !== "web";

installWebVideoPlayGuard();

export type CharacterMood =
  | "intro"
  | "idle"
  | "listening"
  | "thinking"
  | "happy"
  | "clapping"
  | "worried";

interface CharacterPlayerProps {
  mood?: CharacterMood;
  autoplayAllowed?: boolean;
  hasUserInteracted?: boolean;
  size?: number;
  circular?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  bottomFadeColor?: string;
}

const MOOD_MAP: Record<Exclude<CharacterMood, "intro">, BotEmotion> = {
  idle: "default",
  listening: "listening",
  thinking: "thinking",
  happy: "happy",
  clapping: "clapping",
  worried: "worried",
};

type PreparedLayer = {
  key: string;
  source: VideoAsset;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMoodVideoKey(mood: CharacterMood): string {
  if (mood === "intro") return "intro:idle";

  const emotion = MOOD_MAP[mood];
  return getAvatarVideoKey(emotion, false);
}

function AvatarVideoLayer({
  source,
  visible,
  preparing,
  autoplayAllowed,
  hasUserInteracted,
  isIntro,
}: {
  source: VideoAsset;
  visible: boolean;
  preparing: boolean;
  autoplayAllowed?: boolean;
  hasUserInteracted?: boolean;
  isIntro?: boolean;
}) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.playbackRate = 0.75;
  });

  useEffect(() => {
  const canPlay = hasUserInteracted || autoplayAllowed !== false;
  if (canPlay && (visible || preparing)) {
    void safePlay(player);
  } else {
    player.pause();          // 안 보이는 레이어는 디코딩 중단
  }
}, [autoplayAllowed, hasUserInteracted, player, visible, preparing]);

  useEffect(() => {
    if (preparing) {
      player.currentTime = 0;
      void safePlay(player);
    }
  }, [preparing, player]);

  useEffect(() => {
    opacity.setValue(visible ? 1 : 0);
  }, [visible, opacity]);

  return (
    <Animated.View style={[styles.videoLayer, { opacity }]}>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, isIntro && styles.introVideoAdjust]}
        contentFit={MEDIA_FIT}
        nativeControls={false}
        surfaceType="textureView"
      />
    </Animated.View>
  );
}

function AbsoluteCharacterVideo({
  mood,
  containerStyle,
  autoplayAllowed,
  hasUserInteracted,
  bottomFadeColor,
}: {
  mood: CharacterMood;
  containerStyle: StyleProp<ViewStyle>;
  autoplayAllowed?: boolean;
  hasUserInteracted?: boolean;
  bottomFadeColor?: string;
}) {
  const layers = useMemo<PreparedLayer[]>(() => {
    return [
      {
        key: "intro:idle",
        source: INTRO_VIDEO,
      },
      ...AVATAR_VIDEO_LAYERS.map((layer) => ({
        key: layer.key,
        source: resolveVideoSrc(layer.emotion, layer.isTalking),
      })),
    ];
  }, []);

  const [visibleKey, setVisibleKey] = useState(() => getMoodVideoKey(mood));
  const [preparingKey, setPreparingKey] = useState<string | null>(null);

  const currentKeyRef = useRef(visibleKey);
  const latestKeyRef = useRef(visibleKey);

  useEffect(() => {
    const nextKey = getMoodVideoKey(mood);

    latestKeyRef.current = nextKey;

    if (nextKey === currentKeyRef.current) return;

    setPreparingKey(nextKey);

    let cancelled = false;

    (async () => {
      await delay(PREPARE_DELAY_MS);

      if (cancelled) return;
      if (latestKeyRef.current !== nextKey) return;

      currentKeyRef.current = nextKey;
      setVisibleKey(nextKey);

      await delay(CROSSFADE_MS + 120);

      if (!cancelled) {
        setPreparingKey(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mood]);

  return (
    <View style={[styles.absoluteClip, containerStyle]}>
      {layers.map((layer) => (
        <AvatarVideoLayer
          key={layer.key}
          source={layer.source}
          visible={layer.key === visibleKey}
          preparing={layer.key === preparingKey}
          autoplayAllowed={autoplayAllowed}
          hasUserInteracted={hasUserInteracted}
          isIntro={mood === "intro"}
        />
      ))}
      {bottomFadeColor && (
        <LinearGradient
          colors={[`${bottomFadeColor}00`, `${bottomFadeColor}90`, bottomFadeColor]}
          locations={[0, 0.45, 1]}
          style={[styles.bottomFadeMask, { pointerEvents: 'none' }]}
        />
      )}
    </View>
  );
}

export function CharacterPlayer({
  mood = "idle",
  autoplayAllowed,
  hasUserInteracted,
  size = 200,
  circular = false,
  containerStyle,
  bottomFadeColor,
}: CharacterPlayerProps) {
  const emotion = mood === "intro" ? "default" : MOOD_MAP[mood];

  if (containerStyle) {
    return (
      <AbsoluteCharacterVideo
        mood={mood}
        containerStyle={containerStyle}
        autoplayAllowed={autoplayAllowed}
        hasUserInteracted={hasUserInteracted}
        bottomFadeColor={bottomFadeColor}
      />
    );
  }

  return (
    <MoaAvatar
      emotion={emotion}
      size={size}
      circular={circular}
      showOnlineDot={false}
    />
  );
}

const styles = StyleSheet.create({
  absoluteClip: {
    position: "absolute",
    overflow: "hidden",
    zIndex: 1,
  },
  videoLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: "none",
  },
  introVideoAdjust: {
    top: -70,
    bottom: 70,
  },
  bottomFadeMask: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "28%",
    zIndex: 3,
  },
});

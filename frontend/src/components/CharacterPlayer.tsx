import { useEffect, useRef, useState } from "react";
import { Animated, View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { MoaAvatar } from "./MoaAvatar";
import {
  INTRO_VIDEO,
  resolveVideoSrc,
  type BotEmotion,
  type VideoAsset,
} from "../constants/emotionMap";

const MEDIA_FIT = "cover";
const CROSSFADE_MS = 300;
const ABSOLUTE_FILL_OBJECT: ViewStyle =
  "absoluteFillObject" in StyleSheet
    ? (StyleSheet as typeof StyleSheet & { absoluteFillObject: ViewStyle }).absoluteFillObject
    : { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };
const DEBUG_MOOD_SEQUENCE = true;
const DEBUG_SEQUENCE: Exclude<CharacterMood, "intro">[] = [
  "idle",
  "listening",
  "happy",
  "clapping",
  "worried",
];

export type CharacterMood = "intro" | "idle" | "listening" | "happy" | "clapping" | "worried";

interface CharacterPlayerProps {
  mood?: CharacterMood;
  autoplayAllowed?: boolean;
  hasUserInteracted?: boolean;
  /** Fixed-size mode (flex layout) */
  size?: number;
  circular?: boolean;
  /** Absolute-position mode: pass layout values (left/right/top/bottom/height/borderRadius) */
  containerStyle?: StyleProp<ViewStyle>;
}

const MOOD_MAP: Record<Exclude<CharacterMood, "intro">, BotEmotion> = {
  idle: "default",
  listening: "listening",
  happy: "happy",
  clapping: "clapping",
  worried: "worried",
};

function safePlay(player: { play: () => void | Promise<void> }) {
  try {
    const result = player.play();
    if (result && typeof (result as Promise<void>).then === "function") {
      return Promise.resolve(result)
        .then(() => true)
        .catch(() => {
          console.warn("[VIDEO PLAY BLOCKED]");
          return false;
        });
    }
    return Promise.resolve(true);
  } catch {
    console.warn("[VIDEO PLAY BLOCKED]");
    return Promise.resolve(false);
  }
}

function AbsoluteCharacterVideo({
  source,
  mood,
  containerStyle,
  autoplayAllowed,
  hasUserInteracted,
}: {
  source: VideoAsset;
  mood: CharacterMood;
  containerStyle: StyleProp<ViewStyle>;
  autoplayAllowed?: boolean;
  hasUserInteracted?: boolean;
}) {
  const debugEnabled = DEBUG_MOOD_SEQUENCE && mood !== "intro";
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const activeLayerRef = useRef<0 | 1>(0);
  const currentMoodRef = useRef<Exclude<CharacterMood, "intro">>(
    mood === "intro" ? "idle" : mood,
  );
  const transitionPendingRef = useRef(false);
  const layerOneOpacity = useRef(new Animated.Value(1)).current;
  const layerTwoOpacity = useRef(new Animated.Value(0)).current;
  const playerOne = useVideoPlayer(source, (player) => {
    player.loop = !debugEnabled;
    player.muted = true;
  });
  const playerTwo = useVideoPlayer(source, (player) => {
    player.loop = !debugEnabled;
    player.muted = true;
  });

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    playerOne.loop = !debugEnabled;
    playerOne.muted = true;
    playerTwo.loop = !debugEnabled;
    playerTwo.muted = true;
    if (hasUserInteracted || autoplayAllowed) {
      console.log("[PLAY]");
      void safePlay(activeLayerRef.current === 0 ? playerOne : playerTwo);
    }
  }, [autoplayAllowed, debugEnabled, hasUserInteracted, playerOne, playerTwo, source]);

  async function startNextDebugVideo(fromLayer: 0 | 1) {
    const currentIndex = DEBUG_SEQUENCE.indexOf(currentMoodRef.current);
    const nextMood =
      currentIndex >= 0 && currentIndex < DEBUG_SEQUENCE.length - 1
        ? DEBUG_SEQUENCE[currentIndex + 1]
        : "idle";
    const nextSource = resolveVideoSrc(MOOD_MAP[nextMood], false);
    const toLayer: 0 | 1 = fromLayer === 0 ? 1 : 0;
    const currentPlayer = fromLayer === 0 ? playerOne : playerTwo;
    const nextPlayer = toLayer === 0 ? playerOne : playerTwo;
    const currentOpacity = fromLayer === 0 ? layerOneOpacity : layerTwoOpacity;
    const nextOpacity = toLayer === 0 ? layerOneOpacity : layerTwoOpacity;

    try {
      await nextPlayer.replaceAsync(nextSource);
      nextPlayer.loop = false;
      nextPlayer.muted = true;
      nextPlayer.currentTime = 0;
      nextOpacity.setValue(0);
      await safePlay(nextPlayer);
      activeLayerRef.current = toLayer;
      setActiveLayer(toLayer);
      currentMoodRef.current = nextMood;
      console.log("[NEXT VIDEO START]", nextMood);
      Animated.parallel([
        Animated.timing(currentOpacity, {
          toValue: 0,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(nextOpacity, {
          toValue: 1,
          duration: CROSSFADE_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          currentPlayer.pause();
        }
        transitionPendingRef.current = false;
      });
    } catch {
      transitionPendingRef.current = false;
    }
  }

  function handleVideoEnd(layer: 0 | 1) {
    if (!debugEnabled || transitionPendingRef.current || activeLayerRef.current !== layer) return;
    transitionPendingRef.current = true;
    console.log("[VIDEO END]");
    void startNextDebugVideo(layer);
  }

  useEventListener(playerOne, "playToEnd", () => handleVideoEnd(0));
  useEventListener(playerTwo, "playToEnd", () => handleVideoEnd(1));

  return (
    <View style={[styles.absoluteClip, containerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.videoLayer, { opacity: layerOneOpacity }]}
      >
        <VideoView
          player={playerOne}
          style={StyleSheet.absoluteFill}
          contentFit={MEDIA_FIT}
          nativeControls={false}
          surfaceType="textureView"
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.videoLayer, { opacity: layerTwoOpacity }]}
      >
        <VideoView
          player={playerTwo}
          style={StyleSheet.absoluteFill}
          contentFit={MEDIA_FIT}
          nativeControls={false}
          surfaceType="textureView"
        />
      </Animated.View>
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
}: CharacterPlayerProps) {
  const emotion = mood === "intro" ? "default" : MOOD_MAP[mood];

  if (containerStyle) {
    const source = mood === "intro" ? INTRO_VIDEO : resolveVideoSrc(emotion, false);
    return (
      <AbsoluteCharacterVideo
        source={source}
        mood={mood}
        containerStyle={containerStyle}
        autoplayAllowed={autoplayAllowed}
        hasUserInteracted={hasUserInteracted}
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
    ...ABSOLUTE_FILL_OBJECT,
  },
});

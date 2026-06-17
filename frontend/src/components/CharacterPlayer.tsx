import { useEffect } from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { MoaAvatar } from "./MoaAvatar";
import { resolveVideoSrc, type BotEmotion } from "../constants/emotionMap";

export type CharacterMood = "idle" | "listening" | "happy" | "worried";

interface CharacterPlayerProps {
  mood?: CharacterMood;
  /** Fixed-size mode (flex layout) */
  size?: number;
  circular?: boolean;
  /** Absolute-position mode — pass layout values (left/right/top/bottom/height/borderRadius) */
  containerStyle?: StyleProp<ViewStyle>;
}

const MOOD_MAP: Record<CharacterMood, BotEmotion> = {
  idle:      "greeting",
  listening: "listening",
  happy:     "happy",
  worried:   "worried",
};

function safePlay(player: { play: () => void | Promise<void> }) {
  try {
    void Promise.resolve(player.play()).catch(() => {
      // Screen transitions can interrupt playback while the video element is being removed.
    });
  } catch {
    // Ignore transient playback failures during unmount/navigation.
  }
}

function AbsoluteCharacterVideo({
  emotion,
  containerStyle,
}: {
  emotion: BotEmotion;
  containerStyle: StyleProp<ViewStyle>;
}) {
  const videoSrc = resolveVideoSrc(emotion, false);
  const player = useVideoPlayer(videoSrc, (player) => {
    player.loop = true;
    player.muted = true;
    safePlay(player);
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    safePlay(player);
  }, [player, videoSrc]);

  return (
    <View style={[styles.absoluteClip, containerStyle]}>
      <VideoView
        key={emotion}
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

export function CharacterPlayer({
  mood = "idle",
  size = 200,
  circular = false,
  containerStyle,
}: CharacterPlayerProps) {
  const emotion = MOOD_MAP[mood];

  if (containerStyle) {
    return <AbsoluteCharacterVideo emotion={emotion} containerStyle={containerStyle} />;
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
  },
  video: {
    width: "100%",
    height: "100%",
  },
});

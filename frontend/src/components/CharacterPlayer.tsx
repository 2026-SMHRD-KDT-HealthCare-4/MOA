import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Video, ResizeMode } from "expo-av";
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

export function CharacterPlayer({
  mood = "idle",
  size = 200,
  circular = false,
  containerStyle,
}: CharacterPlayerProps) {
  const emotion = MOOD_MAP[mood];

  if (containerStyle) {
    const videoSrc = resolveVideoSrc(emotion, false);
    return (
      <View style={[styles.absoluteClip, containerStyle]}>
        <Video
          key={emotion}
          source={videoSrc}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay
          isMuted
        />
      </View>
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
  },
  video: {
    width: "100%",
    height: "100%",
  },
});

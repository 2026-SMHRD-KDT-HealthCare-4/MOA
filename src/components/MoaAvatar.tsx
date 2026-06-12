import { View, StyleSheet } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { resolveVideoSrc, type BotEmotion } from "../constants/emotionMap";

interface MoaAvatarProps {
  emotion?: BotEmotion;
  isTalking?: boolean;
  size?: number;
  showOnlineDot?: boolean;
}

export function MoaAvatar({
  emotion = "greeting",
  isTalking = false,
  size = 235,
  showOnlineDot = true,
}: MoaAvatarProps) {
  const videoSrc = resolveVideoSrc(emotion, isTalking);
  const radius = size / 2;
  const dotSize = Math.round(size * 0.07);
  const dotOffset = Math.round(size * 0.085);
  const dotBorder = Math.max(2, Math.round(dotSize * 0.3));

  return (
    <View
      style={[
        styles.wrapper,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Video
        key={`${emotion}_${String(isTalking)}`}
        source={videoSrc}
        style={{ width: size, height: size }}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />
      {showOnlineDot && (
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
  wrapper: {
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
  onlineDot: {
    position: "absolute",
    backgroundColor: "#2ECC71",
    borderColor: "white",
  },
});

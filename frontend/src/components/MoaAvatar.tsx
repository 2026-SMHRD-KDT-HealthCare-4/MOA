import { View, StyleSheet } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { resolveVideoSrc, type BotEmotion } from "../constants/emotionMap";

interface MoaAvatarProps {
  emotion?: BotEmotion;
  isTalking?: boolean;
  size?: number;
  showOnlineDot?: boolean;
  circular?: boolean;
}

export function MoaAvatar({
  emotion = "greeting",
  isTalking = false,
  size = 235,
  showOnlineDot = true,
  circular = true,
}: MoaAvatarProps) {
  const videoSrc = resolveVideoSrc(emotion, isTalking);
  const radius = size / 2;
  const dotSize = Math.round(size * 0.07);
  const dotOffset = Math.round(size * 0.085);
  const dotBorder = Math.max(2, Math.round(dotSize * 0.3));

  return (
    <View
      style={[
        circular ? styles.wrapperCircle : styles.wrapperFull,
        { width: size, height: size, borderRadius: circular ? radius : 0 },
      ]}
    >
      <Video
        key={`${emotion}_${String(isTalking)}`}
        source={videoSrc}
        style={{ width: size, height: size }}
        resizeMode={circular ? ResizeMode.COVER : ResizeMode.CONTAIN}
        isLooping
        shouldPlay
        isMuted
      />
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
  onlineDot: {
    position: "absolute",
    backgroundColor: "#2ECC71",
    borderColor: "white",
  },
});

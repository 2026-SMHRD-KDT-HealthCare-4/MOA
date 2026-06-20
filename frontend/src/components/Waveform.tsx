import { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";

const BARS = [5, 11, 7, 17, 10, 22, 12, 18, 8, 24, 15, 9, 19, 11, 6, 14, 8, 17, 7, 12];

interface Props {
  color?: string;
  large?: boolean;
  animated?: boolean;
}

function WaveBar({ height, color, large, active, index }: {
  height: number;
  color: string;
  large: boolean;
  active: boolean;
  index: number;
}) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 260 + (index % 5) * 45,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.34,
          duration: 300 + (index % 4) * 60,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => animation.stop();
  }, [active, index, pulse]);

  return (
    <Animated.View
      style={{
        width: large ? 3 : 2,
        height: large ? height : Math.round(height * 0.72),
        borderRadius: 3,
        backgroundColor: color,
        transform: [{ scaleY: pulse }],
      }}
    />
  );
}

export function Waveform({ color = "#76A96C", large = false, animated = false }: Props) {
  return (
    <View style={[styles.wave, large && styles.waveLarge]}>
      {BARS.map((h, i) => (
        <WaveBar
          key={i}
          height={h}
          color={color}
          large={large}
          active={animated}
          index={i}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wave:      { height: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  waveLarge: { height: 46, marginTop: 22, gap: 4 },
});

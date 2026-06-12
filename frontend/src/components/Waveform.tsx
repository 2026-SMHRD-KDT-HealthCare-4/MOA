import { View, StyleSheet } from "react-native";

const BARS = [5, 11, 7, 17, 10, 22, 12, 18, 8, 24, 15, 9, 19, 11, 6, 14, 8, 17, 7, 12];

interface Props {
  color?: string;
  large?: boolean;
}

export function Waveform({ color = "#76A96C", large = false }: Props) {
  return (
    <View style={[styles.wave, large && styles.waveLarge]}>
      {BARS.map((h, i) => (
        <View
          key={i}
          style={{
            width: large ? 3 : 2,
            height: large ? h : Math.round(h * 0.72),
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wave:      { height: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  waveLarge: { height: 46, marginTop: 22, gap: 4 },
});

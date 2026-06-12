import Svg, { Circle, Line, Path } from "react-native-svg";

export function SunIcon() {
  return (
    <Svg width="56" height="56" viewBox="0 0 56 56">
      {([0, 45, 90, 135] as const).map((rotation) => (
        <Line
          key={rotation}
          x1="28" y1="2" x2="28" y2="9"
          stroke="#F5BE35" strokeWidth="3" strokeLinecap="round"
          transform={`rotate(${rotation} 28 28)`}
        />
      ))}
      <Circle cx="28" cy="28" r="14" fill="#FFD45E" />
      <Circle cx="23" cy="26" r="1.5" fill="#C77B35" />
      <Circle cx="33" cy="26" r="1.5" fill="#C77B35" />
      <Path d="M23 32c3 3 7 3 10 0" stroke="#C77B35" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

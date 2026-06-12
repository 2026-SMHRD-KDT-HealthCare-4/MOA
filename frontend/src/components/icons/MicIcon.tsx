import Svg, { Line, Path, Rect } from "react-native-svg";

interface Props { color: string; size: number }

export function MicIcon({ color, size }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x="11" y="3" width="10" height="17" rx="5" fill={color} />
      <Path d="M7 15c0 5 4 9 9 9s9-4 9-9" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Line x1="16" y1="24" x2="16" y2="29" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="11" y1="29" x2="21" y2="29" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

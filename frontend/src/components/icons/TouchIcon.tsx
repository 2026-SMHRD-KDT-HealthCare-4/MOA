import Svg, { Line, Path } from "react-native-svg";

export function TouchIcon() {
  return (
    <Svg width="46" height="46" viewBox="0 0 46 46">
      <Path
        d="M22 35 14 24c-1.8-2.5 1.8-5 3.6-2.6l2.4 3.1V10a3 3 0 0 1 6 0v10-3a3 3 0 0 1 6 0v3-1a3 3 0 0 1 6 0v9c0 7-5 12-11 12h-1c-2 0-3-2-4-5Z"
        stroke="#3F332C"
        strokeWidth="2"
        fill="#FFF9F2"
        strokeLinejoin="round"
      />
      <Line x1="14" y1="10" x2="9"  y2="6"  stroke="#3F332C" strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="16" x2="6"  y2="16" stroke="#3F332C" strokeWidth="2" strokeLinecap="round" />
      <Line x1="16" y1="6"  x2="15" y2="1"  stroke="#3F332C" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

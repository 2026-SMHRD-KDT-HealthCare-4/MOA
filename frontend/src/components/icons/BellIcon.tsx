import Svg, { Path } from "react-native-svg";

export function BellIcon() {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24">
      <Path
        d="M6.5 9.5a5.5 5.5 0 0 1 11 0v4l1.5 2.5H5l1.5-2.5v-4Z"
        stroke="#322B27" strokeWidth="1.7" fill="none" strokeLinejoin="round"
      />
      <Path d="M10 19h4" stroke="#322B27" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

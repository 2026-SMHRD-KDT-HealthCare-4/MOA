import { type ImageSourcePropType } from "react-native";

// 날씨 메타포 상태 (☀️ 맑음 / ⛅ 흐림 / 🌧️ 비)
export type WeatherStatus = "sunny" | "cloudy" | "rainy";

// 날씨 이모지를 대체하는 이미지. 이미지 교체·추가는 이 파일(과 assets/weather/)만 수정하면 됨.
export const WEATHER_IMAGE: Record<WeatherStatus, ImageSourcePropType> = {
  sunny: require("../../assets/weather/weather_sunny.png"),
  cloudy: require("../../assets/weather/weather_cloudy.png"),
  rainy: require("../../assets/weather/weather_rainy.png"),
};

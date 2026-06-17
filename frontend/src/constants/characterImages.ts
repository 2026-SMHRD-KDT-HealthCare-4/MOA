import { type ImageSourcePropType } from "react-native";

// 직접사용자 캐릭터: 성별 × 건강 상태 → 표정 이미지.
// 이미지 추가·교체·표정 변경은 이 파일과 assets/character/ 만 수정하면 됨 (단일 소스).
export type Gender = "male" | "female";
export type HealthState = "normal" | "caution" | "alert";

export const CHARACTER_IMAGE: Record<Gender, Record<HealthState, ImageSourcePropType>> = {
  female: {
    normal: require("../../assets/character/character_grandma_normal.png"),
    caution: require("../../assets/character/character_grandma_caution.png"),
    alert: require("../../assets/character/character_grandma_alert.png"),
  },
  male: {
    normal: require("../../assets/character/character_grandpa_normal.png"),
    caution: require("../../assets/character/character_grandpa_caution.png"),
    alert: require("../../assets/character/character_grandpa_alert.png"),
  },
};

export function resolveCharacter(gender: Gender, state: HealthState): ImageSourcePropType {
  return CHARACTER_IMAGE[gender][state];
}

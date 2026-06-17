import type { Gender, HealthState } from "../constants/characterImages";

// 가족 탭 보조 표시용 mock 데이터.
// 연동 진실원천(누가/ACTIVE·PENDING)은 authStore.links이고,
// 카드에 곁들이는 상태·안부·형제 정보는 백엔드 연동 전까지 여기서 제공한다.
export type ParentStatus = "normal" | "caution"; // 정상 / 주의 (경보는 앰버 단독, 빨강 없음)

export interface Sibling {
  name: string;
  role: string; // 직접사용자와의 관계 (예: "장남", "차녀")
}

export interface ParentMeta {
  gender: Gender;
  state: HealthState; // 상세 리포트 캐릭터 표정
  status: ParentStatus; // 가족 허브 카드의 오늘 상태
  lastGreeting: string; // 마지막 안부 시각
  siblings: Sibling[]; // 함께 돌보는 가족
}

const DEFAULT_META: ParentMeta = {
  gender: "female",
  state: "normal",
  status: "normal",
  lastGreeting: "오늘 09:42",
  siblings: [{ name: "나", role: "보호자" }],
};

// 이름 기준 보조 데이터(데모용). 등록되지 않은 부모는 기본값.
const META_BY_NAME: Record<string, ParentMeta> = {
  김순자: {
    gender: "female",
    state: "normal",
    status: "normal",
    lastGreeting: "오늘 09:42",
    siblings: [
      { name: "나", role: "보호자" },
      { name: "김지훈", role: "장남" },
    ],
  },
  박무남: {
    gender: "male",
    state: "caution",
    status: "caution",
    lastGreeting: "어제 20:10",
    siblings: [{ name: "나", role: "보호자" }],
  },
};

export function getParentMeta(name: string): ParentMeta {
  return META_BY_NAME[name] ?? DEFAULT_META;
}

export const PARENT_STATUS_LABEL: Record<ParentStatus, string> = {
  normal: "정상",
  caution: "주의",
};

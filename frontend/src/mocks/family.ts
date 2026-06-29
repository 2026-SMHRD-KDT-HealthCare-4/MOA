// 가족 허브 카드 '오늘 상태' 라벨 타입/상수.
// mock 데이터(getParentMeta·META_BY_NAME 등)는 제거됨 — 상태·마지막 인사는 api/report.ts 실데이터 사용.
// 금지 표현("진단/처방/치료/병명") 금지. "감지/변화/패턴/참고용"만 사용. 경보는 앰버 단독(빨강 금지).
export type ParentStatus = "normal" | "caution"; // 정상 / 주의

export const PARENT_STATUS_LABEL: Record<ParentStatus, string> = {
  normal: "정상",
  caution: "주의",
};

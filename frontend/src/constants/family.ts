export type ParentStatus = "normal" | "caution"; // 정상 / 주의

export const PARENT_STATUS_LABEL: Record<ParentStatus, string> = {
  normal: "정상",
  caution: "주의",
};

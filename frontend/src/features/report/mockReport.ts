// 보호자 리포트 mock 데이터 — 실제 API 연동 시 이 파일의 데이터만 교체한다.
// 금지 표현("진단/처방/치료/병명") 절대 사용 금지. "감지/변화/패턴/참고용"만 사용.
import { type WeatherStatus } from "../../constants/weatherIcons";

// 음성 영역별 관찰 상태 — 'normal'(정상) | 'caution'(변화 감지)
// 레드 금지: caution 은 앰버(#E8943A) 로만 표현한다.
export type VoiceStatus = "normal" | "caution";

export interface VoicePattern {
  area: string;
  icon: string;
  status: VoiceStatus;
  text: string;
}

// 목소리 변화 추이 차트 한 점. value: 0 정상 / 1 주의 / 2 변화감지
export interface ChartPoint {
  date: string; // 'M/D'
  value: 0 | 1 | 2;
}

export interface ReportAlert {
  date: string;
  text: string;
}

// 캘린더 날짜별 체크인 상태.
// 'normal'  체크인 완료 + 정상
// 'caution' 체크인 완료 + 변화감지
// 'missed'  미체크인
// (맵에 없는 날짜 = 오늘 이후 → 표시하지 않음)
export type CalendarDayStatus = "normal" | "caution" | "missed";
export type CheckinCalendar = Record<number, CalendarDayStatus>;

export interface FamilyReport {
  month: string; // 'YYYY-MM'
  elderlyName: string;
  // weather: 날씨 메타포 상태(sunny/cloudy/rainy) — assets/weather 이미지로 렌더링
  summary: { weather: WeatherStatus; text: string };
  checkinRate: { done: number; total: number };
  checkinCalendar: CheckinCalendar; // 1-기반 일자 → 상태
  chartData: ChartPoint[];
  voicePatterns: VoicePattern[];
  alerts: ReportAlert[];
}

// 캘린더 mock 생성 헬퍼 — 1..lastDay 를 normal 로 채우고 caution/missed 만 덮어쓴다.
function buildCalendar(
  lastDay: number,
  caution: number[],
  missed: number[]
): CheckinCalendar {
  const cal: CheckinCalendar = {};
  for (let d = 1; d <= lastDay; d++) cal[d] = "normal";
  caution.forEach((d) => (cal[d] = "caution"));
  missed.forEach((d) => (cal[d] = "missed"));
  return cal;
}

// 차트 y축 라벨 (수치 대신 의미 표기)
export const STATUS_LABELS: Record<0 | 1 | 2, string> = {
  0: "정상",
  1: "주의",
  2: "변화감지",
};

// 직접사용자별 mock 리포트. key 는 ReportChip.id 와 매칭.
export const mockFamilyReports: Record<string, FamilyReport> = {
  "1": {
    month: "2026-06",
    elderlyName: "김순자",
    summary: { weather: "sunny", text: "안정적인 한 달이었어요" },
    checkinRate: { done: 19, total: 23 },
    // 6/1~6/23 기록(오늘 6/23). caution 4 + missed 4 + normal 15 = 완료 19 / 총 23
    checkinCalendar: buildCalendar(23, [7, 13, 14, 17], [5, 11, 18, 21]),
    chartData: [
      { date: "6/1", value: 0 },
      { date: "6/4", value: 0 },
      { date: "6/7", value: 1 },
      { date: "6/10", value: 0 },
      { date: "6/13", value: 1 },
      { date: "6/14", value: 2 },
      { date: "6/17", value: 1 },
      { date: "6/20", value: 0 },
      { date: "6/23", value: 0 },
    ],
    voicePatterns: [
      { area: "발화 속도", icon: "🗣️", status: "caution", text: "평소보다 느려지는 경향이 있어요" },
      { area: "호흡 패턴", icon: "😮‍💨", status: "normal", text: "안정적이에요" },
      { area: "언어 패턴", icon: "🧠", status: "caution", text: "단어 탐색 시간이 길어졌어요" },
    ],
    alerts: [
      { date: "6월 14일", text: "3일 연속 변화 감지" },
      { date: "6월 7일", text: "발화 속도 변화 감지" },
    ],
  },
  "2": {
    month: "2026-06",
    elderlyName: "김철수",
    summary: { weather: "cloudy", text: "전반적으로 무난한 한 달이었어요" },
    checkinRate: { done: 21, total: 23 },
    // 6/1~6/23 기록(오늘 6/23). caution 2 + missed 2 + normal 19 = 완료 21 / 총 23
    checkinCalendar: buildCalendar(23, [4, 16], [9, 20]),
    chartData: [
      { date: "6/1", value: 0 },
      { date: "6/4", value: 1 },
      { date: "6/7", value: 0 },
      { date: "6/10", value: 0 },
      { date: "6/13", value: 0 },
      { date: "6/16", value: 1 },
      { date: "6/19", value: 0 },
      { date: "6/22", value: 0 },
    ],
    voicePatterns: [
      { area: "발화 속도", icon: "🗣️", status: "normal", text: "안정적이에요" },
      { area: "호흡 패턴", icon: "😮‍💨", status: "caution", text: "숨이 짧아지는 경향이 보여요" },
      { area: "언어 패턴", icon: "🧠", status: "normal", text: "평소와 비슷해요" },
    ],
    alerts: [{ date: "6월 16일", text: "호흡 패턴 변화 감지" }],
  },
};

// 월 선택 드롭다운 옵션 (mock)
export const monthOptions = [
  { value: "2026-06", label: "6월" },
  { value: "2026-05", label: "5월" },
  { value: "2026-04", label: "4월" },
];

// 보호자 리포트 타입 정의 + 라벨 상수.
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

// 차트 y축 라벨 (수치 대신 의미 표기)
export const STATUS_LABELS: Record<0 | 1 | 2, string> = {
  0: "정상",
  1: "주의",
  2: "변화감지",
};

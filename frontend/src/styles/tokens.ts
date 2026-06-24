export const colors = {
  bg: {
    base: "#FFF9F2",
    card: "#FFFDF9",
    warm: "#FFF8EE",
    accent: "#F8E5D2",
    safeArea: "#EDE5DE",
  },
  brand: {
    DEFAULT: "#173F73",
    coral: "#173F73",
    light: "#FFE9E6",
    record: "#F06D4D",
  },
  gradient: {
    intro:  ["#FFF8EE", "#FFFDF9", "#F8E5D2"] as const,
    chat:   ["#FFF9F1", "#FFFDF9"] as const,
    result: ["#FFF9F1", "#FFFDF9", "#F9E6D4"] as const,
  },
  alert: "#E8943A",
  online: "#2ECC71",
  nav: {
    activeBg:   "#EAF1E6",
    activeText: "#5D7657",
    inactiveText: "#8C7D75",
    border: "rgba(99,78,67,0.16)",
    bg: "rgba(255,253,250,0.98)",
  },
  waveform: "#76A96C",
  spark: "#F3AE62",
  text: {
    primary:     "#342C28",
    secondary:   "#40332D",
    muted:       "#765E52",
    placeholder: "#9A887D",
    header:      "#39302C",
  },
  border: {
    DEFAULT: "rgba(99,78,67,0.16)",
    card:    "#E6C9B0",
    input:   "#E6D9D2",
  },
  bubble: {
    bot:    "#FFFFFF",
    user:   "#93B878",
    shadow: "#715346",
    tail:   "#FFFFFF",
  },
  // 보호자(GRD) 대시보드 팔레트 — 목표 이미지에서 추출한 실제 값. 컴포넌트는 이 토큰만 참조.
  // 보라·빨강 사용 금지. 강조/경고/활성은 amber 단독.
  guardian: {
    bgPage:        "#FCF8F3", // 페이지 배경(따뜻한 화이트)
    cardPeach:     "#FDECDD", // 상태 카드 · 추천 카드 배경
    card:          "#FFFFFF", // 차트 · 포인트 카드 배경
    chartBar:      "#C8D0E0", // 7일 차트 막대(연한 라벤더 — 여기만)
    amber:         "#E8943A", // 강조 · 경고 · 액티브 탭(단독)
    textPrimary:   "#4A4A48",
    textSecondary: "#8A8A86",
    border:        "rgba(74,74,72,0.08)",
    gridline:      "rgba(74,74,72,0.10)", // 차트 Y축 눈금선(중립)
  },
  // 보호자 가족/리포트 탭 네이비 팔레트 — 2026-06-23 결정(네이비+베이지+세이지그린+앰버, 코랄 미사용).
  // 가족 탭 카드·버튼·모달은 이 토큰만 참조한다.
  guardianNavy: {
    primary:      "#173F73", // CTA · 핵심 액션
    primaryDark:  "#12345F", // 강조 텍스트 · pressed
    primaryLight: "#F6E3C2", // 아이콘 배경 · pressed 배경
    bgPage:       "#F6E3C2", // 페이지 배경(베이지)
    card:         "#FFF9F1",
    border:       "rgba(94,65,40,0.12)",
    textMain:     "#3F2A1D",
    textSub:      "#6F5A49",
    textMuted:    "#9B8A7D",
  },
} as const;

export const spacing = {
  screenH: 24,
  screenV: 22,
} as const;

export const radius = {
  card:   17,
  button: 23,
  pill:   22,
  bubble: 28,
} as const;

export const font = {
  sizeBase:  18,
  sizeSmall: 14,
  sizeLarge: 24,
  sizeXL:    28,
} as const;

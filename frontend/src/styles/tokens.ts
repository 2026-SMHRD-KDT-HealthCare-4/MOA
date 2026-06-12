export const colors = {
  bg: {
    base: "#FFF9F2",
    card: "#FFFDF9",
    warm: "#FFF8EE",
    accent: "#F8E5D2",
    safeArea: "#EDE5DE",
  },
  brand: {
    DEFAULT: "#FF7955",
    coral: "#FF7955",
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

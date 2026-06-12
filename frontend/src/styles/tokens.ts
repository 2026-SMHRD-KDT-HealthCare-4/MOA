export const colors = {
  bg: {
    base: "#FAF7F2",
    card: "#FFFDFB",
  },
  brand: {
    DEFAULT: "#F4A9A8",
    coral: "#FF706D",
    light: "#FFE9E6",
  },
  alert: "#E8943A",
  online: "#2ECC71",
  text: {
    primary: "#292321",
    secondary: "#4D403B",
    muted: "#A18F88",
    placeholder: "#B6AAA5",
  },
  border: "#EEE5E0",
} as const;

export const spacing = {
  screenH: 24,
  screenV: 22,
} as const;

export const radius = {
  card: 17,
  button: 15,
  pill: 22,
} as const;

export const font = {
  sizeBase: 18,   // 어르신 화면 최소 18px
  sizeSmall: 14,
  sizeLarge: 24,
  sizeXL: 28,
} as const;

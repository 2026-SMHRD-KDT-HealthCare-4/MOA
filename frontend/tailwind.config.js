/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class", // 다크모드 미구현 — media 감지 충돌 방지
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: { base: "#FAF7F2" },
        brand: { DEFAULT: "#F4A9A8", coral: "#FF706D" },
        alert: "#E8943A",
        online: "#2ECC71",
      },
    },
  },
  plugins: [],
};

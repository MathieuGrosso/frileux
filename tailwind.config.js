/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Warm stone — the soul of Frileuse
        stone: {
          950: "#0C0A09",
          900: "#1C1917",
          800: "#292524",
          750: "#312E2B",
          700: "#44403C",
          600: "#57534E",
          500: "#78716C",
          400: "#A8A29E",
          300: "#D6D3D1",
          200: "#E7E5E4",
          100: "#F5F5F4",
          50: "#FAFAF9",
        },
        // Amber gold — the accent
        amber: {
          600: "#D97706",
          500: "#F59E0B",
          400: "#FBBF24",
          300: "#FCD34D",
          200: "#FDE68A",
          100: "#FEF3C7",
          50: "#FFFBEB",
        },
        // Semantic
        success: "#4ADE80",
        error: "#F87171",
        warning: "#FBBF24",
      },
      fontFamily: {
        display: ["Cormorant_600SemiBold"],
        "display-light": ["Cormorant_300Light"],
        body: ["DMSans_400Regular"],
        "body-medium": ["DMSans_500Medium"],
        "body-bold": ["DMSans_700Bold"],
      },
    },
  },
  plugins: [],
};

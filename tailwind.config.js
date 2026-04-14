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
        // Light surfaces — warm off-white
        paper: {
          DEFAULT: "#FAFAF8",
          50: "#FFFFFF",
          100: "#FAFAF8",
          200: "#F2F0EC",
          300: "#E8E5DF",
          400: "#D8D4CE",
          500: "#C4BFB8",
        },
        // Near-black type
        ink: {
          DEFAULT: "#0F0F0D",
          900: "#0F0F0D",
          700: "#3A3836",
          500: "#6B6A66",
          300: "#9E9A96",
          200: "#C4C0BC",
        },
        // Cold accent — icy slate blue
        ice: {
          DEFAULT: "#637D8E",
          900: "#2C4A5C",
          700: "#4E748C",
          600: "#637D8E",
          400: "#96ADB9",
          200: "#D5E4EE",
          100: "#E8F1F6",
        },
        // Semantic
        success: "#2D7D4A",
        error: "#C0392B",
        warning: "#B45309",
      },
      fontFamily: {
        display: ["BarlowCondensed_600SemiBold"],
        "display-medium": ["BarlowCondensed_500Medium"],
        "display-regular": ["BarlowCondensed_400Regular"],
        body: ["Jost_400Regular"],
        "body-medium": ["Jost_500Medium"],
        "body-semibold": ["Jost_600SemiBold"],
      },
      // Echelle typo — Barlow Condensed pour display (tight tracking),
      // Jost pour body / eyebrow (tracking positif pour labels uppercase).
      fontSize: {
        "display-2xl": ["72px", { lineHeight: "72px", letterSpacing: "-1px" }],
        "display-xl": ["56px", { lineHeight: "58px", letterSpacing: "-0.8px" }],
        "h1": ["36px", { lineHeight: "40px", letterSpacing: "-0.4px" }],
        "h2": ["24px", { lineHeight: "28px", letterSpacing: "-0.2px" }],
        "h3": ["18px", { lineHeight: "24px" }],
        "body": ["15px", { lineHeight: "24px" }],
        "body-sm": ["13px", { lineHeight: "20px" }],
        "caption": ["12px", { lineHeight: "16px" }],
        "eyebrow": ["10px", { lineHeight: "14px", letterSpacing: "2px" }],
        "micro": ["9px", { lineHeight: "12px", letterSpacing: "1.8px" }],
      },
    },
  },
  plugins: [],
};

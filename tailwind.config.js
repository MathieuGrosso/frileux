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
    },
  },
  plugins: [],
};

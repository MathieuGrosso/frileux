// Miroir JS du tailwind.config.js pour les usages qui n'ont pas
// acces aux classes utilitaires (Animated, StatusBar, ActivityIndicator,
// natifs Modal/Picker, etc).
//
// Source de verite : tailwind.config.js. Modifier les deux ensemble.

export const colors = {
  paper: {
    DEFAULT: "#FAFAF8",
    50: "#FFFFFF",
    100: "#FAFAF8",
    200: "#F2F0EC",
    300: "#E8E5DF",
    400: "#D8D4CE",
    500: "#C4BFB8",
  },
  ink: {
    DEFAULT: "#0F0F0D",
    900: "#0F0F0D",
    700: "#3A3836",
    500: "#6B6A66",
    300: "#9E9A96",
    200: "#C4C0BC",
  },
  ice: {
    DEFAULT: "#637D8E",
    900: "#2C4A5C",
    700: "#4E748C",
    600: "#637D8E",
    400: "#96ADB9",
    200: "#D5E4EE",
    100: "#E8F1F6",
  },
  success: "#2D7D4A",
  error: "#C0392B",
  warning: "#B45309",
} as const;

export const fonts = {
  display: "BarlowCondensed_600SemiBold",
  displayMedium: "BarlowCondensed_500Medium",
  displayRegular: "BarlowCondensed_400Regular",
  body: "Jost_400Regular",
  bodyMedium: "Jost_500Medium",
  bodySemibold: "Jost_600SemiBold",
} as const;

// Tailles editoriales — reuse via styles.text pour limiter les
// `text-[Npx]` disperses.
export const fontSize = {
  displayXl: 96,
  display: 64,
  h1: 32,
  h2: 24,
  body: 15,
  caption: 13,
  micro: 11,
} as const;

// Espacements normalises.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

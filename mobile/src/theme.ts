import { Platform } from "react-native";

export const colors = {
  bg: "#E7F2EC",
  bgAlt: "#D7E8DF",
  surface: "#F7FBF8",
  ink: "#1A2E28",
  muted: "#5C726A",
  accent: "#0F6B5C",
  accentSoft: "#C8E4DC",
  dangerSoft: "#E8D4C8",
  danger: "#8B3A2A",
  white: "#FFFFFF",
  border: "#C5D8CF",
  flame: "#FF8A1F",
  flameDeep: "#E8590C",
  flameSoft: "#FFE8D1",
  gold: "#F2B600",
  ice: "#3D9BE0",
  iceSoft: "#DCEEFB",
  idle: "#B9C9C2",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const fonts = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: undefined }),
};

export const shadow = {
  card: {
    shadowColor: "#1A2E28",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
};

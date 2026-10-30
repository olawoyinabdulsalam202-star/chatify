import { useColorScheme } from "react-native";
import { useAuthStore } from "../stores/useAuthStore";
import { getNativeFontFamily } from "./fonts";

const palettes = {
  light: {
    background: "#FAF7F2",
    surface: "#F0EAE1",
    elevated: "#E0D7CB",
    text: "#3A332B",
    muted: "#A59889",
    border: "#E0D7CB",
    primary: "#C2410C",
    primaryPressed: "#A8380E",
    outgoing: "#C2410C",
    outgoingText: "#FFFFFF",
    incoming: "#F0EAE1",
    incomingText: "#3A332B",
    success: "#3F9142",
    danger: "#B91C1C",
    white: "#FFFFFF",
    overlay: "rgba(58,51,43,0.08)",
  },
  dark: {
    background: "#141311",
    surface: "#272320",
    elevated: "#3C3630",
    text: "#DED7CD",
    muted: "#786E64",
    border: "#3C3630",
    primary: "#C2410C",
    primaryPressed: "#A8380E",
    outgoing: "#C2410C",
    outgoingText: "#FFF7ED",
    incoming: "#272320",
    incomingText: "#DED7CD",
    success: "#3F9142",
    danger: "#DC5050",
    white: "#FFFFFF",
    overlay: "rgba(0,0,0,0.24)",
  },
};

export function useTheme() {
  const systemScheme = useColorScheme();
  const settings = useAuthStore((state) => state.authUser?.settings);
  const preference = settings?.theme;
  const mode = preference === "light" || preference === "dark" ? preference : systemScheme || "light";
  const fontSize = settings?.fontSize;
  const fontScale = fontSize === "small" ? 0.9 : fontSize === "large" ? 1.16 : 1;
  return {
    ...(palettes[mode] || palettes.light),
    fontId: settings?.fontFamily || "sans",
    fontFamily: getNativeFontFamily(settings?.fontFamily || "sans"),
    fontScale,
    fontColor: settings?.fontColor || "",
  };
}

export const themePalettes = palettes;

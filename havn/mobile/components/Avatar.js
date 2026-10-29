import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

export default function Avatar({ uri, name = "", size = 52, online = false, showOnline = false }) {
  const theme = useTheme();
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "H";
  return (
    <View style={{ width: size, height: size }}>
      {uri ? <Image source={{ uri }} contentFit="cover" style={[styles.avatar, { width: size, height: size }]} /> : <View style={[styles.fallback, { width: size, height: size, backgroundColor: theme.elevated }]}><Text allowFontScaling style={{ color: theme.text, fontSize: Math.max(15, size * 0.3), fontWeight: "700" }}>{initials}</Text></View>}
      {showOnline && <View style={[styles.dot, { backgroundColor: online ? theme.success : theme.muted, borderColor: theme.background }]} />}
    </View>
  );
}

const styles = StyleSheet.create({ avatar: { borderRadius: 99, backgroundColor: "#E0D7CB" }, fallback: { borderRadius: 99, alignItems: "center", justifyContent: "center" }, dot: { position: "absolute", width: 13, height: 13, borderRadius: 7, borderWidth: 2, right: 0, bottom: 0 } });

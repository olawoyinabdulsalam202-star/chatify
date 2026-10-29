import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

export default function LoadingView({ label = "Loading" }) {
  const theme = useTheme();
  return <View style={styles.wrap}><ActivityIndicator size="large" color={theme.primary} /><Text allowFontScaling style={{ color: theme.muted, marginTop: 12 }}>{label}</Text></View>;
}

export function SkeletonRows({ count = 5 }) {
  const theme = useTheme();
  return <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>{Array.from({ length: count }, (_, index) => <View key={index} style={styles.row}><View style={[styles.circle, { backgroundColor: theme.surface }]} /><View style={{ flex: 1, gap: 9 }}><View style={[styles.line, { width: "55%", backgroundColor: theme.surface }]} /><View style={[styles.line, { width: "78%", backgroundColor: theme.surface }]} /></View></View>)}</View>;
}

const styles = StyleSheet.create({ wrap: { flex: 1, alignItems: "center", justifyContent: "center" }, row: { flexDirection: "row", alignItems: "center", gap: 12, height: 78 }, circle: { width: 50, height: 50, borderRadius: 25 }, line: { height: 11, borderRadius: 6 } });

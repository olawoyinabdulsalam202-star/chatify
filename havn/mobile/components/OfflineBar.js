import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";
import { useNetworkStore } from "../lib/networkStore";

export default function OfflineBar() {
  const theme = useTheme();
  const isOffline = useNetworkStore((state) => state.isOffline);
  if (!isOffline) return null;
  return <View accessibilityRole="alert" style={[styles.bar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
    <Text style={[styles.label, { color: theme.muted, fontFamily: theme.fontFamily }]}>Offline</Text>
  </View>;
}

const styles = StyleSheet.create({ bar: { minHeight: 28, paddingHorizontal: 14, justifyContent: "center", borderBottomWidth: StyleSheet.hairlineWidth }, label: { fontSize: 12, fontWeight: "600" } });

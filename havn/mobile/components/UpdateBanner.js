import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";
import { useTheme } from "../lib/theme";
import { useAppStore } from "../stores/useAppStore";

export default function UpdateBanner() {
  const theme = useTheme();
  const release = useAppStore((state) => state.androidRelease);
  const dismissed = useAppStore((state) => state.updateDismissed);
  const dismiss = useAppStore((state) => state.dismissUpdate);
  if (!release?.available || dismissed) return null;
  return <View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <View style={styles.copy}><Text allowFontScaling style={[styles.title, { color: theme.text }]}>Update available</Text><Text allowFontScaling style={[styles.subtitle, { color: theme.muted }]} numberOfLines={2}>{release.notes || "A newer version of Havn is ready."}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Download update" onPress={() => release.apkUrl && Linking.openURL(release.apkUrl)} style={[styles.download, { backgroundColor: theme.primary }]}><Text style={styles.downloadText}>Update</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss update" onPress={dismiss} hitSlop={8} style={styles.close}><Icon name="close" size={18} color={theme.muted} /></Pressable>
  </View>;
}

const styles = StyleSheet.create({ banner: { marginHorizontal: 12, marginTop: 4, marginBottom: 6, borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }, copy: { flex: 1, minWidth: 0 }, title: { fontSize: 14, fontWeight: "800" }, subtitle: { fontSize: 12, marginTop: 3 }, download: { minHeight: 36, borderRadius: 10, justifyContent: "center", paddingHorizontal: 12 }, downloadText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" }, close: { minWidth: 24, minHeight: 32, alignItems: "center", justifyContent: "center" } });

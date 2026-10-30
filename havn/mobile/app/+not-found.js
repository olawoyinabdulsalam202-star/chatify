import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Icon from "../components/Icon";
import { useTheme } from "../lib/theme";

export default function NotFoundScreen() {
  const router = useRouter();
  const theme = useTheme();
  return <View style={[styles.screen, { backgroundColor: theme.background }]}>
    <Icon name="info" color={theme.primary} size={32} />
    <Text allowFontScaling style={[styles.title, { color: theme.text }]}>This page isn’t available</Text>
    <Text allowFontScaling style={[styles.copy, { color: theme.muted }]}>The link may be out of date. Return to your chats to continue.</Text>
    <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={styles.buttonText}>Go home</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }, title: { fontSize: 21, fontWeight: "700", textAlign: "center" }, copy: { fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 300 }, button: { minHeight: 46, borderRadius: 14, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", marginTop: 8 }, buttonText: { color: "#FFFFFF", fontWeight: "700" } });

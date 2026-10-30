import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import AppScreen from "../../components/AppScreen";
import Icon from "../../components/Icon";
import { useTheme } from "../../lib/theme";
import { useAuthStore } from "../../stores/useAuthStore";

const sections = [
  { key: "account", title: "Account", description: "Username and how people find you", icon: "user" },
  { key: "privacy", title: "Privacy", description: "Last seen, disappearing messages, away note", icon: "lock" },
  { key: "chats", title: "Chats", description: "Theme, font and message colour", icon: "palette" },
  { key: "notifications", title: "Notifications", description: "Message alerts on this device", icon: "bell" },
  { key: "help", title: "Help", description: "About Havn, terms and privacy", icon: "help" },
  { key: "devices", title: "Linked devices", description: "Review and sign out of devices", icon: "monitor" },
];

export default function SettingsIndex() {
  const router = useRouter();
  const theme = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const logOut = () => Alert.alert("Log out?", "You will need to sign in again to use Havn.", [
    { text: "Cancel", style: "cancel" },
    { text: "Log out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
  ]);
  return <AppScreen><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable><Text allowFontScaling style={[styles.title, { color: theme.text, fontFamily: theme.fontFamily }]}>Settings</Text></View>
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{sections.map((section, index) => <Pressable key={section.key} accessibilityRole="button" onPress={() => router.push(`/settings/${section.key}`)} style={[styles.row, index < sections.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}><View style={[styles.iconWrap, { backgroundColor: theme.elevated }]}><Icon name={section.icon} color={theme.primary} size={20} /></View><View style={styles.copy}><Text allowFontScaling style={[styles.rowTitle, { color: theme.text, fontFamily: theme.fontFamily, fontSize: 15 * theme.fontScale }]}>{section.title}</Text><Text allowFontScaling style={[styles.description, { color: theme.muted, fontFamily: theme.fontFamily, fontSize: 12 * theme.fontScale, lineHeight: 17 * theme.fontScale }]}>{section.description}</Text></View><Icon name="chevron" color={theme.muted} size={19} /></Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={logOut} style={[styles.logout, { backgroundColor: theme.danger + "12", borderColor: theme.danger + "44" }]}><Icon name="logout" color={theme.danger} size={19} /><Text allowFontScaling style={{ color: theme.danger, fontFamily: theme.fontFamily, fontSize: 15 * theme.fontScale, fontWeight: "700" }}>Log out</Text></Pressable>
  </ScrollView></AppScreen>;
}

const styles = StyleSheet.create({ content: { padding: 18, paddingBottom: 32 }, header: { flexDirection: "row", alignItems: "center", marginBottom: 18 }, back: { width: 45, height: 46, justifyContent: "center" }, title: { fontSize: 25, fontWeight: "800", marginLeft: 3 }, card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14 }, row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 10 }, iconWrap: { width: 42, height: 42, borderRadius: 22, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, minWidth: 0 }, rowTitle: { fontSize: 15, fontWeight: "700" }, description: { fontSize: 12, lineHeight: 17, marginTop: 3 }, logout: { minHeight: 50, marginTop: 20, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, });

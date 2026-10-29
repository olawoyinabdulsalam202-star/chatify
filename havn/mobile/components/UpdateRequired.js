import { Linking, StyleSheet, Text, View } from "react-native";
import AppScreen from "./AppScreen";
import ActionButton from "./ActionButton";
import { useTheme } from "../lib/theme";
import { useAppStore } from "../stores/useAppStore";

export default function UpdateRequired() {
  const theme = useTheme();
  const release = useAppStore((state) => state.androidRelease);
  return <AppScreen style={styles.screen}><View style={styles.center}>
    <Text allowFontScaling style={[styles.title, { color: theme.text }]}>Update required</Text>
    <Text allowFontScaling style={[styles.copy, { color: theme.muted }]}>Install the latest version of Havn to continue.</Text>
    {release?.notes ? <Text allowFontScaling style={[styles.notes, { color: theme.text }]}>{release.notes}</Text> : null}
    <ActionButton title="Download update" disabled={!release?.apkUrl} onPress={() => release?.apkUrl && Linking.openURL(release.apkUrl)} style={styles.button} />
  </View></AppScreen>;
}

const styles = StyleSheet.create({ screen: { padding: 22 }, center: { flex: 1, justifyContent: "center", alignItems: "center", maxWidth: 480, alignSelf: "center" }, title: { fontSize: 30, fontWeight: "800", textAlign: "center" }, copy: { fontSize: 16, lineHeight: 23, textAlign: "center", marginTop: 12 }, notes: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 18 }, button: { alignSelf: "stretch", marginTop: 26 } });

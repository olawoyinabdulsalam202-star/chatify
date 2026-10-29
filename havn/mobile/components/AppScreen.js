import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../lib/theme";

export default function AppScreen({ children, style, edges = ["top", "left", "right", "bottom"] }) {
  const theme = useTheme();
  return <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor: theme.background }, style]}><View style={styles.content}>{children}</View></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flex: 1, minWidth: 0, width: "100%", maxWidth: 760, alignSelf: "center" } });

import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import { useTheme } from "../lib/theme";

export default function AppSheet({ visible, title, rows = [], onClose, onBack, footer = "Cancel", children }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.avoid} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable onPress={onClose} style={styles.backdrop}><Pressable onPress={() => {}} style={[styles.sheet, { maxHeight: height * 0.9, backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel={onBack ? "Back" : "Close"} onPress={onBack || onClose} style={styles.headerButton}><Icon name={onBack ? "back" : "close"} color={theme.text} /></Pressable><Text allowFontScaling numberOfLines={1} style={[styles.title, { color: theme.text, fontFamily: theme.fontFamily, fontSize: 17 * theme.fontScale }]}>{title}</Text><View style={styles.headerButton} /></View>
        {children || <ScrollView style={styles.rows} keyboardShouldPersistTaps="handled" nestedScrollEnabled>{rows.map((row, index) => <Pressable key={`${row.label}-${index}`} accessibilityRole="button" onPress={row.onPress} style={[styles.row, { borderBottomColor: theme.border }]}><View style={[styles.rowIcon, { backgroundColor: theme.elevated }]}><Icon name={row.icon || "info"} color={row.destructive ? theme.danger : theme.primary} size={19} /></View><Text allowFontScaling style={[styles.rowLabel, { color: row.destructive ? theme.danger : theme.text, fontFamily: theme.fontFamily, fontSize: 15 * theme.fontScale }]}>{row.label}</Text></Pressable>)}</ScrollView>}
        {!!footer && <Pressable accessibilityRole="button" onPress={onClose} style={[styles.footer, { borderTopColor: theme.border }]}><Text allowFontScaling style={{ color: theme.muted, fontFamily: theme.fontFamily, fontWeight: "700" }}>{footer}</Text></Pressable>}
      </Pressable></Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({ avoid: { flex: 1, justifyContent: "flex-end" }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" }, sheet: { flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 }, header: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.2)" }, headerButton: { width: 44, height: 48, alignItems: "center", justifyContent: "center" }, title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800" }, rows: { flexShrink: 1, minHeight: 0 }, row: { minHeight: 57, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 3 }, rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, rowLabel: { flex: 1, fontSize: 15, fontWeight: "600" }, footer: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", marginTop: 2 } });

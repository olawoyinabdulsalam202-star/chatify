import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import { useTheme } from "../lib/theme";
import { dismissDialog, useDialogState } from "../lib/dialog";

export default function AppDialog() {
  const dialog = useDialogState();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const close = () => dismissDialog(null);
  const choose = (button) => {
    dismissDialog(button.text);
    button.onPress?.();
  };
  return <Modal visible={Boolean(dialog)} transparent animationType="fade" onRequestClose={close}>
    <KeyboardAvoidingView style={styles.avoid} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable onPress={close} style={styles.backdrop}><Pressable onPress={() => {}} style={[styles.card, { maxHeight: height * 0.9, backgroundColor: theme.surface, borderColor: theme.border, marginTop: insets.top, marginBottom: insets.bottom }]}>
        <View style={styles.header}><View style={{ flex: 1 }} /><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={close} style={styles.close}><Icon name="close" color={theme.text} size={21} /></Pressable></View>
        <Text allowFontScaling style={[styles.title, { color: theme.text, fontFamily: theme.fontFamily, fontSize: 19 * theme.fontScale }]}>{dialog?.title}</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {!!dialog?.message && <Text allowFontScaling style={[styles.message, { color: theme.muted, fontFamily: theme.fontFamily, fontSize: 14 * theme.fontScale }]}>{dialog.message}</Text>}
          <View style={styles.actions}>{(dialog?.buttons || []).map((button, index) => {
            const destructive = button.style === "destructive";
            const cancel = button.style === "cancel";
            return <Pressable key={`${button.text}-${index}`} accessibilityRole="button" onPress={() => choose(button)} style={[styles.action, { backgroundColor: destructive ? theme.danger : cancel ? theme.elevated : theme.primary }]}><Text allowFontScaling style={[styles.actionText, { color: cancel ? theme.text : theme.white, fontFamily: theme.fontFamily }]}>{button.text}</Text></Pressable>;
          })}</View>
        </ScrollView>
      </Pressable></Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({ avoid: { flex: 1 }, backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 22 }, card: { width: "100%", maxWidth: 440, flexShrink: 1, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 19 }, header: { minHeight: 40, flexDirection: "row", justifyContent: "flex-end" }, close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginTop: -9, marginRight: -8 }, title: { fontSize: 19, fontWeight: "800", marginBottom: 7 }, scroll: { flexShrink: 1, minHeight: 0 }, scrollContent: { paddingBottom: 4 }, message: { fontSize: 14, lineHeight: 21 }, actions: { gap: 9, marginTop: 20 }, action: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 }, actionText: { fontSize: 14, fontWeight: "700" } });

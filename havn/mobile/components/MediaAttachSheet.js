import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";

export default function MediaAttachSheet({ visible, theme, onClose, onGallery, onCamera, onDocument, onContact }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const options = [
    { title: "Gallery", icon: "image", action: onGallery },
    { title: "Camera", icon: "camera", action: onCamera },
    ...(onDocument ? [{ title: "Document", icon: "file", action: onDocument }] : []),
    ...(onContact ? [{ title: "Contact", icon: "user", action: onContact }] : []),
  ];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.avoid} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable onPress={onClose} style={styles.backdrop}><View style={[styles.sheet, { maxHeight: height * 0.9, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: theme.surface }]} onStartShouldSetResponder={() => true}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontFamily }]}>Attach</Text>
          <View style={styles.options}>{options.map((option) => <Pressable key={option.title} onPress={() => { onClose(); option.action?.(); }} style={styles.option}><View style={[styles.icon, { backgroundColor: theme.elevated }]}><Icon name={option.icon} color={theme.primary} size={22} /></View><Text style={{ color: theme.text, fontFamily: theme.fontFamily, fontSize: 13 }}>{option.title}</Text></Pressable>)}</View>
        </ScrollView>
      </View></Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({ avoid: { flex: 1, justifyContent: "flex-end" }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }, sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 9 }, scroll: { paddingBottom: 6 }, handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 15 }, title: { fontSize: 17, fontWeight: "700", marginBottom: 17 }, options: { flexDirection: "row", gap: 20, flexWrap: "wrap" }, option: { minWidth: 68, minHeight: 88, alignItems: "center", justifyContent: "center", gap: 7 }, icon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" } });

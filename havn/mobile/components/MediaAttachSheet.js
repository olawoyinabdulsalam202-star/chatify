import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";

export default function MediaAttachSheet({ visible, theme, onClose, onGallery, onCamera, onDocument, onContact }) {
  const options = [
    { title: "Gallery", icon: "image", action: onGallery },
    { title: "Camera", icon: "camera", action: onCamera },
    ...(onDocument ? [{ title: "Document", icon: "file", action: onDocument }] : []),
    ...(onContact ? [{ title: "Contact", icon: "user", action: onContact }] : []),
  ];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable onPress={onClose} style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: theme.surface }]}>
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <Text style={[styles.title, { color: theme.text }]}>Attach</Text>
      <View style={styles.options}>{options.map((option) => <Pressable key={option.title} onPress={() => { onClose(); option.action?.(); }} style={styles.option}><View style={[styles.icon, { backgroundColor: theme.elevated }]}><Icon name={option.icon} color={theme.primary} size={22} /></View><Text style={{ color: theme.text, fontSize: 13 }}>{option.title}</Text></Pressable>)}</View>
    </View></Pressable>
  </Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }, sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 9, paddingBottom: 30 }, handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 15 }, title: { fontSize: 17, fontWeight: "700", marginBottom: 17 }, options: { flexDirection: "row", gap: 20, flexWrap: "wrap" }, option: { width: 68, alignItems: "center", gap: 7 }, icon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" } });

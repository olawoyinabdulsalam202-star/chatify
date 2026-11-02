import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";

const reactions = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}"];

export default function MessageActionsSheet({ visible, message, theme, actions = [], onReact, showReactions = true, onClose }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        {showReactions && <View style={styles.reactions}>{reactions.map((emoji) => <Pressable key={emoji} accessibilityLabel={`React ${emoji}`} onPress={() => onReact?.(emoji)} style={styles.reaction}><Text style={styles.emoji}>{emoji}</Text></Pressable>)}</View>}
        {message?.text ? <Text numberOfLines={2} style={[styles.preview, { color: theme.muted }]}>{message.text}</Text> : null}
        {actions.map((action) => <Pressable key={action.key} onPress={() => { onClose(); action.onPress?.(); }} style={styles.action}>
          <Icon name={action.icon || "info"} color={action.destructive ? theme.danger : theme.text} size={19} />
          <Text style={{ color: action.destructive ? theme.danger : theme.text, fontSize: 15 }}>{action.label}</Text>
        </Pressable>)}
        <Pressable onPress={onClose} style={[styles.cancel, { borderTopColor: theme.border }]}><Text style={{ color: theme.muted, fontWeight: "600" }}>Cancel</Text></Pressable>
      </View>
    </Pressable>
  </Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" }, sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20 }, handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 }, reactions: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 12 }, reaction: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(127,127,127,0.12)" }, emoji: { fontSize: 24 }, preview: { paddingBottom: 8, fontSize: 13 }, action: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 14 }, cancel: { minHeight: 46, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, alignItems: "center", justifyContent: "center" } });

import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Icon from "./Icon";

export default function ChatInputBar({ theme, value, onChangeText, onEmoji, onAttach, onCamera, onSend, onRecord, onOffline, offline = false, sending, disabled, recordingVoice, voiceRecorder }) {
  const offlineAction = offline ? onOffline : null;
  const action = offlineAction || (value.trim() ? onSend : onRecord);
  return <View style={styles.row}>
    {recordingVoice ? <View style={[styles.voiceWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>{voiceRecorder}</View> : <View style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Emoji, stickers and GIFs" disabled={disabled} onPress={onEmoji} style={styles.innerButton}><Icon name="smile" color={theme.primary} size={22} /></Pressable>
      <TextInput allowFontScaling value={value} onChangeText={onChangeText} maxLength={2000} multiline editable={!disabled} placeholder="Message" placeholderTextColor={theme.muted} textAlignVertical="center" style={[styles.input, { color: theme.text, fontFamily: theme.fontFamily, fontSize: 16 * theme.fontScale }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Attach" disabled={disabled} onPress={onAttach} style={styles.innerButton}><Icon name="paperclip" color={theme.muted} size={22} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Take photo or video" disabled={disabled} onPress={onCamera} style={styles.innerButton}><Icon name="camera" color={theme.muted} size={21} /></Pressable>
    </View>}
    {!recordingVoice && <Pressable accessibilityRole="button" accessibilityLabel={offline ? "No connection" : value.trim() ? "Send message" : "Record voice note"} disabled={sending || disabled} onPress={action} style={[styles.round, { backgroundColor: theme.primary, opacity: sending || disabled || offline ? 0.5 : 1 }]}><Icon name={value.trim() ? "send" : "mic"} color="#FFFFFF" size={value.trim() ? 20 : 22} /></Pressable>}
  </View>;
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 9, paddingTop: 8 }, pill: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 128, borderWidth: 1, borderRadius: 26, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4, paddingVertical: 3 }, voiceWrap: { flex: 1, minWidth: 0 }, innerButton: { width: 40, height: 42, alignItems: "center", justifyContent: "center" }, input: { flex: 1, minWidth: 0, maxHeight: 116, minHeight: 40, paddingTop: 9, paddingBottom: 8, paddingHorizontal: 3 }, round: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 1 } });

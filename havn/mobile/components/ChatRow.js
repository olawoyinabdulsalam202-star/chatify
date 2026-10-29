import { Pressable, StyleSheet, Text, View } from "react-native";
import { format, isToday, isYesterday } from "date-fns";
import Avatar from "./Avatar";
import { useTheme } from "../lib/theme";

export function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return format(date, "p");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

export function messagePreview(message) {
  if (!message) return "Start a conversation";
  if (message.isDeleted) return "Message deleted";
  if (message.text) return message.text;
  if (message.viewOnce) return "View-once media";
  if (message.image) return "Photo";
  if (message.video) return "Video";
  if (message.audio) return "Voice message";
  if (message.gif) return "GIF";
  if (message.sticker) return "Sticker";
  return "New message";
}

export default function ChatRow({ person, onPress, online = false, unread = 0, assistant = false, assistantName = "Havn AI" }) {
  const theme = useTheme();
  const name = assistant ? assistantName : person?.fullName || person?.username || "Havn member";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.overlay : "transparent" }]}>
      <View style={styles.avatarWrap}>{assistant ? <View style={[styles.aiAvatar, { backgroundColor: theme.primary }]}><Text style={styles.aiText}>AI</Text></View> : <Avatar uri={person?.profilePic} name={name} size={50} online={online} showOnline={online} />}</View>
      <View style={[styles.detail, { borderBottomColor: theme.border }]}>
        <View style={styles.titleRow}><Text allowFontScaling numberOfLines={1} style={[styles.name, { color: theme.text }]}>{name}</Text><Text allowFontScaling style={[styles.time, { color: unread ? theme.primary : theme.muted }]}>{formatTime(person?.lastMessage?.createdAt)}</Text></View>
        <View style={styles.previewRow}><Text allowFontScaling numberOfLines={1} style={[styles.preview, { color: theme.muted }]}>{assistant ? "Your private AI chat" : person?.isRequest ? "Message request" : messagePreview(person?.lastMessage)}</Text>{unread > 0 && <View style={[styles.badge, { backgroundColor: theme.primary }]}><Text allowFontScaling style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text></View>}</View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({ row: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingLeft: 16, borderRadius: 14 }, avatarWrap: { width: 60, alignItems: "flex-start" }, aiAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" }, aiText: { color: "#FFF7ED", fontSize: 13, fontWeight: "800", letterSpacing: 0.5 }, detail: { flex: 1, minWidth: 0, height: "100%", justifyContent: "center", paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth }, titleRow: { flexDirection: "row", alignItems: "center", gap: 8 }, name: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: "700" }, time: { fontSize: 11, flexShrink: 0 }, previewRow: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 8 }, preview: { flex: 1, minWidth: 0, fontSize: 13 }, badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" }, badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" } });

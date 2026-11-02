import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";

export default function ViewOnceCard({ message, own, opened, onPress, theme }) {
  const video = Boolean(message.viewOnceIsVideo || message.video);
  const label = video ? "Video" : "Photo";
  const status = own
    ? message.groupId && message.viewOnceViewerCount ? `View-once ${label.toLowerCase()} ? ${message.viewOnceViewerCount} viewed` : message.viewOnceOpened ? `${label} opened` : `View-once ${label.toLowerCase()} sent`
    : opened || message.viewOnceOpenedByMe || message.viewOnceOpened ? "Opened" : `${label}, tap to view once`;
  return <Pressable disabled={own || opened || message.viewOnceOpenedByMe || message.viewOnceOpened} onPress={onPress} style={[styles.card, { backgroundColor: own ? "rgba(0,0,0,0.12)" : theme.elevated }]}>
    <View style={[styles.icon, { backgroundColor: own ? "rgba(255,255,255,0.18)" : theme.surface }]}><Icon name={video ? "camera" : "eye"} color={own ? "#FFFFFF" : theme.primary} size={19} /></View>
    <Text numberOfLines={2} style={[styles.label, { color: own ? "#FFFFFF" : theme.text }]}>{status}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({ card: { minHeight: 58, minWidth: 210, maxWidth: 270, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 11, padding: 9, marginVertical: 3 }, icon: { width: 38, height: 38, borderRadius: 20, alignItems: "center", justifyContent: "center" }, label: { flex: 1, fontSize: 14, fontWeight: "600" } });

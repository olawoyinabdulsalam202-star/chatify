import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { format } from "date-fns";
import Icon from "./Icon";
import { useTheme } from "../lib/theme";

function Receipt({ status }) {
  const theme = useTheme();
  if (!status) return null;
  if (status === "sent") return <Icon name="check" size={15} color={theme.muted} strokeWidth={2.2} />;
  return <Icon name="doubleCheck" size={17} color={status === "seen" ? "#4FA5F5" : theme.muted} strokeWidth={2.2} />;
}

export default function MessageBubble({ message, own, onReply, partnerName }) {
  const theme = useTheme();
  const [imageSize, setImageSize] = useState(null);
  const width = Math.min(330, Math.max(180, imageSize?.width || 300));
  const height = imageSize ? Math.min(420, width * imageSize.height / imageSize.width) : 210;
  const bubbleColor = own ? theme.outgoing : theme.incoming;
  const textColor = own ? theme.outgoingText : theme.incomingText;
  const time = message.createdAt ? format(new Date(message.createdAt), "p") : "";
  return (
    <View style={[styles.line, own ? styles.right : styles.left]}>
      <Pressable onLongPress={() => onReply?.(message)} delayLongPress={260} style={[styles.bubble, { backgroundColor: bubbleColor, borderBottomRightRadius: own ? 5 : 18, borderBottomLeftRadius: own ? 18 : 5 }]}>
        {message.replyTo && <View style={[styles.reply, { borderLeftColor: own ? "#FFD4B7" : theme.primary }]}><Text numberOfLines={1} style={[styles.replyName, { color: own ? "#FFE5D5" : theme.primary }]}>{String(message.replyTo.senderId) === String(message.senderId) ? "You" : partnerName || "Reply"}</Text><Text numberOfLines={2} style={[styles.replyText, { color: textColor }]}>{message.replyTo.text}</Text></View>}
        {message.image && <View style={[styles.media, { backgroundColor: theme.elevated }]}><Image source={{ uri: message.image }} contentFit="contain" style={{ width, height, maxWidth: "100%" }} onLoad={(event) => { const source = event.source; if (source?.width && source?.height) setImageSize({ width: source.width, height: source.height }); }} /></View>}
        {!!message.text && <Text selectable style={[styles.text, { color: textColor }]}>{message.text}</Text>}
        {message.isDeleted ? <Text style={[styles.deleted, { color: own ? "#FFE5D5" : theme.muted }]}>Message deleted</Text> : null}
        <View style={styles.meta}><Text style={[styles.time, { color: own ? "#FFE5D5" : theme.muted }]}>{time}{message.isEdited ? " · edited" : ""}</Text>{own && <Receipt status={message.status} />}</View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({ line: { width: "100%", paddingHorizontal: 12, marginVertical: 3, flexDirection: "row" }, right: { justifyContent: "flex-end" }, left: { justifyContent: "flex-start" }, bubble: { maxWidth: "86%", minWidth: 50, borderRadius: 18, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 6 }, media: { width: "100%", minHeight: 120, borderRadius: 14, overflow: "hidden", marginBottom: 5, alignItems: "center", justifyContent: "center" }, text: { fontSize: 16, lineHeight: 22 }, deleted: { fontSize: 14, fontStyle: "italic" }, meta: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }, time: { fontSize: 10 }, reply: { paddingLeft: 8, borderLeftWidth: 3, marginBottom: 7, paddingVertical: 3 }, replyName: { fontSize: 12, fontWeight: "700" }, replyText: { fontSize: 13 } });

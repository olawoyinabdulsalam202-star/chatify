import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { format } from "date-fns";
import Icon from "./Icon";
import { useTheme } from "../lib/theme";
import { getNativeFontFamily, loadFont } from "../lib/fonts";

function Receipt({ status }) {
  const theme = useTheme();
  if (!status) return null;
  if (status === "sent") return <Icon name="check" size={15} color={theme.muted} strokeWidth={2.2} />;
  return <Icon name="doubleCheck" size={17} color={status === "seen" ? "#4FA5F5" : theme.muted} strokeWidth={2.2} />;
}

export default function MessageBubble({ message, own, onReply, onImagePress, partnerName }) {
  const theme = useTheme();
  const [imageSize, setImageSize] = useState(null);
  const fontId = message.senderFontFamily || theme.fontId;
  const [fontReadyId, setFontReadyId] = useState("");
  useEffect(() => {
    let active = true;
    loadFont(fontId).finally(() => { if (active) setFontReadyId(fontId); });
    return () => { active = false; };
  }, [fontId]);
  const hasImage = Boolean(message.image && !message.isDeleted);
  const ratio = imageSize?.width && imageSize?.height ? imageSize.width / imageSize.height : 4 / 3;
  const width = Math.min(280, imageSize?.width || 280, imageSize ? 360 * ratio : 280);
  const height = Math.max(90, Math.min(360, width / ratio));
  const textColor = theme.fontColor || (own ? theme.outgoingText : theme.incomingText);
  const fontFamily = fontReadyId === fontId ? getNativeFontFamily(fontId) : theme.fontFamily;
  const time = message.createdAt ? format(new Date(message.createdAt), "p") : "";
  return <View style={[styles.line, own ? styles.right : styles.left]}>
    <Pressable onLongPress={() => onReply?.(message)} delayLongPress={260} style={[styles.bubble, hasImage && styles.imageBubble, { backgroundColor: own ? theme.outgoing : theme.incoming, borderBottomRightRadius: own ? 5 : 18, borderBottomLeftRadius: own ? 18 : 5 }]}>
      {message.replyTo && <View style={[styles.reply, { borderLeftColor: own ? "#FFD4B7" : theme.primary }]}><Text numberOfLines={1} style={[styles.replyName, { color: own ? "#FFE5D5" : theme.primary, fontFamily, fontSize: 12 * theme.fontScale }]}>{String(message.replyTo.senderId) === String(message.senderId) ? "You" : partnerName || "Reply"}</Text><Text numberOfLines={2} style={[styles.replyText, { color: textColor, fontFamily, fontSize: 13 * theme.fontScale }]}>{message.replyTo.text}</Text></View>}
      {hasImage && <Pressable onPress={() => onImagePress?.(message.image)} style={[styles.media, { width, height, backgroundColor: theme.elevated }]}><Image source={{ uri: message.image }} contentFit="cover" style={StyleSheet.absoluteFill} onLoad={(event) => { const source = event.source; if (source?.width && source?.height) setImageSize({ width: source.width, height: source.height }); }} /></Pressable>}
      {!!message.text && <Text selectable allowFontScaling style={[styles.text, hasImage && styles.caption, { color: textColor, fontFamily, fontSize: 16 * theme.fontScale, lineHeight: 22 * theme.fontScale }]}>{message.text}</Text>}
      {message.isDeleted ? <Text style={[styles.deleted, { color: own ? "#FFE5D5" : theme.muted, fontFamily, fontSize: 14 * theme.fontScale }]}>{"Message deleted"}</Text> : null}
      <View style={[styles.meta, hasImage && !message.text && styles.imageMeta]}><Text style={[styles.time, { color: hasImage && !message.text ? "#FFFFFF" : own ? "#FFE5D5" : theme.muted }]}>{time}{message.isEdited ? " · edited" : ""}</Text>{own && <Receipt status={message.status} />}</View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({ line: { width: "100%", paddingHorizontal: 12, marginVertical: 3, flexDirection: "row" }, right: { justifyContent: "flex-end" }, left: { justifyContent: "flex-start" }, bubble: { maxWidth: "86%", minWidth: 50, borderRadius: 18, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 6 }, imageBubble: { padding: 3, maxWidth: 286, overflow: "hidden" }, media: { maxWidth: "100%", borderRadius: 14, overflow: "hidden" }, text: { fontSize: 16, lineHeight: 22 }, caption: { paddingHorizontal: 7, paddingTop: 5 }, deleted: { fontSize: 14, fontStyle: "italic" }, meta: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }, imageMeta: { position: "absolute", right: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.48)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, marginTop: 0 }, time: { fontSize: 10 }, reply: { paddingLeft: 8, borderLeftWidth: 3, marginBottom: 7, paddingVertical: 3 }, replyName: { fontSize: 12, fontWeight: "700" }, replyText: { fontSize: 13 } });

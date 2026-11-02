import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { format } from "date-fns";
import Icon from "./Icon";
import AudioBubble from "./AudioBubble";
import { useTheme } from "../lib/theme";
import { getNativeFontFamily, loadFont } from "../lib/fonts";
import ViewOnceCard from "./ViewOnceCard";

function Receipt({ status }) {
  const theme = useTheme();
  if (!status) return null;
  if (status === "sent") return <Icon name="check" size={15} color={theme.muted} strokeWidth={2.2} />;
  return <Icon name="doubleCheck" size={17} color={status === "seen" ? "#4FA5F5" : theme.muted} strokeWidth={2.2} />;
}

export default function MessageBubble({ message, own, onReply, onLongPress, onImagePress, onViewOnce, viewOnceOpened = false, partnerName, senderName, showSender = false, highlighted = false, editing = false, editText = "", onEditChange, onSaveEdit, onCancelEdit, searchQuery = "" }) {
  const theme = useTheme();
  const [imageSize, setImageSize] = useState(null);
  const fontId = message.senderFontFamily || theme.fontId;
  const [fontReadyId, setFontReadyId] = useState("");
  useEffect(() => {
    let active = true;
    loadFont(fontId).finally(() => { if (active) setFontReadyId(fontId); });
    return () => { active = false; };
  }, [fontId]);
  const hasImage = Boolean(message.image && !message.isDeleted && !message.viewOnce);
  const hasAudio = Boolean(message.audio && !message.isDeleted);
  const hasSticker = Boolean(message.sticker && !message.isDeleted);
  const hasGif = Boolean(message.gif && !message.isDeleted);
  const floatingMedia = hasSticker || hasGif;
  const ratio = imageSize?.width && imageSize?.height ? imageSize.width / imageSize.height : 4 / 3;
  const width = Math.min(280, imageSize?.width || 280, imageSize ? 360 * ratio : 280);
  const height = Math.max(90, Math.min(360, width / ratio));
  const textColor = theme.fontColor || (own ? theme.outgoingText : theme.incomingText);
  const fontFamily = fontReadyId === fontId ? getNativeFontFamily(fontId) : theme.fontFamily;
  const time = message.createdAt ? format(new Date(message.createdAt), "p") : "";
  return <View style={[styles.line, own ? styles.right : styles.left]}>
    <Pressable onLongPress={() => (onLongPress || onReply)?.(message)} delayLongPress={260} style={[styles.bubble, hasImage && styles.imageBubble, floatingMedia && styles.floatingBubble, highlighted && styles.highlighted, message.isDeleted && styles.deletedBubble, { backgroundColor: floatingMedia ? "transparent" : own ? theme.outgoing : theme.incoming, borderBottomRightRadius: own ? 5 : 18, borderBottomLeftRadius: own ? 18 : 5 }]}>
      {showSender && !own && <Text style={[styles.sender, { color: theme.primary, fontFamily, fontSize: 12 * theme.fontScale }]}>{senderName || "Member"}</Text>}
      {message.replyTo && <View style={[styles.reply, { borderLeftColor: own ? "#FFD4B7" : theme.primary }]}><Text numberOfLines={1} style={[styles.replyName, { color: own ? "#FFE5D5" : theme.primary, fontFamily, fontSize: 12 * theme.fontScale }]}>{String(message.replyTo.senderId) === String(message.senderId) ? "You" : partnerName || "Reply"}</Text><Text numberOfLines={2} style={[styles.replyText, { color: textColor, fontFamily, fontSize: 13 * theme.fontScale }]}>{message.replyTo.text}</Text></View>}
      {message.viewOnce && !message.isDeleted && <ViewOnceCard message={message} own={own} opened={viewOnceOpened} onPress={() => onViewOnce?.(message)} theme={theme} />}
      {hasImage && <Pressable onPress={() => onImagePress?.(message.image)} style={[styles.media, { width, height, backgroundColor: theme.elevated }]}><Image source={{ uri: message.image }} contentFit="cover" style={StyleSheet.absoluteFill} onLoad={(event) => { const source = event.source; if (source?.width && source?.height) setImageSize({ width: source.width, height: source.height }); }} /></Pressable>}
      {hasSticker && <Image source={{ uri: message.sticker }} contentFit="contain" style={styles.sticker} />}
      {hasGif && <Pressable onPress={() => onImagePress?.(message.gif)}><Image source={{ uri: message.gif }} contentFit="contain" style={styles.gif} /></Pressable>}
      {hasAudio && <AudioBubble src={message.audio} duration={message.audioDuration} own={own} />}
      {editing ? <View style={styles.editBox}><TextInput value={editText} onChangeText={onEditChange} multiline style={[styles.editInput, { color: textColor, borderColor: theme.border, fontFamily, fontSize: 16 * theme.fontScale }]} /><View style={styles.editActions}><Pressable onPress={onCancelEdit}><Text style={{ color: theme.muted }}>Cancel</Text></Pressable><Pressable onPress={onSaveEdit}><Text style={{ color: theme.primary, fontWeight: "700" }}>Save</Text></Pressable></View></View> : !!message.text && <Text selectable allowFontScaling style={[styles.text, hasImage && styles.caption, searchQuery && message.text.toLowerCase().includes(searchQuery.toLowerCase()) && styles.searchMatch, { color: textColor, fontFamily, fontSize: 16 * theme.fontScale, lineHeight: 22 * theme.fontScale }]}>{message.text}</Text>}
      {message.isDeleted ? <Text style={[styles.deleted, { color: own ? "#FFE5D5" : theme.muted, fontFamily, fontSize: 14 * theme.fontScale }]}>{"Message deleted"}</Text> : null}
      <View style={[styles.meta, hasImage && !message.text && styles.imageMeta]}><Text style={[styles.time, { color: hasImage && !message.text ? "#FFFFFF" : own ? "#FFE5D5" : theme.muted }]}>{time}{message.isEdited ? " · edited" : ""}</Text>{own && <Receipt status={message.status} />}</View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({ line: { width: "100%", paddingHorizontal: 12, marginVertical: 3, flexDirection: "row" }, right: { justifyContent: "flex-end" }, left: { justifyContent: "flex-start" }, bubble: { maxWidth: "86%", minWidth: 50, borderRadius: 18, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 6 }, highlighted: { borderWidth: 2, borderColor: "#C2410C" }, deletedBubble: { opacity: 0.72 }, imageBubble: { padding: 3, maxWidth: 286, overflow: "hidden" }, floatingBubble: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, minWidth: 0 }, media: { maxWidth: "100%", borderRadius: 14, overflow: "hidden" }, sticker: { width: 150, height: 150 }, gif: { width: 230, height: 170, maxWidth: "100%", borderRadius: 12 }, sender: { fontWeight: "700", marginBottom: 4 }, text: { fontSize: 16, lineHeight: 22 }, searchMatch: { backgroundColor: 'rgba(255,193,7,0.32)', borderRadius: 3 }, caption: { paddingHorizontal: 7, paddingTop: 5 }, deleted: { fontSize: 14, fontStyle: "italic" }, editBox: { minWidth: 190, gap: 8 }, editInput: { minHeight: 48, maxHeight: 130, borderWidth: 1, borderRadius: 10, padding: 8, textAlignVertical: "top" }, editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 18 }, meta: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }, imageMeta: { position: "absolute", right: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.48)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, marginTop: 0 }, time: { fontSize: 10 }, reply: { paddingLeft: 8, borderLeftWidth: 3, marginBottom: 7, paddingVertical: 3 }, replyName: { fontSize: 12, fontWeight: "700" }, replyText: { fontSize: 13 } });

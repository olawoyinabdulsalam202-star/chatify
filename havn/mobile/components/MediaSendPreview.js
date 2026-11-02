import { showDialog } from "../lib/dialog";
import { showToast } from "../lib/toast";
import { useState } from "react";
import { ActivityIndicator, Image as NativeImage, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import Icon from "./Icon";
import { useTheme } from "../lib/theme";

function PreviewVideo({ uri }) {
  const player = useVideoPlayer(uri, (instance) => { instance.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

export default function MediaSendPreview({ asset, recipientName, onClose, onSend }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [caption, setCaption] = useState("");
  const [viewOnce, setViewOnce] = useState(false);
  const [sending, setSending] = useState(false);
  const video = asset?.type === "video" || asset?.mimeType?.startsWith("video/");
  const uri = asset?.uri;
  if (!asset) return null;
  const toggleViewOnce = () => {
    setViewOnce((value) => !value);
    if (!viewOnce) {
      showToast("View once on", "info");
    }
  };
  const send = async () => {
    if (sending) return;
    setSending(true);
    let sent = false;
    try { await onSend({ asset, caption: caption.trim(), viewOnce }); sent = true; }
    catch (error) {
      showDialog("Media not sent", error.message || "Please try again.");
    }
    if (sent) onClose();
    else setSending(false);
  };
  return <Modal visible={true} animationType="slide" statusBarTranslucent onRequestClose={() => { if (!sending) onClose(); }}>
    <View style={styles.screen}>
      {video ? <PreviewVideo uri={uri} /> : <NativeImage source={{ uri }} resizeMode="contain" style={StyleSheet.absoluteFill} />}
      <Pressable accessibilityRole="button" accessibilityLabel="Close media preview" disabled={sending} onPress={onClose} style={[styles.close, { top: insets.top + 10, opacity: sending ? 0.5 : 1 }]}><Icon name="close" color="#FFFFFF" size={23} /></Pressable>
      <KeyboardAvoidingView style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.recipient}><Text numberOfLines={1} style={styles.recipientText}>{recipientName}</Text></View>
        <View style={styles.controls}>
          <View style={styles.captionPill}>
            <TextInput allowFontScaling value={caption} onChangeText={(value) => setCaption(value.slice(0, 2000))} multiline maxLength={2000} placeholder="Add a caption…" placeholderTextColor="#A8A29E" style={styles.caption} />
            <Pressable accessibilityRole="button" accessibilityLabel={viewOnce ? "Turn view once off" : "Turn view once on"} onPress={toggleViewOnce} style={[styles.onceButton, viewOnce && { backgroundColor: theme.primary, borderColor: theme.primary }]}><Text style={[styles.onceText, viewOnce && styles.onceTextActive]}>1</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Send media" disabled={sending} onPress={send} style={[styles.send, { backgroundColor: theme.primary }, sending && { opacity: 0.6 }]}>{sending ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="send" size={21} color="#FFFFFF" />}</Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#000000" }, close: { position: "absolute", zIndex: 2, left: 14, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" }, bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 12, backgroundColor: "rgba(0,0,0,0.28)" }, recipient: { alignSelf: "flex-start", maxWidth: "75%", borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 13, paddingVertical: 8, marginBottom: 10 }, recipientText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 }, controls: { flexDirection: "row", alignItems: "flex-end", gap: 9 }, captionPill: { flex: 1, minHeight: 48, maxHeight: 125, borderRadius: 25, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 8, paddingVertical: 3 }, caption: { flex: 1, minWidth: 0, maxHeight: 112, minHeight: 40, color: "#292524", paddingHorizontal: 8, paddingTop: 10, paddingBottom: 8, fontSize: 16 }, onceButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: "#78716C", alignItems: "center", justifyContent: "center", marginBottom: 1 }, onceText: { fontSize: 17, fontWeight: "700", color: "#57534E" }, onceTextActive: { color: "#FFFFFF" }, send: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginBottom: 1 } });

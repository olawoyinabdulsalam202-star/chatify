import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { format } from "date-fns";
import AppScreen from "../../components/AppScreen";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import LoadingView from "../../components/LoadingView";
import { useTheme } from "../../lib/theme";
import { uploadImage } from "../../lib/upload";
import { getSocket } from "../../lib/socket";
import { useGroupStore } from "../../stores/useGroupStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PhotoViewer from "../../components/PhotoViewer";
import { useAuthStore } from "../../stores/useAuthStore";
import MessageBubble from "../../components/MessageBubble";

export default function GroupChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams();
  const id = String(rawId || "");
  const listRef = useRef(null);
  const [group, setGroup] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUri, setImageUri] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const currentUserId = useAuthStore((state) => state.authUser?._id);
  const messages = useGroupStore((state) => state.messages);
  const open = useGroupStore((state) => state.open);
  const close = useGroupStore((state) => state.close);
  const send = useGroupStore((state) => state.send);
  useEffect(() => { let active = true; open(id).then((result) => { if (active) setGroup(result); }).catch((error) => Alert.alert("Group", error.message)); return () => { active = false; close(); }; }, [id]);
  useEffect(() => {
    const socket = getSocket(); if (!socket) return undefined;
    const incoming = (message) => useGroupStore.getState().receive(message);
    const changed = (message) => { if (message.groupId) useGroupStore.getState().editMessage(message); };
    const rejoin = () => { if (id) apiQuiet(id); };
    socket.on("newGroupMessage", incoming); socket.on("messageEdited", changed); socket.on("messageDeleted", changed); socket.on("connect", rejoin);
    return () => { socket.off("newGroupMessage", incoming); socket.off("messageEdited", changed); socket.off("messageDeleted", changed); socket.off("connect", rejoin); };
  }, [id]);
  const apiQuiet = async (groupId) => { const { api } = await import("../../lib/api"); const rows = await api(`/groups/${groupId}/messages`); useGroupStore.setState({ messages: rows }); };
  useEffect(() => { listRef.current?.scrollToEnd({ animated: true }); }, [messages.length]);
  const sendText = async () => { const text = draft.trim(); if (!text || sending) return; setDraft(""); setSending(true); try { await send(id, { text }); } catch (error) { Alert.alert("Message not sent", error.message); setDraft(text); } finally { setSending(false); } };
  const attach = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.88 }); if (result.canceled || !result.assets?.[0]) return; setSending(true); setUploadProgress(0); try { const image = await uploadImage(result.assets[0], setUploadProgress); await send(id, { image }); } catch (error) { Alert.alert("Image not sent", error.message); } finally { setSending(false); } };
  const rows = useMemo(() => messages, [messages]);
  if (!group) return <AppScreen><LoadingView label="Opening group" /></AppScreen>;
  return <AppScreen edges={["top", "left", "right"]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={[styles.header, { borderBottomColor: theme.border }]}><Pressable onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable><Avatar uri={group.avatar} name={group.name} size={42} /><Pressable onPress={() => setInfoOpen(true)} style={{ flex: 1, minWidth: 0 }}><Text allowFontScaling numberOfLines={1} style={[styles.title, { color: theme.fontColor || theme.text, fontFamily: theme.fontFamily, fontSize: 16 * theme.fontScale }]}>{group.name}</Text><Text allowFontScaling numberOfLines={1} style={{ color: theme.muted, fontFamily: theme.fontFamily, fontSize: 12 * theme.fontScale }}>{group.members?.length || 0} members · Group info</Text></Pressable><Pressable onPress={() => setInfoOpen(true)} style={styles.back}><Icon name="users" color={theme.text} /></Pressable></View>
    <FlatList ref={listRef} data={rows} keyExtractor={(item) => String(item._id)} contentContainerStyle={{ paddingVertical: 10, flexGrow: 1 }} renderItem={({ item }) => { const mine = String(item.senderId?._id || item.senderId) === String(currentUserId); return <MessageBubble message={{ ...item, senderId: item.senderId?._id || item.senderId }} own={mine} partnerName={item.senderId?.fullName || "Member"} onImagePress={setImageUri} />; }} ListEmptyComponent={<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Text style={{ color: theme.muted }}>Start the conversation</Text></View>} />
    <View style={[styles.composer, { borderTopColor: theme.border, paddingBottom: Math.max(8, insets.bottom) }]}><Pressable disabled={sending} onPress={attach} style={styles.tool}>{sending ? <ActivityIndicator color={theme.primary} /> : <Icon name="image" color={theme.primary} />}</Pressable><TextInput allowFontScaling value={draft} onChangeText={setDraft} placeholder="Message" placeholderTextColor={theme.muted} multiline style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border, fontFamily: theme.fontFamily, fontSize: 16 * theme.fontScale }]} /><Pressable disabled={!draft.trim() || sending} onPress={sendText} style={[styles.send, { backgroundColor: theme.primary, opacity: !draft.trim() || sending ? 0.5 : 1 }]}><Icon name="send" size={19} color="#FFFFFF" /></Pressable></View>
    {sending && uploadProgress > 0 && <View style={{ height: 3, backgroundColor: theme.border }}><View style={{ height: 3, width: Math.max(4, Math.round(uploadProgress * 100)) + "%", backgroundColor: theme.primary }} /></View>}
    <PhotoViewer uri={imageUri} onClose={() => setImageUri(null)} />
    <Modal visible={infoOpen} animationType="slide" transparent onRequestClose={() => setInfoOpen(false)}><View style={styles.infoBackdrop}><View style={[styles.infoSheet, { backgroundColor: theme.background }]}><View style={styles.infoHeader}><Text style={{ color: theme.text, fontWeight: "800", fontSize: 19 }}>Group info</Text><Pressable onPress={() => setInfoOpen(false)} style={styles.back}><Icon name="close" color={theme.text} /></Pressable></View><View style={styles.groupProfile}><Avatar uri={group.avatar} name={group.name} size={62} /><Text style={{ color: theme.text, fontSize: 17, fontWeight: "700", marginTop: 10 }}>{group.name}</Text><Text style={{ color: theme.muted, marginTop: 3 }}>{group.members?.length || 0} members</Text></View><FlatList data={group.members || []} keyExtractor={(member, index) => String(member.userId?._id || member.userId || index)} renderItem={({ item }) => <View style={styles.memberRow}><Avatar uri={item.userId?.profilePic} name={item.userId?.fullName || "Member"} size={42} /><Text numberOfLines={1} style={{ flex: 1, color: theme.text }}>{item.userId?.fullName || "Member"}</Text><Text style={{ color: theme.muted, fontSize: 12 }}>{item.role || "member"}</Text></View>} /></View></View></Modal>
  </KeyboardAvoidingView></AppScreen>;
}

const styles = StyleSheet.create({ header: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8 }, back: { width: 42, height: 48, justifyContent: "center", alignItems: "center" }, title: { fontSize: 16, fontWeight: "700" }, bubble: { maxWidth: "86%", minWidth: 68, padding: 9, borderRadius: 16 }, messageImage: { width: 240, maxWidth: "100%", aspectRatio: 1, borderRadius: 11 }, composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 7, paddingHorizontal: 8, flexDirection: "row", alignItems: "flex-end", gap: 7 }, tool: { width: 44, height: 48, alignItems: "center", justifyContent: "center" }, input: { flex: 1, minHeight: 48, maxHeight: 108, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 }, send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }, viewer: { flex: 1, backgroundColor: "#000", justifyContent: "center" }, close: { position: "absolute", right: 18, top: 50, zIndex: 1, width: 48, height: 48, alignItems: "center", justifyContent: "center" }, infoBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }, infoSheet: { maxHeight: "82%", minHeight: "55%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 17, paddingBottom: 12 }, infoHeader: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, groupProfile: { alignItems: "center", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#86786A" }, memberRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.2)" } });

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Clipboard, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, Vibration, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { format } from "date-fns";
import AppScreen from "../../components/AppScreen";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import LoadingView from "../../components/LoadingView";
import { useTheme } from "../../lib/theme";
import { uploadAudio, uploadImage, uploadVideo } from "../../lib/upload";
import { getSocket } from "../../lib/socket";
import { useGroupStore } from "../../stores/useGroupStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PhotoViewer from "../../components/PhotoViewer";
import { useAuthStore } from "../../stores/useAuthStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { presenceLabel } from "../../lib/lastSeen";
import MessageBubble from "../../components/MessageBubble";
import VoiceRecorder from "../../components/VoiceRecorder";
import MediaPickerSheet from "../../components/MediaPickerSheet";
import { api } from "../../lib/api";
import MessageActionsSheet from "../../components/MessageActionsSheet";
import ForwardMessageSheet from "../../components/ForwardMessageSheet";
import SwipeReplyRow from "../../components/SwipeReplyRow";
import { hideMessageForMe, loadHiddenMessages } from "../../lib/messageVisibility";
import ViewOnceViewer from "../../components/ViewOnceViewer";
import ChatInputBar from "../../components/ChatInputBar";
import MediaAttachSheet from "../../components/MediaAttachSheet";
import MediaSendPreview from "../../components/MediaSendPreview";

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
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [viewingOnce, setViewingOnce] = useState(null);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [typingIds, setTypingIds] = useState([]);
  const typingTimer = useRef(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [contacts, setContacts] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");
  const [actionMessage, setActionMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState([]);
  const currentUserId = useAuthStore((state) => state.authUser?._id);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const messages = useGroupStore((state) => state.messages);
  const open = useGroupStore((state) => state.open);
  const close = useGroupStore((state) => state.close);
  const send = useGroupStore((state) => state.send);
  useEffect(() => { let active = true; open(id).then((result) => { if (active) { setGroup(result); setEditName(result.name || ""); setEditDescription(result.description || ""); } }).catch((error) => Alert.alert("Group", error.message)); return () => { active = false; clearTimeout(typingTimer.current); close(); }; }, [id]);
  useEffect(() => { loadHiddenMessages(currentUserId).then(setHiddenMessageIds); }, [currentUserId]);
  useEffect(() => {
    const socket = getSocket(); if (!socket) return undefined;
    const memberIds = new Set((group?.members || []).map((member) => String(member.userId?._id || member.userId)));
    const incomingTyping = ({ senderId }) => { if (String(senderId) !== String(currentUserId) && memberIds.has(String(senderId))) setTypingIds((items) => items.includes(String(senderId)) ? items : [...items, String(senderId)]); };
    const incomingStopTyping = ({ senderId }) => setTypingIds((items) => items.filter((item) => item !== String(senderId)));
    const incoming = (message) => useGroupStore.getState().receive(message);
    const changed = (message) => { if (message.groupId) useGroupStore.getState().editMessage(message); };
    const rejoin = () => { if (id) apiQuiet(id); };
    socket.on("typing", incomingTyping); socket.on("stopTyping", incomingStopTyping); socket.on("newGroupMessage", incoming); socket.on("messageEdited", changed); socket.on("messageDeleted", changed); socket.on("messageReaction", changed); socket.on("connect", rejoin);
    return () => { socket.off("typing", incomingTyping); socket.off("stopTyping", incomingStopTyping); socket.off("newGroupMessage", incoming); socket.off("messageEdited", changed); socket.off("messageDeleted", changed); socket.off("messageReaction", changed); socket.off("connect", rejoin); };
  }, [id, currentUserId, group?.members]);
  const apiQuiet = async (groupId) => { const { api } = await import("../../lib/api"); const rows = await api(`/groups/${groupId}/messages`); useGroupStore.setState({ messages: rows }); };
  useEffect(() => { listRef.current?.scrollToEnd({ animated: true }); }, [messages.length]);
  const sendText = async () => { const text = draft.trim(); if (!text || sending) return; setDraft(""); setSending(true); try { await send(id, { text, replyToId: replyTarget?._id }); setReplyTarget(null); } catch (error) { Alert.alert("Message not sent", error.message); setDraft(text); } finally { setSending(false); } };
  const chooseMedia = async (source) => {
    if (sending) return;
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { Alert.alert("Camera permission needed", "Allow Havn to use the camera to take a photo or video."); return; }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert("Photo permission needed", "Allow Havn to access photos before sending media."); return; }
    }
    const options = { mediaTypes: ["images", "videos"], quality: 0.88, allowsEditing: false };
    const selection = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!selection.canceled && selection.assets?.[0]) setPendingMedia(selection.assets[0]);
  };
  const sendSelectedMedia = async ({ asset, caption, viewOnce }) => {
    const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video/");
    setSending(true);
    setUploadProgress(0);
    try {
      const url = isVideo ? await uploadVideo(asset, setUploadProgress) : await uploadImage(asset, setUploadProgress);
      await send(id, { [isVideo ? "video" : "image"]: url, text: caption, ...(viewOnce ? { viewOnce: true } : {}) });
      setPendingMedia(null);
    } catch (error) { Alert.alert("Media not sent", error.message); }
    finally { setSending(false); }
  };
  const onDraftChange = (value) => {
    setDraft(value);
    const socket = getSocket();
    (group?.members || []).forEach((member) => {
      const memberId = String(member.userId?._id || member.userId);
      if (memberId !== String(currentUserId)) socket?.emit(value.trim() ? "typing" : "stopTyping", { receiverId: memberId });
    });
    clearTimeout(typingTimer.current);
    if (value.trim()) typingTimer.current = setTimeout(() => (group?.members || []).forEach((member) => { const memberId = String(member.userId?._id || member.userId); if (memberId !== String(currentUserId)) socket?.emit("stopTyping", { receiverId: memberId }); }), 1200);
  };
  const openViewOnce = async (message) => { try { const media = await api(`/messages/view-once/${message._id}`, { method: "POST" }); if (media.message) useGroupStore.getState().editMessage(media.message); setViewingOnce(media); } catch (error) { Alert.alert("Could not open media", error.message); } };
  const sendVoice = async ({ asset, audioDuration }) => {
    setSending(true);
    setUploadProgress(0);
    try {
      const audio = await uploadAudio(asset, setUploadProgress);
      await send(id, { audio, audioDuration });
    } finally {
      setSending(false);
    }
  };
  const rows = useMemo(() => messages.filter((message) => !hiddenMessageIds.includes(String(message._id))), [messages, hiddenMessageIds]);
  if (!group) return <AppScreen><LoadingView label="Opening group" /></AppScreen>;
  const myMember = group.members?.find((member) => String(member.userId?._id || member.userId) === String(currentUserId));
  const isAdmin = myMember?.role === "admin";
  const canPost = group.type !== "channel" || isAdmin;
  const reloadGroup = async () => { const latest = await api(`/groups/${id}`); setGroup(latest); };
  const saveGroupDetails = async () => { try { const result = await api(`/groups/${id}`, { method: "PUT", body: { name: editName, description: editDescription } }); setGroup(result); Alert.alert("Group updated", "Your changes have been saved."); } catch (error) { Alert.alert("Couldn't update group", error.message); } };
  const chooseGroupPhoto = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 }); if (result.canceled || !result.assets?.[0]?.base64) return; try { const asset = result.assets[0]; const avatar = `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`; setGroup(await api(`/groups/${id}`, { method: "PUT", body: { avatar } })); } catch (error) { Alert.alert("Photo not updated", error.message); } };
  const loadContacts = async () => { try { const data = await api("/messages/contacts"); setContacts(Array.isArray(data) ? data : []); } catch (error) { Alert.alert("Couldn't load contacts", error.message); } };
  const inviteContact = async (userId) => { try { await api(`/groups/${id}/invites`, { method: "POST", body: { memberIds: [userId] } }); Alert.alert("Invite sent", "The contact can now accept the group invitation."); } catch (error) { Alert.alert("Invite not sent", error.message); } };
  const manageMember = (member) => { const userId = String(member.userId?._id || member.userId); if (userId === String(currentUserId)) return; Alert.alert(member.userId?.fullName || "Member", "Group member actions", [{ text: "Cancel", style: "cancel" }, { text: member.role === "admin" ? "Make member" : "Make admin", onPress: async () => { try { await api(`/groups/${id}/members/${userId}/role`, { method: "PUT", body: { role: member.role === "admin" ? "member" : "admin" } }); await reloadGroup(); } catch (error) { Alert.alert("Role not changed", error.message); } } }, { text: "Remove", style: "destructive", onPress: async () => { try { await api(`/groups/${id}/members/${userId}`, { method: "DELETE" }); await reloadGroup(); } catch (error) { Alert.alert("Member not removed", error.message); } } }]); };
  const toggleReaction = async (message, emoji) => { try { const updated = await api(`/messages/react/${message._id}`, { method: "PUT", body: { emoji } }); useGroupStore.getState().editMessage(updated); } catch (error) { Alert.alert("Reaction not saved", error.message); } };
  const messageActions = (message) => { Vibration.vibrate(10); setActionMessage(message); };
  const actionList = actionMessage ? [
    ...(!actionMessage.isDeleted ? [{ key: "reply", label: "Reply", icon: "reply", onPress: () => setReplyTarget(actionMessage) }] : []),
    ...(actionMessage.text ? [{ key: "copy", label: "Copy", icon: "copy", onPress: () => Clipboard.setString(actionMessage.text) }] : []),
    ...(!actionMessage.viewOnce && !actionMessage.isDeleted ? [{ key: "forward", label: "Forward", icon: "forward", onPress: () => setForwardingMessage(actionMessage) }] : []),
    ...(String(actionMessage.senderId?._id || actionMessage.senderId) === String(currentUserId) && actionMessage.text && !actionMessage.isDeleted ? [{ key: "edit", label: "Edit", icon: "edit", onPress: () => { setEditingMessage(actionMessage); setEditText(actionMessage.text); } }] : []),
    { key: "delete-me", label: "Delete for me", icon: "trash", destructive: true, onPress: async () => setHiddenMessageIds(await hideMessageForMe(currentUserId, actionMessage._id)) },
    ...((String(actionMessage.senderId?._id || actionMessage.senderId) === String(currentUserId) || isAdmin) && !actionMessage.isDeleted ? [{ key: "delete-everyone", label: "Delete for everyone", icon: "trash", destructive: true, onPress: () => Alert.alert("Delete for everyone?", "This message will be removed for everyone in the group.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { const updated = await api(`/messages/delete/${actionMessage._id}`, { method: "DELETE" }); useGroupStore.getState().editMessage(updated); } catch (error) { Alert.alert("Message not deleted", error.message); } } }]) }] : []),
  ] : [];
  return <AppScreen edges={["top", "left", "right"]}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={[styles.header, { borderBottomColor: theme.border }]}><Pressable onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable><Avatar uri={group.avatar} name={group.name} size={42} /><Pressable onPress={() => setInfoOpen(true)} style={{ flex: 1, minWidth: 0 }}><Text allowFontScaling numberOfLines={1} style={[styles.title, { color: theme.fontColor || theme.text, fontFamily: theme.fontFamily, fontSize: 16 * theme.fontScale }]}>{group.name}</Text><Text allowFontScaling numberOfLines={1} style={{ color: theme.muted, fontFamily: theme.fontFamily, fontSize: 12 * theme.fontScale }}>{typingIds.length ? `${group.members?.find((member) => String(member.userId?._id || member.userId) === typingIds[0])?.userId?.fullName || "Someone"} is typing` : `${group.members?.length || 0} members ? Group info`}</Text></Pressable><Pressable onPress={() => setInfoOpen(true)} style={styles.back}><Icon name="users" color={theme.text} /></Pressable></View>
    <FlatList ref={listRef} data={rows} keyExtractor={(item) => String(item._id)} contentContainerStyle={{ paddingVertical: 10, flexGrow: 1 }} renderItem={({ item, index }) => {
      const rawSender = item.senderId;
      const senderId = String(rawSender?._id || rawSender);
      const member = (group.members || []).find((entry) => String(entry.userId?._id || entry.userId) === senderId);
      const sender = rawSender && typeof rawSender === "object" ? { ...member?.userId, ...rawSender } : member?.userId || {};
      const mine = senderId === String(currentUserId);
      if (item.isSystemMessage || item.system) return <Text style={{ alignSelf: "center", color: theme.muted, fontSize: 12, marginVertical: 8 }}>{item.text}</Text>;
      const previousId = index > 0 ? String(rows[index - 1].senderId?._id || rows[index - 1].senderId) : null;
      const nextId = index < rows.length - 1 ? String(rows[index + 1].senderId?._id || rows[index + 1].senderId) : null;
      const firstInRun = senderId !== previousId;
      const lastInRun = senderId !== nextId;
      return <View style={{ marginTop: firstInRun ? 9 : 1 }}><View style={{ flexDirection: "row", alignItems: "flex-end" }}>{!mine && <View style={{ width: 36, alignItems: "center" }}>{lastInRun ? <Avatar uri={sender.profilePic} name={sender.fullName || "Member"} size={32} /> : null}</View>}<View style={{ flex: 1, minWidth: 0 }}><SwipeReplyRow own={mine} theme={theme} onReply={() => setReplyTarget(item)}><MessageBubble message={{ ...item, senderId }} own={mine} showSender={!mine && firstInRun} partnerName={sender.fullName || "Member"} senderName={sender.fullName || "Member"} highlighted={String(actionMessage?._id) === String(item._id)} editing={String(editingMessage?._id) === String(item._id)} editText={editText} onEditChange={setEditText} onCancelEdit={() => setEditingMessage(null)} onSaveEdit={async () => { try { const updated = await api(`/messages/edit/${item._id}`, { method: "PUT", body: { text: editText.trim() } }); useGroupStore.getState().editMessage(updated); setEditingMessage(null); } catch (error) { Alert.alert("Message not edited", error.message); } }} onLongPress={messageActions} onImagePress={setImageUri} onViewOnce={openViewOnce} viewOnceOpened={Boolean(item.viewOnceOpenedByMe || item.viewOnceViewers?.some((viewer) => String(viewer.userId?._id || viewer.userId) === String(currentUserId)))} /></SwipeReplyRow></View></View>{Array.isArray(item.reactions) && item.reactions.length > 0 && <View style={{ flexDirection: "row", gap: 5, marginLeft: 42, marginBottom: 4 }}>{[...new Set(item.reactions.map((reaction) => reaction.emoji))].map((emoji) => <Pressable key={emoji} onPress={() => toggleReaction(item, emoji)} style={{ backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3 }}><Text>{emoji} {item.reactions.filter((reaction) => reaction.emoji === emoji).length}</Text></Pressable>)}</View>}</View>;
    }} ListEmptyComponent={<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Text style={{ color: theme.muted }}>Start the conversation</Text></View>} />
    {replyTarget && <View style={{ flexDirection: "row", alignItems: "center", padding: 9, backgroundColor: theme.surface }}><Text numberOfLines={1} style={{ flex: 1, color: theme.muted }}>Replying to {replyTarget.senderId?.fullName || "message"}: {replyTarget.text || "Attachment"}</Text><Pressable onPress={() => setReplyTarget(null)}><Icon name="close" color={theme.muted} size={20} /></Pressable></View>}
    {!canPost ? <View style={[styles.composer, { borderTopColor: theme.border, paddingBottom: Math.max(8, insets.bottom) }]}><Text style={{ color: theme.muted, textAlign: "center", flex: 1, padding: 12 }}>Only admins can post in this channel.</Text></View> : <View style={[styles.composer, { borderTopColor: theme.border, paddingBottom: Math.max(8, insets.bottom) }]}><ChatInputBar theme={theme} value={draft} onChangeText={onDraftChange} onEmoji={() => setPickerOpen(true)} onAttach={() => setAttachOpen(true)} onCamera={() => chooseMedia("camera")} onSend={sendText} onRecord={() => setRecordingVoice(true)} sending={sending} recordingVoice={recordingVoice} voiceRecorder={<VoiceRecorder theme={theme} onSend={sendVoice} onCancel={() => setRecordingVoice(false)} />} /></View>}
    {sending && uploadProgress > 0 && <View style={{ height: 3, backgroundColor: theme.border }}><View style={{ height: 3, width: Math.max(4, Math.round(uploadProgress * 100)) + "%", backgroundColor: theme.primary }} /></View>}
    <PhotoViewer uri={imageUri} onClose={() => setImageUri(null)} />
    <MediaAttachSheet visible={attachOpen} theme={theme} onClose={() => setAttachOpen(false)} onGallery={() => chooseMedia("gallery")} onCamera={() => chooseMedia("camera")} />
    <MediaSendPreview asset={pendingMedia} recipientName={group.name} onClose={() => setPendingMedia(null)} onSend={sendSelectedMedia} />
    <ViewOnceViewer visible={Boolean(viewingOnce)} media={viewingOnce} theme={theme} onClose={() => setViewingOnce(null)} />
    <MediaPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} theme={theme} onEmoji={(emoji) => setDraft((value) => `${value}${emoji}`)} onSticker={(sticker) => send(id, { sticker })} onGif={(gif) => send(id, { gif })} />
    <MessageActionsSheet visible={Boolean(actionMessage)} message={actionMessage} theme={theme} actions={actionList} onReact={async (emoji) => { await toggleReaction(actionMessage, emoji); setActionMessage(null); }} onClose={() => setActionMessage(null)} />
    <ForwardMessageSheet visible={Boolean(forwardingMessage)} message={forwardingMessage} theme={theme} onClose={() => setForwardingMessage(null)} />
    <Modal visible={infoOpen} animationType="slide" transparent onRequestClose={() => setInfoOpen(false)}>
      <View style={styles.infoBackdrop}>
        <View style={[styles.infoSheet, { backgroundColor: theme.background }]}>
          <View style={styles.infoHeader}>
            <Text style={{ color: theme.text, fontWeight: "800", fontSize: 19 }}>Group info</Text>
            <Pressable onPress={() => setInfoOpen(false)} style={styles.back}><Icon name="close" color={theme.text} /></Pressable>
          </View>
          <View style={styles.groupProfile}>
            <Pressable disabled={!isAdmin} onPress={chooseGroupPhoto}><Avatar uri={group.avatar} name={group.name} size={62} /></Pressable>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700", marginTop: 10 }}>{group.name}</Text>
            <Text style={{ color: theme.muted, marginTop: 3 }}>{group.members?.length || 0} members ? {group.type === "channel" ? "Channel" : "Group"}</Text>
          </View>
          {isAdmin && <View style={{ gap: 8, paddingVertical: 10 }}>
            <TextInput value={editName} onChangeText={setEditName} placeholder="Group name" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} />
            <TextInput value={editDescription} onChangeText={setEditDescription} placeholder="Description" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]} />
            <Pressable onPress={saveGroupDetails} style={{ alignSelf: "flex-end", padding: 8 }}><Text style={{ color: theme.primary, fontWeight: "700" }}>Save changes</Text></Pressable>
            <Pressable onPress={async () => { try { const people = await api("/messages/contacts"); setContacts(Array.isArray(people) ? people : []); } catch (error) { Alert.alert("Couldn't load contacts", error.message); } }} style={{ padding: 8 }}><Text style={{ color: theme.primary }}>Load contacts to invite</Text></Pressable>
            {contacts.filter((person) => !(group.members || []).some((member) => String(member.userId?._id || member.userId) === String(person._id))).slice(0, 8).map((person) => <Pressable key={person._id} onPress={() => inviteContact(person._id)} style={{ paddingHorizontal: 8, paddingVertical: 5 }}><Text style={{ color: theme.text }}>Invite {person.fullName}</Text></Pressable>)}
          </View>}
          <FlatList data={group.members || []} keyExtractor={(member, index) => String(member.userId?._id || member.userId || index)} renderItem={({ item }) => <Pressable disabled={!isAdmin} onPress={() => manageMember(item)} style={styles.memberRow}><Avatar uri={item.userId?.profilePic} name={item.userId?.fullName || "Member"} size={42} online={onlineUsers.includes(String(item.userId?._id || item.userId))} showOnline={onlineUsers.includes(String(item.userId?._id || item.userId))} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: theme.text }}>{item.userId?.fullName || "Member"}</Text><Text numberOfLines={1} style={{ color: onlineUsers.includes(String(item.userId?._id || item.userId)) ? theme.success : theme.muted, fontSize: 11 }}>{presenceLabel({ online: onlineUsers.includes(String(item.userId?._id || item.userId)), lastSeenAt: item.userId?.lastSeenAt })}</Text></View><Text style={{ color: theme.muted, fontSize: 12 }}>{item.role || "member"}{isAdmin && String(item.userId?._id || item.userId) !== String(currentUserId) ? " ? Manage" : ""}</Text></Pressable>} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
            <Pressable onPress={() => Alert.alert("Leave group?", "You will need an invitation to rejoin.", [{ text: "Cancel", style: "cancel" }, { text: "Leave", style: "destructive", onPress: async () => { try { await api(`/groups/${id}/members/${currentUserId}`, { method: "DELETE" }); setInfoOpen(false); router.back(); } catch (error) { Alert.alert("Couldn't leave", error.message); } } }])}><Text style={{ color: theme.danger, padding: 10 }}>Leave group</Text></Pressable>
            {String(group.createdBy?._id || group.createdBy) === String(currentUserId) && <Pressable onPress={() => Alert.alert("Delete group?", "This removes the group and its messages.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await api(`/groups/${id}`, { method: "DELETE" }); setInfoOpen(false); router.back(); } catch (error) { Alert.alert("Couldn't delete group", error.message); } } }])}><Text style={{ color: theme.danger, padding: 10 }}>Delete group</Text></Pressable>}
          </View>
        </View>
      </View>
    </Modal>
  </KeyboardAvoidingView></AppScreen>;
}

const styles = StyleSheet.create({ header: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8 }, back: { width: 42, height: 48, justifyContent: "center", alignItems: "center" }, title: { fontSize: 16, fontWeight: "700" }, bubble: { maxWidth: "86%", minWidth: 68, padding: 9, borderRadius: 16 }, messageImage: { width: 240, maxWidth: "100%", aspectRatio: 1, borderRadius: 11 }, composer: { borderTopWidth: StyleSheet.hairlineWidth }, tool: { width: 44, height: 48, alignItems: "center", justifyContent: "center" }, input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 108, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 }, send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }, mic: { borderWidth: 0 }, viewer: { flex: 1, backgroundColor: "#000", justifyContent: "center" }, close: { position: "absolute", right: 18, top: 50, zIndex: 1, width: 48, height: 48, alignItems: "center", justifyContent: "center" }, infoBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }, infoSheet: { maxHeight: "82%", minHeight: "55%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 17, paddingBottom: 12 }, infoHeader: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, groupProfile: { alignItems: "center", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#86786A" }, memberRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.2)" } });

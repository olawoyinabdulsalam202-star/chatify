import { showDialog } from "../../lib/dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Clipboard, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, Vibration, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { format } from "date-fns";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppScreen from "../../components/AppScreen";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import LoadingView from "../../components/LoadingView";
import MessageBubble from "../../components/MessageBubble";
import { useTheme } from "../../lib/theme";
import { uploadAudio, uploadImage, uploadVideo } from "../../lib/upload";
import { useAuthStore } from "../../stores/useAuthStore";
import { useChatStore } from "../../stores/useChatStore";
import { useMessageStore } from "../../stores/useMessageStore";
import { useStickerStore } from "../../stores/useStickerStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { api } from "../../lib/api";
import { presenceLabel } from "../../lib/lastSeen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PhotoViewer from "../../components/PhotoViewer";
import VoiceRecorder from "../../components/VoiceRecorder";
import MediaPickerSheet from "../../components/MediaPickerSheet";
import MessageActionsSheet from "../../components/MessageActionsSheet";
import ForwardMessageSheet from "../../components/ForwardMessageSheet";
import SwipeReplyRow from "../../components/SwipeReplyRow";
import { hideMessageForMe, hideMessagesForMe, loadHiddenMessages } from "../../lib/messageVisibility";
import ViewOnceViewer from "../../components/ViewOnceViewer";
import ChatInputBar from "../../components/ChatInputBar";
import MediaAttachSheet from "../../components/MediaAttachSheet";
import MediaSendPreview from "../../components/MediaSendPreview";
import { useCallStore } from "../../stores/useCallStore";
import MarqueeText from "../../components/MarqueeText";
import AppSheet from "../../components/AppSheet";
import { useBlockedStore } from "../../stores/useBlockedStore";
import OfflineBar from "../../components/OfflineBar";
import { useNetworkStore } from "../../lib/networkStore";
import { showToast } from "../../lib/toast";
import { clearChatNotifications } from "../../lib/callNotifications";
import { clearActiveNotificationContext, setActiveNotificationContext } from "../../lib/notificationState";

function dayLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "MMMM d, yyyy");
}

export default function DirectChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOffline = useNetworkStore((state) => state.isOffline);
  const { id } = useLocalSearchParams();
  const partnerId = String(id || "");
  const { width } = useWindowDimensions();
  const listRef = useRef(null);
  const nearBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const typingTimer = useRef(null);
  const openedPartnerIdRef = useRef(null);
  const authUser = useAuthStore((state) => state.authUser);
  const chats = useChatStore((state) => state.chats);
  const openPartner = useMessageStore((state) => state.openPartner);
  const partner = chats.find((item) => String(item._id) === partnerId) || (String(openPartner?._id) === partnerId ? openPartner : null);
  const partnerKnown = Boolean(partner);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const messages = useMessageStore((state) => state.messages);
  const visibleCount = useMessageStore((state) => state.visibleCount);
  const isLoading = useMessageStore((state) => state.isLoading);
  const isSending = useMessageStore((state) => state.isSending);
  const isTyping = useMessageStore((state) => state.isTyping);
  const replyTarget = useMessageStore((state) => state.replyTarget);
  const error = useMessageStore((state) => state.error);
  const [draft, setDraft] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewingImage, setViewingImage] = useState(null);
  const [viewingOnce, setViewingOnce] = useState(null);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const blockedContacts = useBlockedStore((state) => state.contacts);
  const isBlocked = blockedContacts.some((contact) => String(contact._id) === String(partnerId));
  const addBlockedContact = useBlockedStore((state) => state.block);
  const unblockFromStore = useBlockedStore((state) => state.unblock);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [hiddenMessageIds, setHiddenMessageIds] = useState([]);
  const [partnerLookupDone, setPartnerLookupDone] = useState(false);
  const [, setNearBottomRender] = useState(true);
  const isNearBottom = useCallback(() => {
    nearBottomRef.current = true;
    setNearBottomRender(true);
  }, []);
  const visibleMessages = useMemo(() => messages.slice(-visibleCount), [messages, visibleCount]);
  const shownMessages = useMemo(() => visibleMessages.filter((message) => !hiddenMessageIds.includes(String(message._id))), [visibleMessages, hiddenMessageIds]);
  const displayedMessages = useMemo(() => searchOpen && searchQuery.trim() ? shownMessages.filter((message) => searchMatches.some((match) => String(match._id) === String(message._id))) : shownMessages, [shownMessages, searchOpen, searchQuery, searchMatches]);

  useEffect(() => { loadHiddenMessages(authUser?._id).then(setHiddenMessageIds); }, [authUser?._id]);
  useEffect(() => { useBlockedStore.getState().load(); }, []);
  const blocked = isBlocked;

  useEffect(() => {
    if (!partnerKnown || !partnerId || openedPartnerIdRef.current === partnerId) return;
    const currentPartner = useChatStore.getState().chats.find((item) => String(item._id) === partnerId);
    if (!currentPartner) return;
    openedPartnerIdRef.current = partnerId;
    if (String(useMessageStore.getState().openPartner?._id) !== partnerId) {
      useMessageStore.getState().openChat(currentPartner);
    } else {
      useMessageStore.getState().markSeen(partnerId);
    }
    useChatStore.getState().clearUnread(partnerId);
  }, [partnerId, partnerKnown]);

  useFocusEffect(useCallback(() => {
    setActiveNotificationContext({ kind: "dm", id: partnerId });
    clearChatNotifications(partnerId);
    const focusedPartner = useChatStore.getState().chats.find((item) => String(item._id) === partnerId);
    if (focusedPartner) {
      if (String(useMessageStore.getState().openPartner?._id) !== partnerId) {
        openedPartnerIdRef.current = partnerId;
        useMessageStore.getState().openChat(focusedPartner);
      }
      else useMessageStore.getState().markSeen(partnerId);
      useChatStore.getState().clearUnread(partnerId);
    }
    return () => {
      clearActiveNotificationContext("dm", partnerId);
      clearTimeout(typingTimer.current);
      useMessageStore.getState().emitStopTyping();
      if (String(useMessageStore.getState().openPartner?._id) === partnerId) {
        useMessageStore.getState().closeChat();
        openedPartnerIdRef.current = null;
      }
    };
  }, [partnerId]));

  useEffect(() => {
    if (partner || !partnerId) return;
    let active = true;
    api("/messages/contacts").then((contacts) => {
      const found = contacts.find((item) => String(item._id) === partnerId);
      if (active && found) useChatStore.getState().rememberPerson(found);
    }).catch(() => {}).finally(() => { if (active) setPartnerLookupDone(true); });
    return () => { active = false; };
  }, [partner, partnerId]);

  useEffect(() => {
    if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, isTyping]);

  const sendText = async () => {
    const text = draft.trim();
    if (!text || isSending || mediaBusy || blocked) return;
    if (isOffline) { showToast("No connection", "info"); return; }
    setDraft("");
    clearTimeout(typingTimer.current);
    useMessageStore.getState().emitStopTyping();
    try {
      await useMessageStore.getState().send({ text });
      isNearBottom();
    } catch {}
  };

  const chooseMedia = async (source) => {
    if (isSending || mediaBusy || blocked) return;
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { showDialog("Camera permission needed", "Allow Havn to use the camera to take a photo or video."); return; }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { showDialog("Photo permission needed", "Allow Havn to access photos before sending media."); return; }
    }
    const options = { mediaTypes: ["images", "videos"], quality: 0.88, allowsEditing: false };
    const selection = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!selection.canceled && selection.assets?.[0]) setPendingMedia(selection.assets[0]);
  };
  const sendSelectedMedia = async ({ asset, caption, viewOnce }) => {
    const isVideo = asset.type === "video" || asset.mimeType?.startsWith("video/");
    setMediaBusy(true);
    setUploadProgress(0);
    try {
      const url = isVideo ? await uploadVideo(asset, setUploadProgress) : await uploadImage(asset, setUploadProgress);
      await useMessageStore.getState().send({ [isVideo ? "video" : "image"]: url, text: caption, ...(viewOnce ? { viewOnce: true } : {}) });
      isNearBottom();
    } catch (error) { throw error; }
    finally { setMediaBusy(false); }
  };

  const sendVoice = async ({ asset, audioDuration }) => {
    setMediaBusy(true);
    setUploadProgress(0);
    try {
      const audio = await uploadAudio(asset, setUploadProgress);
      await useMessageStore.getState().send({ audio, audioDuration });
      isNearBottom();
    } finally {
      setMediaBusy(false);
    }
  };
  const beginCall = async (type) => {
    try {
      if (!await AsyncStorage.getItem("havn.batteryPromptSeen")) {
        useCallStore.getState().queueCall(partner, type);
        router.push("/battery-optimization");
        return;
      }
      await useCallStore.getState().startCall(partner, type);
    } catch (error) {
      showDialog("Call could not start", error.message || "Allow microphone and camera access, then try again.");
    }
  };

  const onDraftChange = (value) => {
    setDraft(value.slice(0, 2000));
    if (value.trim()) {
      useMessageStore.getState().emitTyping();
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => useMessageStore.getState().emitStopTyping(), 900);
    } else {
      clearTimeout(typingTimer.current);
      useMessageStore.getState().emitStopTyping();
    }
  };

  const onScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distance = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const near = distance < 110;
    nearBottomRef.current = near;
    setNearBottomRender(near);
    if (contentOffset.y < 45 && messages.length > visibleMessages.length && !loadingOlderRef.current) {
      loadingOlderRef.current = true;
      useMessageStore.getState().loadOlder();
      setTimeout(() => { loadingOlderRef.current = false; }, 250);
    }
  };

  const openMessageActions = (message) => { Vibration.vibrate(10); setActionMessage(message); };
  const actionList = actionMessage ? [
    ...(!actionMessage.isDeleted ? [{ key: "reply", label: "Reply", icon: "reply", onPress: () => useMessageStore.getState().setReplyTarget(actionMessage) }] : []),
    ...(actionMessage.text ? [{ key: "copy", label: "Copy", icon: "copy", onPress: () => Clipboard.setString(actionMessage.text) }] : []),
    ...(actionMessage.sticker && String(actionMessage.senderId) !== String(authUser?._id) ? [{ key: "save-sticker", label: "Save sticker", icon: "image", onPress: async () => { const saved = await useStickerStore.getState().saveSticker(actionMessage.sticker); if (saved) showDialog("Sticker saved", "This sticker is now in Yours."); else showDialog("Sticker not saved", useStickerStore.getState().error || "Couldn't save sticker"); } }] : []),
    ...(!actionMessage.viewOnce && !actionMessage.isDeleted ? [{ key: "forward", label: "Forward", icon: "forward", onPress: () => setForwardingMessage(actionMessage) }] : []),
    ...(String(actionMessage.senderId) === String(authUser?._id) && actionMessage.text && !actionMessage.isDeleted ? [{ key: "edit", label: "Edit", icon: "edit", onPress: () => { setEditingId(String(actionMessage._id)); setEditText(actionMessage.text); } }] : []),
    { key: "delete-me", label: "Delete for me", icon: "trash", destructive: true, onPress: async () => setHiddenMessageIds(await hideMessageForMe(authUser?._id, actionMessage._id)) },
    ...(String(actionMessage.senderId) === String(authUser?._id) && !actionMessage.isDeleted ? [{ key: "delete-everyone", label: "Delete for everyone", icon: "trash", destructive: true, onPress: () => showDialog("Delete for everyone?", "This message will be removed for everyone in this chat.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { const updated = await api(`/messages/delete/${actionMessage._id}`, { method: "DELETE" }); useMessageStore.getState().applyDeleted(updated); } catch (error) { showDialog("Message not deleted", error.message); } } }]) }] : []),
  ] : [];
  const openViewOnce = async (message) => {
    try {
      const media = await api(`/messages/view-once/${message._id}`, { method: "POST" });
      if (media.message) useMessageStore.getState().applyEdited(media.message);
      setViewingOnce(media);
    } catch (error) { showDialog("Could not open media", error.message); }
  };
  const searchInChat = async (query = searchQuery) => {
    const value = query.trim();
    if (!value) { setSearchMatches([]); setSearchIndex(0); return; }
    try {
      const matches = await api(`/messages/${partnerId}/search?q=${encodeURIComponent(value)}`);
      setSearchMatches(Array.isArray(matches) ? matches : []);
      setSearchIndex(0);
      if (matches?.length) {
        const allMessages = useMessageStore.getState().messages;
        const targetIndex = allMessages.findIndex((message) => String(message._id) === String(matches[0]._id));
        if (targetIndex >= 0) {
          useMessageStore.setState({ visibleCount: allMessages.length });
          setTimeout(() => listRef.current?.scrollToIndex({ index: matches.findIndex((item) => String(item._id) === String(matches[0]._id)), animated: true, viewPosition: 0.45 }), 120);
        }
      }
    } catch (error) { showDialog("Search failed", error.message); }
  };
  const moveSearch = (direction) => {
    if (!searchMatches.length) return;
    const next = (searchIndex + direction + searchMatches.length) % searchMatches.length;
    setSearchIndex(next);
    const allMessages = useMessageStore.getState().messages;
    const targetIndex = allMessages.findIndex((message) => String(message._id) === String(searchMatches[next]._id));
    if (targetIndex >= 0) {
      useMessageStore.setState({ visibleCount: allMessages.length });
      setTimeout(() => listRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.45 }), 120);
    }
  };
  const blockContact = async () => {
    try { await api(`/friends/block/${partnerId}`, { method: "POST" }); addBlockedContact(partner); }
    catch (error) { showDialog("Could not block contact", error.message); }
  };
  const unblockContact = async () => {
    try { if (!await unblockFromStore(partnerId)) showDialog("Could not unblock contact", useBlockedStore.getState().error); }
    catch (error) { showDialog("Could not unblock contact", error.message); }
  };
  const reportContact = () => { setOptionsOpen(false); setReportOpen(true); };
  const submitReport = async (reason) => { try { await api(`/messages/report/${partnerId}`, { method: "POST", body: { reason } }); showDialog("Report sent", "Thanks for helping keep Havn safe."); } catch (error) { showDialog("Report not sent", error.message); } };
  const clearChat = async () => {
    const current = useMessageStore.getState().messages;
    setHiddenMessageIds(await hideMessagesForMe(authUser?._id, current.map((message) => message._id)));
    useMessageStore.setState({ messages: [] });
  };
  const showChatMenu = () => setOptionsOpen(true);
  const reactToMessage = async (emoji) => {
    try { const updated = await api(`/messages/react/${actionMessage._id}`, { method: "PUT", body: { emoji } }); useMessageStore.getState().applyEdited(updated); }
    catch (requestError) { showDialog("Reaction not saved", requestError.message); }
    setActionMessage(null);
  };
  const saveEdit = async () => {
    if (!editText.trim()) return;
    try { const updated = await api(`/messages/edit/${editingId}`, { method: "PUT", body: { text: editText.trim() } }); useMessageStore.getState().applyEdited(updated); setEditingId(null); }
    catch (requestError) { showDialog("Message not edited", requestError.message); }
  };

  if (!partner && partnerLookupDone) return <AppScreen><View style={styles.errorWrap}><Text allowFontScaling style={[styles.errorText, { color: theme.muted }]}>This conversation could not be found.</Text><Pressable onPress={() => router.back()}><Text style={{ color: theme.primary, padding: 12 }}>Back to chats</Text></Pressable></View></AppScreen>;
  if (!partner) return <AppScreen><LoadingView label="Opening conversation" /></AppScreen>;
  const online = onlineUsers.includes(partnerId);
  return <AppScreen edges={["top", "left", "right"]}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
        <Avatar uri={partner.profilePic} name={partner.fullName} size={42} online={online} showOnline={online} />
        <View style={styles.headerText}><MarqueeText style={[styles.name, { color: theme.fontColor || theme.text, fontFamily: theme.fontFamily, fontSize: 16 * theme.fontScale }]}>{partner.fullName || partner.username}</MarqueeText><MarqueeText style={[styles.status, { color: online ? theme.success : theme.muted, fontFamily: theme.fontFamily, fontSize: 12 * theme.fontScale }]}>{isTyping ? "typing..." : presenceLabel({ online, lastSeenAt: partner.lastSeenAt })}</MarqueeText></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Search chat" onPress={() => { setSearchOpen((value) => !value); setSearchMatches([]); }} style={styles.back}><Icon name="search" color={theme.text} size={19} /></Pressable>
        {!blocked && String(partner._id) !== String(authUser?._id) && <><Pressable accessibilityRole="button" accessibilityLabel="Voice call" onPress={() => beginCall("audio")} style={styles.callIconButton}><Icon name="phone" color={theme.text} size={24} strokeWidth={2} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Video call" onPress={() => beginCall("video")} style={styles.callIconButton}><Icon name="video" color={theme.text} size={24} strokeWidth={2} /></Pressable></>}
        <Pressable accessibilityRole="button" accessibilityLabel="Conversation menu" onPress={showChatMenu} style={styles.back}><Icon name="more" color={theme.text} /></Pressable>
      </View>
      <OfflineBar />
      {searchOpen && <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}><TextInput value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => searchInChat()} returnKeyType="search" placeholder="Search in chat" placeholderTextColor={theme.muted} style={[styles.searchInput, { color: theme.text }]} /><Pressable onPress={() => searchInChat()}><Icon name="search" color={theme.primary} size={19} /></Pressable><Text style={{ color: theme.muted, minWidth: 36, textAlign: "center" }}>{searchMatches.length ? `${searchIndex + 1}/${searchMatches.length}` : "0/0"}</Text><Pressable accessibilityLabel="Previous match" onPress={() => moveSearch(-1)}><Icon name="back" color={theme.text} size={18} /></Pressable><Pressable accessibilityLabel="Next match" onPress={() => moveSearch(1)}><Icon name="chevron" color={theme.text} size={18} /></Pressable><Pressable onPress={() => { setSearchOpen(false); setSearchQuery(""); setSearchMatches([]); }}><Icon name="close" color={theme.muted} size={18} /></Pressable></View>}
      {isLoading && messages.length === 0 ? <LoadingView label="Loading messages" /> : error && messages.length === 0 ? <View style={styles.errorWrap}><Text allowFontScaling style={[styles.errorText, { color: theme.danger }]}>{error}</Text><Pressable onPress={() => useMessageStore.getState().loadMessages(partnerId)}><Text style={{ color: theme.primary, padding: 12 }}>Try again</Text></Pressable></View> : <FlatList
        ref={listRef}
        data={displayedMessages}
        ListHeaderComponent={partner.awayMessage || partner.settings?.awayMessage ? <Text style={[styles.awayNote, { color: theme.muted, backgroundColor: theme.surface }]}>{partner.awayMessage || partner.settings.awayMessage}</Text> : null}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item }) => { const own = String(item.senderId) === String(authUser?._id); return <SwipeReplyRow own={own} theme={theme} onReply={() => useMessageStore.getState().setReplyTarget(item)}><MessageBubble message={item} own={own} searchQuery={searchQuery} onViewOnce={openViewOnce} highlighted={String(actionMessage?._id) === String(item._id) || String(searchMatches[searchIndex]?._id) === String(item._id)} editing={editingId === String(item._id)} editText={editText} onEditChange={setEditText} onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)} partnerName={partner.fullName} onLongPress={openMessageActions} onImagePress={setViewingImage} /></SwipeReplyRow>; }}
        contentContainerStyle={[styles.messages, { paddingHorizontal: Math.max(5, Math.min(16, width * 0.03)) }]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={100}
        onContentSizeChange={() => { if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false }); }}
        ListEmptyComponent={<View style={styles.empty}><Text allowFontScaling style={[styles.emptyTitle, { color: theme.text }]}>Say hello</Text><Text allowFontScaling style={[styles.emptyCopy, { color: theme.muted }]}>Messages are private between you and {partner.fullName || "this person"}.</Text></View>}
        ListFooterComponent={isTyping ? <View style={[styles.typing, { backgroundColor: theme.incoming }]}><Text style={{ color: theme.muted }}>Typing...</Text></View> : null}
      />}
      {blocked && <View style={[styles.blockBanner, { backgroundColor: theme.surface }]}><Text style={{ color: theme.text, flex: 1 }}>You blocked this contact</Text><Pressable onPress={unblockContact}><Text style={{ color: theme.primary, fontWeight: "700" }}>Unblock</Text></Pressable></View>}
      {!!error && messages.length > 0 && <Text allowFontScaling style={[styles.sendError, { color: theme.danger }]}>{error}</Text>}
      {replyTarget && <View style={[styles.replyPreview, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={[styles.replyLine, { backgroundColor: theme.primary }]} /><View style={styles.replyCopy}><Text style={{ color: theme.primary, fontSize: 12, fontWeight: "700" }}>Replying to message</Text><Text numberOfLines={1} style={{ color: theme.text, fontSize: 13 }}>{replyTarget.text || (replyTarget.image ? "Photo" : "Message")}</Text></View><Pressable accessibilityLabel="Cancel reply" onPress={() => useMessageStore.getState().setReplyTarget(null)} style={styles.closeReply}><Icon name="close" color={theme.muted} size={19} /></Pressable></View>}
      <View style={[styles.composer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <ChatInputBar theme={theme} value={draft} onChangeText={onDraftChange} onEmoji={() => setPickerOpen(true)} onAttach={() => setAttachOpen(true)} onCamera={() => chooseMedia("camera")} onSend={sendText} onRecord={() => setRecordingVoice(true)} onOffline={() => showToast("No connection", "info")} offline={isOffline} sending={isSending || mediaBusy} disabled={blocked} recordingVoice={recordingVoice} voiceRecorder={<VoiceRecorder theme={theme} onSend={sendVoice} onCancel={() => setRecordingVoice(false)} />} />
      </View>
      {mediaBusy && <View style={{ height: 3, backgroundColor: theme.border }}><View style={{ height: 3, width: Math.max(4, Math.round(uploadProgress * 100)) + "%", backgroundColor: theme.primary }} /></View>}
    </KeyboardAvoidingView>
    <AppSheet visible={optionsOpen} title={partner.fullName || partner.username || "Conversation options"} onClose={() => setOptionsOpen(false)} rows={[{ label: blocked ? "Unblock" : "Block", icon: blocked ? "check" : "ban", destructive: !blocked, onPress: () => { setOptionsOpen(false); if (blocked) unblockContact(); else showDialog("Block contact?", "They will no longer be able to message you.", [{ text: "Cancel", style: "cancel" }, { text: "Block", style: "destructive", onPress: blockContact }]); } }, { label: "Report", icon: "flag", onPress: reportContact }, { label: "Clear chat", icon: "clear", destructive: true, onPress: () => { setOptionsOpen(false); showDialog("Clear chat?", "This removes the messages from your chat view.", [{ text: "Cancel", style: "cancel" }, { text: "Clear chat", style: "destructive", onPress: clearChat }]); } }]} />
    <AppSheet visible={reportOpen} title="Report contact" onBack={() => { setReportOpen(false); setOptionsOpen(true); }} onClose={() => setReportOpen(false)} rows={["Spam", "Harassment", "Inappropriate content"].map((reason) => ({ label: reason, icon: "flag", onPress: () => { setReportOpen(false); submitReport(reason); } }))} />


    <PhotoViewer uri={viewingImage} onClose={() => setViewingImage(null)} />
    <ViewOnceViewer visible={Boolean(viewingOnce)} media={viewingOnce} theme={theme} onClose={() => setViewingOnce(null)} />
    <MediaAttachSheet visible={attachOpen} theme={theme} onClose={() => setAttachOpen(false)} onGallery={() => chooseMedia("gallery")} onCamera={() => chooseMedia("camera")} />
    <MediaSendPreview asset={pendingMedia} recipientName={partner.fullName || partner.username || "Contact"} onClose={() => setPendingMedia(null)} onSend={sendSelectedMedia} />
    <MediaPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} theme={theme} onEmoji={(emoji) => setDraft((value) => `${value}${emoji}`)} onSticker={(sticker) => useMessageStore.getState().send({ sticker })} onGif={(gif) => useMessageStore.getState().send({ gif })} />
    <MessageActionsSheet visible={Boolean(actionMessage)} message={actionMessage} theme={theme} actions={actionList} onReact={reactToMessage} onClose={() => setActionMessage(null)} />
    <ForwardMessageSheet visible={Boolean(forwardingMessage)} message={forwardingMessage} theme={theme} onClose={() => setForwardingMessage(null)} />
  </AppScreen>;
}

const styles = StyleSheet.create({ flex: { flex: 1, minHeight: 0 }, header: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingHorizontal: 10, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth }, back: { width: 38, height: 44, alignItems: "center", justifyContent: "center" }, headerText: { flex: 1, minWidth: 0 }, name: { fontSize: 16, fontWeight: "700" }, status: { fontSize: 12, marginTop: 2 }, messages: { flexGrow: 1, paddingTop: 12, paddingBottom: 10 }, searchBar: { minHeight: 46, borderWidth: 1, borderRadius: 12, marginHorizontal: 8, marginTop: 6, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 8 }, searchInput: { flex: 1, minWidth: 0, height: 42 }, awayNote: { marginHorizontal: 12, marginTop: 6, padding: 10, textAlign: "center", borderRadius: 10, fontSize: 12 }, blockBanner: { marginHorizontal: 8, padding: 10, flexDirection: "row", alignItems: "center", borderRadius: 10, gap: 12 }, empty: { flex: 1, minHeight: 340, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 }, emptyTitle: { fontSize: 21, fontWeight: "700" }, emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 7 }, typing: { alignSelf: "flex-start", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, marginHorizontal: 8, marginVertical: 5 }, errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, errorText: { fontSize: 14, textAlign: "center" }, sendError: { paddingHorizontal: 14, fontSize: 12 }, replyPreview: { minHeight: 58, borderTopWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10 }, replyLine: { width: 3, height: 36, borderRadius: 2 }, replyCopy: { flex: 1, minWidth: 0, gap: 3 }, closeReply: { width: 40, height: 42, alignItems: "center", justifyContent: "center" }, composer: { borderTopWidth: StyleSheet.hairlineWidth }, callIconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, attach: { width: 44, height: 48, alignItems: "center", justifyContent: "center" }, input: { flex: 1, minWidth: 0, maxHeight: 110, minHeight: 48, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 10, fontSize: 16 }, send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 0 }, mic: { borderWidth: 0 }, sendBusy: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" }, callBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" }, callSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 20, paddingBottom: 28 }, sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 }, callClose: { minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" } });

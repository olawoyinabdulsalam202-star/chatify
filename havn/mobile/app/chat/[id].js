import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { format } from "date-fns";
import AppScreen from "../../components/AppScreen";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import LoadingView from "../../components/LoadingView";
import MessageBubble from "../../components/MessageBubble";
import { useTheme } from "../../lib/theme";
import { uploadImage } from "../../lib/upload";
import { useAuthStore } from "../../stores/useAuthStore";
import { useChatStore } from "../../stores/useChatStore";
import { useMessageStore } from "../../stores/useMessageStore";
import { usePresenceStore } from "../../stores/usePresenceStore";
import { api } from "../../lib/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PhotoViewer from "../../components/PhotoViewer";

function dayLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "MMMM d, yyyy");
}

export default function DirectChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  const partner = chats.find((item) => String(item._id) === partnerId);
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [viewingImage, setViewingImage] = useState(null);
  const [partnerLookupDone, setPartnerLookupDone] = useState(false);
  const [, setNearBottomRender] = useState(true);
  const isNearBottom = useCallback(() => {
    nearBottomRef.current = true;
    setNearBottomRender(true);
  }, []);
  const visibleMessages = useMemo(() => messages.slice(-visibleCount), [messages, visibleCount]);

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
    if (!text || isSending || mediaBusy) return;
    setDraft("");
    clearTimeout(typingTimer.current);
    useMessageStore.getState().emitStopTyping();
    try {
      await useMessageStore.getState().send({ text });
      isNearBottom();
    } catch {}
  };

  const pickImage = async () => {
    if (isSending || mediaBusy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo permission needed", "Allow Havn to access photos before sending an image.");
      return;
    }
    const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.88, allowsEditing: false });
    if (selection.canceled || !selection.assets?.[0]) return;
    setMediaBusy(true);
    try {
      setUploadProgress(0);
      const image = await uploadImage(selection.assets[0], setUploadProgress);
      await useMessageStore.getState().send({ image });
      isNearBottom();
    } catch (uploadError) {
      Alert.alert("Image not sent", uploadError.message);
    } finally {
      setMediaBusy(false);
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

  if (!partner && partnerLookupDone) return <AppScreen><View style={styles.errorWrap}><Text allowFontScaling style={[styles.errorText, { color: theme.muted }]}>This conversation could not be found.</Text><Pressable onPress={() => router.back()}><Text style={{ color: theme.primary, padding: 12 }}>Back to chats</Text></Pressable></View></AppScreen>;
  if (!partner) return <AppScreen><LoadingView label="Opening conversation" /></AppScreen>;
  const online = onlineUsers.includes(partnerId);
  return <AppScreen edges={["top", "left", "right"]}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
        <Avatar uri={partner.profilePic} name={partner.fullName} size={42} online={online} showOnline={online} />
        <View style={styles.headerText}><Text allowFontScaling numberOfLines={1} style={[styles.name, { color: theme.fontColor || theme.text, fontFamily: theme.fontFamily, fontSize: 16 * theme.fontScale }]}>{partner.fullName || partner.username}</Text><Text allowFontScaling numberOfLines={1} style={[styles.status, { color: online ? theme.success : theme.muted, fontFamily: theme.fontFamily, fontSize: 12 * theme.fontScale }]}>{isTyping ? "typing..." : online ? "Online" : partner.lastSeenAt ? `Last seen ${format(new Date(partner.lastSeenAt), "MMM d, p")}` : "Offline"}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Conversation menu" onPress={() => Alert.alert(partner.fullName || partner.username, "Conversation options", [{ text: "Cancel", style: "cancel" }, { text: "Contact info", onPress: () => Alert.alert(partner.fullName || partner.username, `@${partner.username || ""}`) }])} style={styles.back}><Icon name="more" color={theme.text} /></Pressable>
      </View>
      {isLoading && messages.length === 0 ? <LoadingView label="Loading messages" /> : error && messages.length === 0 ? <View style={styles.errorWrap}><Text allowFontScaling style={[styles.errorText, { color: theme.danger }]}>{error}</Text><Pressable onPress={() => useMessageStore.getState().loadMessages(partnerId)}><Text style={{ color: theme.primary, padding: 12 }}>Try again</Text></Pressable></View> : <FlatList
        ref={listRef}
        data={visibleMessages}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item }) => <MessageBubble message={item} own={String(item.senderId) === String(authUser?._id)} partnerName={partner.fullName} onReply={(message) => useMessageStore.getState().setReplyTarget(message)} onImagePress={setViewingImage} />}
        contentContainerStyle={[styles.messages, { paddingHorizontal: Math.max(5, Math.min(16, width * 0.03)) }]}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={100}
        onContentSizeChange={() => { if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false }); }}
        ListEmptyComponent={<View style={styles.empty}><Text allowFontScaling style={[styles.emptyTitle, { color: theme.text }]}>Say hello</Text><Text allowFontScaling style={[styles.emptyCopy, { color: theme.muted }]}>Messages are private between you and {partner.fullName || "this person"}.</Text></View>}
        ListFooterComponent={isTyping ? <View style={[styles.typing, { backgroundColor: theme.incoming }]}><Text style={{ color: theme.muted }}>Typing...</Text></View> : null}
      />}
      {!!error && messages.length > 0 && <Text allowFontScaling style={[styles.sendError, { color: theme.danger }]}>{error}</Text>}
      {replyTarget && <View style={[styles.replyPreview, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={[styles.replyLine, { backgroundColor: theme.primary }]} /><View style={styles.replyCopy}><Text style={{ color: theme.primary, fontSize: 12, fontWeight: "700" }}>Replying to message</Text><Text numberOfLines={1} style={{ color: theme.text, fontSize: 13 }}>{replyTarget.text || (replyTarget.image ? "Photo" : "Message")}</Text></View><Pressable accessibilityLabel="Cancel reply" onPress={() => useMessageStore.getState().setReplyTarget(null)} style={styles.closeReply}><Icon name="close" color={theme.muted} size={19} /></Pressable></View>}
      <View style={[styles.composer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Attach image" disabled={isSending || mediaBusy} onPress={pickImage} style={styles.attach}>{mediaBusy ? <ActivityIndicator color={theme.primary} /> : <Icon name="image" color={theme.primary} />}</Pressable>
        <TextInput allowFontScaling value={draft} onChangeText={onDraftChange} maxLength={2000} multiline placeholder="Message" placeholderTextColor={theme.muted} style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, fontFamily: theme.fontFamily, fontSize: 16 * theme.fontScale }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!draft.trim() || isSending || mediaBusy} onPress={sendText} style={[styles.send, { backgroundColor: theme.primary, opacity: !draft.trim() || isSending || mediaBusy ? 0.55 : 1 }]}>{isSending || mediaBusy ? <Text style={styles.sendBusy}>...</Text> : <Icon name="send" color="#FFFFFF" size={19} />}</Pressable>
      </View>
      {mediaBusy && <View style={{ height: 3, backgroundColor: theme.border }}><View style={{ height: 3, width: Math.max(4, Math.round(uploadProgress * 100)) + "%", backgroundColor: theme.primary }} /></View>}
    </KeyboardAvoidingView>
    <PhotoViewer uri={viewingImage} onClose={() => setViewingImage(null)} />
  </AppScreen>;
}

const styles = StyleSheet.create({ flex: { flex: 1, minHeight: 0 }, header: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingHorizontal: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth }, back: { width: 40, height: 44, alignItems: "center", justifyContent: "center" }, headerText: { flex: 1, minWidth: 0 }, name: { fontSize: 16, fontWeight: "700" }, status: { fontSize: 12, marginTop: 2 }, messages: { flexGrow: 1, paddingTop: 12, paddingBottom: 10 }, empty: { flex: 1, minHeight: 340, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 }, emptyTitle: { fontSize: 21, fontWeight: "700" }, emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 7 }, typing: { alignSelf: "flex-start", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, marginHorizontal: 8, marginVertical: 5 }, errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, errorText: { fontSize: 14, textAlign: "center" }, sendError: { paddingHorizontal: 14, fontSize: 12 }, replyPreview: { minHeight: 58, borderTopWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10 }, replyLine: { width: 3, height: 36, borderRadius: 2 }, replyCopy: { flex: 1, minWidth: 0, gap: 3 }, closeReply: { width: 40, height: 42, alignItems: "center", justifyContent: "center" }, composer: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 9, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 7 }, attach: { width: 44, height: 48, alignItems: "center", justifyContent: "center" }, input: { flex: 1, minWidth: 0, maxHeight: 110, minHeight: 48, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 10, fontSize: 16 }, send: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 0 }, sendBusy: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" } });

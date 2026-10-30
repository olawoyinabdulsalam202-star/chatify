import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import { uploadImage } from "../lib/upload";
import { useTheme } from "../lib/theme";
import { useStoryStore } from "../stores/useStoryStore";
import { useAuthStore } from "../stores/useAuthStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STORY_COLORS = ["#C2410C", "#B45309", "#166534", "#155E75", "#7C2D4A", "#292524"];

export default function StatusScreen({ embedded = false }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const router = useRouter();
  const user = useAuthStore((state) => state.authUser);
  const feed = useStoryStore((state) => state.feed);
  const mine = useStoryStore((state) => state.mine);
  const loading = useStoryStore((state) => state.loading);
  const error = useStoryStore((state) => state.error);
  const load = useStoryStore((state) => state.load);
  const [viewer, setViewer] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [text, setText] = useState("");
  const [color, setColor] = useState(STORY_COLORS[0]);
  const [posting, setPosting] = useState(false);
  const [viewers, setViewers] = useState(null);
  const [reply, setReply] = useState("");
  const [liked, setLiked] = useState(false);
  const [paused, setPaused] = useState(false);
  const progress = useRef(0);
  const started = useRef(Date.now());
  const [barProgress, setBarProgress] = useState(0);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setPaused(state !== "active"));
    return () => subscription.remove();
  }, []);
  const groups = [{ user: user || {}, stories: mine, mine: true }, ...feed.map((group) => ({ ...group, mine: false }))].filter((group) => group.user && group.stories?.length);
  const story = viewer ? groups[viewer.group]?.stories?.[viewer.index] : null;
  const author = viewer ? groups[viewer.group]?.user : null;
  const uniqueViews = new Set((story?.viewers || []).map((item) => String(item.userId?._id || item.userId)).filter(Boolean)).size;
  const uniqueLikes = new Set((story?.likes || []).map((item) => String(item.userId?._id || item.userId)).filter(Boolean)).size;
  useEffect(() => {
    if (!story) return;
    progress.current = 0; started.current = Date.now(); setBarProgress(0); setPaused(false); setViewers(null); setReply("");
    const ids = (story.likes || []).map((item) => String(item.userId?._id || item.userId));
    setLiked(ids.includes(String(user?._id)));
    if (!groups[viewer.group]?.mine) useStoryStore.getState().viewed(story._id).catch(() => {});
  }, [story?._id]);
  useEffect(() => {
    if (!story || paused || viewers) return undefined;
    const timer = setInterval(() => {
      progress.current += Date.now() - started.current;
      started.current = Date.now();
      const amount = Math.min(1, progress.current / 5000);
      setBarProgress(amount);
      if (amount >= 1) advance(1);
    }, 80);
    return () => clearInterval(timer);
  }, [story?._id, paused, viewers]);
  const advance = (direction) => setViewer((current) => {
    if (!current) return null;
    const group = groups[current.group];
    const next = current.index + direction;
    if (next >= 0 && next < group.stories.length) return { ...current, index: next };
    const groupIndex = current.group + direction;
    if (groupIndex < 0 || groupIndex >= groups.length) return null;
    return { group: groupIndex, index: direction > 0 ? 0 : groups[groupIndex].stories.length - 1 };
  });
  const createStory = async (media) => {
    if (!media && !text.trim()) return;
    setPosting(true);
    try {
      const payload = media ? { image: await uploadImage(media), text: text.trim() } : { text: text.trim(), backgroundColor: color };
      await useStoryStore.getState().create(payload); setCreateOpen(false); setText("");
    } catch (err) { Alert.alert("Status not posted", err.message); }
    finally { setPosting(false); }
  };
  const pickImage = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!picked.canceled && picked.assets?.[0]) createStory(picked.assets[0]);
  };
  const toggleLike = async () => {
    const previous = liked; setLiked(!previous);
    try { const result = await useStoryStore.getState().like(story._id); setLiked(result.liked); }
    catch (err) { setLiked(previous); Alert.alert("Like not sent", err.message); }
  };
  const sendReply = async () => {
    const messageText = reply.trim(); if (!messageText || !author?._id) return;
    try {
      const thumbnail = story.image || (story.video ? story.video.replace("/upload/", "/upload/so_0,f_jpg/ ").replace(" ", "") : null);
      await api(`/messages/send/${author._id}`, { method: "POST", body: { text: messageText, storyReply: { storyId: story._id, thumbnail, text: (story.text || "Status").slice(0, 120) } } });
      setReply(""); Alert.alert("Status reply", "Sent"); advance(1);
    } catch (err) { Alert.alert("Reply not sent", err.message); }
  };
  const openViewers = async () => { try { setViewers(await useStoryStore.getState().viewers(story._id)); } catch (err) { Alert.alert("Viewers", err.message); } };

  return <AppScreen edges={embedded ? [] : undefined}>
    <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Status</Text><Pressable onPress={load} style={styles.headerButton}><Icon name="camera" color={theme.primary} /></Pressable></View>
    {loading && !groups.length ? <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} /> : <ScrollView contentContainerStyle={styles.tray} horizontal showsHorizontalScrollIndicator={false}>
      <Pressable onPress={() => mine.length ? setViewer({ group: 0, index: 0 }) : setCreateOpen(true)} style={styles.storyItem}><View style={[styles.ring, { borderColor: mine.length ? theme.primary : theme.border }]}><Avatar uri={user?.profilePic} name={user?.fullName} size={54} /></View><Pressable accessibilityRole="button" accessibilityLabel="Create status" onPress={(event) => { event.stopPropagation(); setCreateOpen(true); }} style={[styles.plus, { backgroundColor: theme.primary, borderColor: theme.background }]}><Icon name="plus" color="#FFFFFF" size={13} /></Pressable><Text numberOfLines={1} style={[styles.storyName, { color: theme.muted }]}>Your status</Text></Pressable>
      {feed.map((group, index) => { const seen = group.stories.every((item) => item.viewers?.some((entry) => String(entry.userId?._id || entry.userId) === String(user?._id))); return <Pressable key={group.user._id} onPress={() => setViewer({ group: index + 1, index: 0 })} style={styles.storyItem}><View style={[styles.ring, { borderColor: seen ? theme.border : theme.primary }]}><Avatar uri={group.user.profilePic} name={group.user.fullName} size={54} /></View><Text numberOfLines={1} style={[styles.storyName, { color: theme.muted }]}>{group.user.fullName?.split(" ")[0] || "Contact"}</Text></Pressable>; })}
    </ScrollView>}
    {!!error && <Pressable onPress={load}><Text style={{ color: theme.danger, padding: 16 }}>{error} · Tap to retry</Text></Pressable>}
    {!groups.length && !loading && <View style={styles.empty}><Text style={[styles.emptyTitle, { color: theme.text }]}>Share a status</Text><Text style={{ color: theme.muted, textAlign: "center", marginTop: 5 }}>Post a photo or a short note for your contacts.</Text><Pressable onPress={() => setCreateOpen(true)} style={[styles.postButton, { backgroundColor: theme.primary }]}><Text style={{ color: "#FFF", fontWeight: "700" }}>Create status</Text></Pressable></View>}
    <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}><View style={[styles.modal, { backgroundColor: theme.background }]}><View style={styles.modalHeader}><Pressable onPress={() => setCreateOpen(false)} style={styles.headerButton}><Icon name="close" color={theme.text} /></Pressable><Text style={[styles.modalTitle, { color: theme.text }]}>Create status</Text><Pressable onPress={pickImage} style={styles.headerButton}><Icon name="image" color={theme.primary} /></Pressable></View><View style={[styles.textStory, { backgroundColor: color }]}><TextInput value={text} onChangeText={(value) => setText(value.slice(0, 300))} multiline maxLength={300} placeholder="Type a status" placeholderTextColor="rgba(255,255,255,0.65)" style={styles.storyInput} /></View><View style={styles.colors}>{STORY_COLORS.map((item) => <Pressable key={item} onPress={() => setColor(item)} style={[styles.colorDot, { backgroundColor: item, borderColor: color === item ? theme.text : "transparent" }]} />)}</View><Pressable disabled={posting || !text.trim()} onPress={() => createStory(null)} style={[styles.postButton, { backgroundColor: theme.primary, opacity: !text.trim() ? 0.5 : 1 }]}><Text style={{ color: "#FFF", fontWeight: "700" }}>{posting ? "Posting" : "Post status"}</Text></Pressable></View></Modal>
    <Modal visible={!!viewer && !!story} animationType="fade" onRequestClose={() => setViewer(null)}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}><View style={[styles.viewer, { backgroundColor: story?.backgroundColor || "#111", paddingTop: Math.max(46, insets.top + 12), paddingBottom: Math.max(12, insets.bottom) }]} onTouchStart={(event) => { const x = event.nativeEvent.pageX; const y = event.nativeEvent.pageY; if (y < 120 || y > screenHeight - 90) return; const timer = setTimeout(() => setPaused(true), 220); globalThis.__havnStoryTouch = { x, y, timer, time: Date.now() }; }} onTouchEnd={() => { const touch = globalThis.__havnStoryTouch; if (!touch) return; clearTimeout(touch.timer); const held = Date.now() - touch.time > 220; if (held) setPaused(false); else advance(touch.x < screenWidth / 2 ? -1 : 1); globalThis.__havnStoryTouch = null; }}>
      <View style={styles.progressRow}>{groups[viewer?.group]?.stories.map((item, index) => <View key={item._id} style={styles.progressTrack}><View style={[styles.progressFill, { width: index < viewer.index ? "100%" : index === viewer.index ? `${barProgress * 100}%` : "0%" }]} /></View>)}</View>
      <View style={styles.viewerHeader}><Avatar uri={author?.profilePic} name={author?.fullName} size={38} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: "#FFF", fontWeight: "700" }}>{groups[viewer?.group]?.mine ? "Your status" : author?.fullName}</Text><Text style={{ color: "#EEE", fontSize: 11 }}>{story?.createdAt ? new Date(story.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</Text></View><Pressable onPress={() => setPaused((value) => !value)} style={styles.viewerControl}><Text style={{ color: "#FFF", fontWeight: "700" }}>{paused ? "Play" : "Pause"}</Text></Pressable><Pressable onPress={() => setViewer(null)} style={styles.viewerControl}><Icon name="close" color="#FFF" /></Pressable></View>
      {story?.image ? <Image source={{ uri: story.image }} contentFit="contain" style={styles.storyMedia} /> : story?.video ? <Image source={{ uri: story.video.replace("/upload/", "/upload/so_0,f_jpg/") }} contentFit="contain" style={styles.storyMedia} /> : <Text style={styles.statusText}>{story?.text}</Text>}
      {!!story?.text && story?.image && <Text numberOfLines={3} style={styles.caption}>{story.text}</Text>}
      {groups[viewer?.group]?.mine ? <View style={styles.ownerBar}><Pressable onPress={openViewers} style={styles.viewerControl}><Icon name="eye" color="#FFF" /><Text style={{ color: "#FFF", marginLeft: 7 }}>{uniqueViews} views</Text></Pressable><Pressable onPress={() => Alert.alert("Likes", `${uniqueLikes} likes`)} style={styles.viewerControl}><Icon name="heart" color="#FFF" /><Text style={{ color: "#FFF", marginLeft: 7 }}>{uniqueLikes}</Text></Pressable></View> : <View style={styles.replyBar}><Pressable onPress={toggleLike} style={styles.viewerControl}><Icon name="heart" color={liked ? "#FF5A64" : "#FFF"} /></Pressable><TextInput value={reply} onChangeText={setReply} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} placeholder="Reply..." placeholderTextColor="#DDD" style={styles.replyInput} /><Pressable onPress={sendReply} style={styles.viewerControl}><Icon name="send" color="#FFF" /></Pressable></View>}
      <Modal visible={!!viewers} transparent animationType="slide" onRequestClose={() => setViewers(null)}><View style={styles.sheet}><View style={styles.sheetHead}><Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>{viewers?.viewCount || 0} views · {viewers?.likeCount || 0} likes</Text><Pressable onPress={() => setViewers(null)}><Icon name="close" color={theme.text} /></Pressable></View><FlatList data={viewers?.viewers || []} keyExtractor={(item, index) => String(item.userId?._id || item.userId || index)} renderItem={({ item }) => <View style={styles.viewerPerson}><Avatar uri={item.userId?.profilePic} name={item.userId?.fullName} size={40} /><Text style={{ flex: 1, color: theme.text }}>{item.userId?.fullName || "Contact"}</Text>{item.liked && <Icon name="heart" color={theme.primary} size={16} />}<Text style={{ color: theme.muted, fontSize: 11 }}>{new Date(item.viewedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></View>} /></View></Modal>
    </View></KeyboardAvoidingView></Modal>
  </AppScreen>;
}

const styles = StyleSheet.create({ header: { minHeight: 68, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontSize: 26, fontWeight: "800" }, headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, tray: { paddingHorizontal: 14, paddingVertical: 12, alignItems: "flex-start", gap: 14 }, storyItem: { width: 70, alignItems: "center", gap: 5 }, ring: { width: 64, height: 64, borderWidth: 2.5, borderRadius: 36, alignItems: "center", justifyContent: "center" }, plus: { position: "absolute", right: 1, top: 44, height: 21, width: 21, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" }, storyName: { fontSize: 11, maxWidth: 68 }, empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }, emptyTitle: { fontSize: 21, fontWeight: "700" }, postButton: { minHeight: 46, marginTop: 18, borderRadius: 14, paddingHorizontal: 22, alignItems: "center", justifyContent: "center" }, modal: { flex: 1, padding: 18, paddingTop: 30 }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalTitle: { fontSize: 19, fontWeight: "700" }, textStory: { aspectRatio: 9 / 12, maxHeight: "65%", borderRadius: 20, marginTop: 18, justifyContent: "center", padding: 22 }, storyInput: { color: "#FFF", fontSize: 23, textAlign: "center", fontWeight: "600" }, colors: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 17 }, colorDot: { width: 34, height: 34, borderRadius: 18, borderWidth: 2 }, viewer: { flex: 1, paddingTop: 46, paddingBottom: 12 }, progressRow: { flexDirection: "row", gap: 4, marginHorizontal: 10 }, progressTrack: { height: 3, flex: 1, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.42)", overflow: "hidden" }, progressFill: { height: "100%", backgroundColor: "#FFF" }, viewerHeader: { flexDirection: "row", alignItems: "center", gap: 9, padding: 12 }, viewerControl: { minWidth: 42, minHeight: 42, borderRadius: 23, backgroundColor: "rgba(0,0,0,0.48)", alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 10 }, storyMedia: { flex: 1, width: "100%" }, statusText: { flex: 1, color: "#FFF", fontSize: 28, lineHeight: 37, textAlign: "center", textAlignVertical: "center", padding: 25 }, caption: { color: "#FFF", paddingHorizontal: 18, paddingVertical: 10, textAlign: "center" }, replyBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 8 }, replyInput: { flex: 1, minHeight: 44, color: "#FFF", borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", paddingHorizontal: 15 }, ownerBar: { flexDirection: "row", justifyContent: "center", gap: 14 }, sheet: { marginTop: "auto", maxHeight: "70%", backgroundColor: "#FAF7F2", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 }, sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 46 }, viewerPerson: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10 } });

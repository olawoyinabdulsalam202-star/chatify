import { showDialog } from "../lib/dialog";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStickerStore } from "../stores/useStickerStore";
import Icon from "./Icon";

const MAX_STICKER_BYTES = 5 * 1024 * 1024;

const GROUPS = {
  Smileys: ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜", "🤔", "😎", "🥳", "😢", "😭", "😡", "🥺", "😴"],
  Gestures: ["👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "✌️", "🤞", "👌", "👋", "🫶"],
  Hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💔", "💯"],
  Objects: ["🔥", "🎉", "🎂", "🎁", "⭐", "✅", "❌", "⚡", "☕", "📌", "🔔", "🎶"],
};
const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
if (!GIPHY_API_KEY && __DEV__) console.warn("GIPHY is not configured. Add EXPO_PUBLIC_GIPHY_API_KEY to mobile/.env to enable GIF search.");
const KEY = Object.fromEntries(Object.entries(GROUPS).flatMap(([group, values]) => values.map((emoji) => [emoji, group.toLowerCase()])));

export default function MediaPickerSheet({ visible, onClose, onEmoji, onSticker, onGif, theme }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState("Emoji");
  const [stickerTab, setStickerTab] = useState("Recent");
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emojiRecents, setEmojiRecents] = useState([]);
  const [createAsset, setCreateAsset] = useState(null);
  const [createError, setCreateError] = useState("");
  const stickers = useStickerStore((state) => state.stickers);
  const recents = useStickerStore((state) => state.recents);
  const hasFetchedStickers = useStickerStore((state) => state.hasFetched);
  const stickersLoading = useStickerStore((state) => state.isLoading);
  const creatingSticker = useStickerStore((state) => state.isCreating);
  const stickerError = useStickerStore((state) => state.error);
  const fetchStickers = useStickerStore((state) => state.fetchStickers);
  const loadStickerRecents = useStickerStore((state) => state.loadRecents);
  const createSticker = useStickerStore((state) => state.createSticker);
  const deleteSticker = useStickerStore((state) => state.deleteSticker);
  const pushRecent = useStickerStore((state) => state.pushRecent);

  useEffect(() => {
    if (!visible) return;
    loadStickerRecents();
    if (!hasFetchedStickers) fetchStickers();
  }, [visible, hasFetchedStickers, fetchStickers, loadStickerRecents]);
  useEffect(() => {
    if (recents.length === 0 && stickers.length > 0) setStickerTab("Yours");
  }, [recents.length, stickers.length]);
  useEffect(() => {
    if (!visible || tab !== "GIFs") return;
    const key = GIPHY_API_KEY;
    if (!key) { setGifs([]); return; }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const mode = query.trim() ? "search" : "trending";
        const params = new URLSearchParams({ api_key: key, limit: "18", rating: "pg-13" });
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`https://api.giphy.com/v1/gifs/${mode}?${params}`);
        if (!response.ok) throw new Error("GIF service unavailable");
        const data = await response.json();
        if (active) setGifs((data.data || []).map((item) => ({ id: item.id, preview: item.images.fixed_height_small.url, url: item.images.fixed_height.url })));
      } catch { if (active) setGifs([]); }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [visible, tab, query]);
  const pickEmoji = (emoji) => { setEmojiRecents((list) => [emoji, ...list.filter((item) => item !== emoji)].slice(0, 24)); onEmoji(emoji); onClose(); };
  const pickSticker = (url) => { onSticker(url); pushRecent(url); onClose(); };
  const chooseStickerImage = async () => {
    setCreateError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], base64: true, quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.mimeType && !asset.mimeType.startsWith("image/")) { setCreateError("Please pick an image"); return; }
      const imageSize = Number(asset.fileSize || Math.floor((asset.base64?.length || 0) * 0.75));
      if (imageSize > MAX_STICKER_BYTES) { setCreateError("Stickers must be under 5MB"); return; }
      if (!asset.base64) { setCreateError("Couldn't read that image"); return; }
      setCreateAsset(asset);
    } catch { setCreateError("Couldn't read that image"); }
  };
  const handleCreateSticker = async () => {
    if (!createAsset?.base64 || creatingSticker) return;
    const image = `data:${createAsset.mimeType || "image/jpeg"};base64,${createAsset.base64}`;
    const created = await createSticker(image);
    if (!created) return;
    setCreateAsset(null);
    setCreateError("");
    setStickerTab("Yours");
  };
  const confirmDeleteSticker = (sticker) => showDialog("Remove sticker?", "This sticker will be removed from Yours.", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove", style: "destructive", onPress: () => deleteSticker(sticker._id) },
  ]);
  const colors = { backgroundColor: theme.background, color: theme.text, borderColor: theme.border };
  const all = Object.values(GROUPS).flat();
  const filtered = query.trim() ? all.filter((item) => KEY[item].includes(query.trim().toLowerCase())) : all;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.avoid} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <Pressable style={styles.backdrop} onPress={onClose}><View onStartShouldSetResponder={() => true} style={[styles.sheet, { height: Math.min(height * 0.72, 600), maxHeight: height * 0.9, minHeight: Math.min(280, height * 0.9), backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.top}><Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>Add to message</Text><Pressable onPress={onClose} style={styles.close}><Icon name="close" color={theme.text} size={20} /></Pressable></View>
      <View style={[styles.tabs, { borderColor: theme.border }]}>{["Emoji", "Stickers", "GIFs"].map((item) => <Pressable key={item} onPress={() => { setTab(item); setQuery(""); }} style={[styles.tab, tab === item && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}><Text style={{ color: tab === item ? theme.primary : theme.muted, fontWeight: "600" }}>{item}</Text></Pressable>)}</View>
      <TextInput value={query} onChangeText={setQuery} placeholder={`Search ${tab.toLowerCase()}`} placeholderTextColor={theme.muted} style={[styles.search, colors]} />
      {tab === "Emoji" ? <FlatList keyboardShouldPersistTaps="handled" contentContainerStyle={styles.emojiList} data={filtered} numColumns={8} keyExtractor={(item) => item} renderItem={({ item }) => <Pressable onPress={() => pickEmoji(item)} style={styles.emoji}><Text style={{ fontSize: 27 }}>{item}</Text></Pressable>} ListHeaderComponent={!query && emojiRecents.length > 0 ? <View><Text style={[styles.section, { color: theme.muted }]}>Recent</Text><View style={styles.recent}>{emojiRecents.map((item, index) => <Pressable key={`${item}-${index}`} onPress={() => pickEmoji(item)}><Text style={{ fontSize: 25 }}>{item}</Text></Pressable>)}</View>{Object.keys(GROUPS).map((group) => <Text key={group} style={[styles.section, { color: theme.muted }]}>{group}</Text>)}</View> : null} /> : null}
      {tab === "Stickers" ? <View style={styles.stickerPanel}>
        {createAsset ? <View style={styles.createPreview}>
          <Image source={{ uri: createAsset.uri }} contentFit="contain" style={styles.createImage} />
          {!!createError && <Text style={{ color: theme.danger, textAlign: "center" }}>{createError}</Text>}
          {!!stickerError && <Text style={{ color: theme.danger, textAlign: "center" }}>{stickerError}</Text>}
          <View style={styles.createActions}><Pressable disabled={creatingSticker} onPress={() => { setCreateAsset(null); setCreateError(""); }} style={[styles.createAction, { borderColor: theme.border }]}><Text style={{ color: theme.muted }}>Cancel</Text></Pressable><Pressable disabled={creatingSticker} onPress={handleCreateSticker} style={[styles.createAction, { backgroundColor: theme.primary, borderColor: theme.primary }]}>{creatingSticker ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Create</Text>}</Pressable></View>
        </View> : <>
          <View style={[styles.stickerTabs, { borderColor: theme.border }]}>
            {["Recent", "Yours"].map((item) => <Pressable key={item} onPress={() => setStickerTab(item)} style={[styles.stickerTab, stickerTab === item && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}><Text style={{ color: stickerTab === item ? theme.primary : theme.muted, fontWeight: "600" }}>{item}</Text></Pressable>)}
            {stickerTab === "Yours" && <Pressable onPress={chooseStickerImage} style={styles.createButton}><Icon name="plus" size={17} color={theme.primary} /><Text style={{ color: theme.primary, fontSize: 12, fontWeight: "700" }}>Create</Text></Pressable>}
          </View>
          {!!createError && <Text style={{ color: theme.danger, textAlign: "center", paddingTop: 8 }}>{createError}</Text>}
          {stickersLoading ? <ActivityIndicator color={theme.primary} style={{ flex: 1 }} /> : stickerTab === "Recent" ? <FlatList data={recents} numColumns={4} keyExtractor={(item, index) => `${item}-${index}`} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: "center", padding: 25 }}>Stickers you send show up here.</Text>} renderItem={({ item }) => <Pressable onPress={() => pickSticker(item)} style={styles.mediaTile}><Image source={{ uri: item }} contentFit="contain" style={styles.mediaImage} /></Pressable>} /> : <FlatList data={stickers} numColumns={4} keyExtractor={(item) => String(item._id)} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: "center", padding: 25 }}>{stickerError || "No stickers yet. Create one."}</Text>} renderItem={({ item }) => <Pressable onPress={() => pickSticker(item.url)} onLongPress={() => confirmDeleteSticker(item)} delayLongPress={420} style={styles.mediaTile}><Image source={{ uri: item.url }} contentFit="contain" style={styles.mediaImage} /></Pressable>} />}
        </>}
      </View> : null}
      {tab === "GIFs" ? <View style={styles.gifPanel}>{loading ? <ActivityIndicator color={theme.primary} style={{ flex: 1 }} /> : <FlatList data={gifs} numColumns={3} keyExtractor={(item) => item.id} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: "center", padding: 24 }}>{GIPHY_API_KEY ? "No GIFs found." : "GIF search needs EXPO_PUBLIC_GIPHY_API_KEY in mobile/.env."}</Text>} renderItem={({ item }) => <Pressable onPress={() => { onGif(item.url); onClose(); }} style={styles.gifTile}><Image source={{ uri: item.preview }} contentFit="cover" style={styles.gifImage} /></Pressable>} />}<Text style={[styles.attribution, { color: theme.muted }]}>Powered by GIPHY</Text></View> : null}
    </View></Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({ avoid: { flex: 1, justifyContent: "flex-end" }, backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }, sheet: { flexShrink: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 14 }, top: { height: 52, alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, tabs: { height: 44, flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth }, tab: { minHeight: 44, flex: 1, alignItems: "center", justifyContent: "center" }, search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, marginVertical: 8 }, emojiList: { paddingBottom: 10 }, emoji: { width: "12.5%", minHeight: 44, alignItems: "center", justifyContent: "center" }, section: { fontSize: 12, fontWeight: "600", marginVertical: 8 }, recent: { flexDirection: "row", gap: 12, flexWrap: "wrap" }, grid: { paddingBottom: 14 }, mediaTile: { width: "25%", aspectRatio: 1, padding: 5 }, mediaImage: { width: "100%", height: "100%" }, gifPanel: { flex: 1, minHeight: 0 }, stickerPanel: { flex: 1, minHeight: 0 }, stickerTabs: { minHeight: 44, flexDirection: "row", alignItems: "stretch", borderBottomWidth: StyleSheet.hairlineWidth }, stickerTab: { minWidth: 72, minHeight: 44, alignItems: "center", justifyContent: "center" }, createButton: { marginLeft: "auto", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5 }, createPreview: { flex: 1, justifyContent: "center", gap: 14, padding: 8 }, createImage: { width: "100%", flex: 1, minHeight: 120 }, createActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 }, createAction: { minWidth: 88, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }, attribution: { minHeight: 28, textAlign: "center", paddingTop: 5, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(127,127,127,0.2)" }, gifTile: { width: "33.33%", aspectRatio: 1.25, padding: 3 }, gifImage: { width: "100%", height: "100%", borderRadius: 7 } });

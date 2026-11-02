import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { api } from "../lib/api";
import Icon from "./Icon";

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
  const [tab, setTab] = useState("Emoji");
  const [query, setQuery] = useState("");
  const [stickers, setStickers] = useState([]);
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emojiRecents, setEmojiRecents] = useState([]);
  const [stickerRecents, setStickerRecents] = useState([]);

  useEffect(() => {
    if (visible) api("/stickers").then((items) => setStickers(Array.isArray(items) ? items : [])).catch(() => setStickers([]));
  }, [visible]);
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
  const pickSticker = (url) => { setStickerRecents((list) => [url, ...list.filter((item) => item !== url)].slice(0, 24)); onSticker(url); onClose(); };
  const colors = { backgroundColor: theme.background, color: theme.text, borderColor: theme.border };
  const all = Object.values(GROUPS).flat();
  const filtered = query.trim() ? all.filter((item) => KEY[item].includes(query.trim().toLowerCase())) : all;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: 12 }]}>
      <View style={styles.top}><Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>Add to message</Text><Pressable onPress={onClose} style={styles.close}><Icon name="close" color={theme.text} size={20} /></Pressable></View>
      <View style={[styles.tabs, { borderColor: theme.border }]}>{["Emoji", "Stickers", "GIFs"].map((item) => <Pressable key={item} onPress={() => { setTab(item); setQuery(""); }} style={[styles.tab, tab === item && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}><Text style={{ color: tab === item ? theme.primary : theme.muted, fontWeight: "600" }}>{item}</Text></Pressable>)}</View>
      <TextInput value={query} onChangeText={setQuery} placeholder={`Search ${tab.toLowerCase()}`} placeholderTextColor={theme.muted} style={[styles.search, colors]} />
      {tab === "Emoji" ? <FlatList keyboardShouldPersistTaps="handled" contentContainerStyle={styles.emojiList} data={filtered} numColumns={8} keyExtractor={(item) => item} renderItem={({ item }) => <Pressable onPress={() => pickEmoji(item)} style={styles.emoji}><Text style={{ fontSize: 27 }}>{item}</Text></Pressable>} ListHeaderComponent={!query && emojiRecents.length > 0 ? <View><Text style={[styles.section, { color: theme.muted }]}>Recent</Text><View style={styles.recent}>{emojiRecents.map((item, index) => <Pressable key={`${item}-${index}`} onPress={() => pickEmoji(item)}><Text style={{ fontSize: 25 }}>{item}</Text></Pressable>)}</View>{Object.keys(GROUPS).map((group) => <Text key={group} style={[styles.section, { color: theme.muted }]}>{group}</Text>)}</View> : null} /> : null}
      {tab === "Stickers" ? <FlatList data={[...new Set([...stickerRecents, ...stickers.map((item) => item.url).filter(Boolean)])]} numColumns={4} keyExtractor={(item) => item} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: "center", padding: 25 }}>No stickers yet.</Text>} renderItem={({ item }) => <Pressable onPress={() => pickSticker(item)} style={styles.mediaTile}><Image source={{ uri: item }} contentFit="contain" style={styles.mediaImage} /></Pressable>} /> : null}
      {tab === "GIFs" ? <View style={styles.gifPanel}>{loading ? <ActivityIndicator color={theme.primary} style={{ flex: 1 }} /> : <FlatList data={gifs} numColumns={3} keyExtractor={(item) => item.id} contentContainerStyle={styles.grid} ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: "center", padding: 24 }}>{GIPHY_API_KEY ? "No GIFs found." : "GIF search needs EXPO_PUBLIC_GIPHY_API_KEY in mobile/.env."}</Text>} renderItem={({ item }) => <Pressable onPress={() => { onGif(item.url); onClose(); }} style={styles.gifTile}><Image source={{ uri: item.preview }} contentFit="cover" style={styles.gifImage} /></Pressable>} />}<Text style={[styles.attribution, { color: theme.muted }]}>Powered by GIPHY</Text></View> : null}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }, sheet: { height: "56%", minHeight: 300, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 14 }, top: { height: 52, alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, close: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, tabs: { height: 44, flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth }, tab: { flex: 1, alignItems: "center", justifyContent: "center" }, search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42, marginVertical: 10 }, emojiList: { paddingBottom: 10 }, emoji: { width: "12.5%", height: 43, alignItems: "center", justifyContent: "center" }, section: { fontSize: 12, fontWeight: "600", marginVertical: 8 }, recent: { flexDirection: "row", gap: 12, flexWrap: "wrap" }, grid: { paddingBottom: 14 }, mediaTile: { width: "25%", aspectRatio: 1, padding: 5 }, mediaImage: { width: "100%", height: "100%" }, gifPanel: { flex: 1 }, attribution: { minHeight: 28, textAlign: "center", paddingTop: 5, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(127,127,127,0.2)" }, gifTile: { width: "33.33%", aspectRatio: 1.25, padding: 3 }, gifImage: { width: "100%", height: "100%", borderRadius: 7 } });

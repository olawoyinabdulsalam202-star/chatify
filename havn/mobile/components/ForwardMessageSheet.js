import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { api } from "../lib/api";

export default function ForwardMessageSheet({ visible, message, theme, onClose }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    Promise.all([api("/messages/chats"), api("/messages/contacts"), api("/friends/status")]).then(([chats, contacts, status]) => {
      if (!active) return;
      const friends = new Set((status.friends || []).map(String));
      const unique = new Map();
      [...(Array.isArray(chats) ? chats : []), ...(Array.isArray(contacts) ? contacts : [])].forEach((person) => {
        if (person?._id && friends.has(String(person._id))) unique.set(String(person._id), person);
      });
      setPeople([...unique.values()]);
      setError("");
    }).catch((requestError) => { if (active) setError(requestError.message || "Could not load contacts."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible]);

  const forward = async (person) => {
    const body = {
      text: message?.text || "",
      image: message?.viewOnce ? undefined : message?.image,
      video: message?.viewOnce ? undefined : message?.video,
      videoDuration: message?.viewOnce ? undefined : message?.videoDuration,
      gif: message?.gif,
      sticker: message?.sticker,
      audio: message?.audio,
      audioDuration: message?.audioDuration,
    };
    try {
      await api(`/messages/send/${person._id}`, { method: "POST", body });
      onClose();
    } catch (requestError) { setError(requestError.message || "Could not forward this message."); }
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}><View style={[styles.sheet, { backgroundColor: theme.surface }]} onStartShouldSetResponder={() => true}>
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.titleRow}><Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>Forward to</Text><Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}><Icon name="close" color={theme.muted} size={19} /></Pressable></View>
      {loading ? <ActivityIndicator color={theme.primary} style={{ padding: 28 }} /> : <FlatList data={people} keyExtractor={(person) => String(person._id)} ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: "center", padding: 22 }}>{error || "No contacts to forward to yet."}</Text>} renderItem={({ item }) => <Pressable onPress={() => forward(item)} style={[styles.person, { borderBottomColor: theme.border }]}><Avatar uri={item.profilePic} name={item.fullName || item.username} size={42} /><Text numberOfLines={1} style={{ color: theme.text, flex: 1 }}>{item.fullName || item.username}</Text></Pressable>} />}
      {!!error && !loading && <Text style={{ color: theme.danger, padding: 8 }}>{error}</Text>}
    </View></Pressable>
  </Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" }, sheet: { maxHeight: "72%", minHeight: 280, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }, handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 }, titleRow: { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, close: { width: 42, height: 42, alignItems: "center", justifyContent: "center" }, person: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth }});

import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import LoadingView from "../components/LoadingView";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useGroupStore } from "../stores/useGroupStore";

export default function GroupsScreen({ embedded = false }) {
  const theme = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const unread = useGroupStore((state) => state.unread);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const load = async () => { setLoading(true); try { const data = await api("/groups"); setGroups(Array.isArray(data) ? data : []); } catch (error) { Alert.alert("Groups", error.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const create = () => Alert.alert("New group", "Enter a group name and invite someone from your contacts.", [
    { text: "Cancel", style: "cancel" },
    { text: "Continue", onPress: async () => {
      const contacts = await api("/messages/contacts").catch(() => []);
      if (!contacts.length) return Alert.alert("Invite a contact", "You need a contact to create a group.");
      Alert.alert("Invite someone", "Select a contact to invite", contacts.slice(0, 8).map((contact) => ({ text: contact.fullName || contact.username, onPress: async () => {
        try { const group = await api("/groups", { method: "POST", body: { name: name.trim() || "New group", memberIds: [contact._id], type: "group" } }); setName(""); setGroups([group, ...groups]); router.push(`/group/${group._id}`); }
        catch (error) { Alert.alert("Could not create group", error.message); }
      } })))
    } },
  ]);
  if (loading && !groups.length) return <AppScreen edges={embedded ? [] : undefined}><LoadingView label="Loading groups" /></AppScreen>;
  return <AppScreen edges={embedded ? [] : undefined}><View style={styles.heading}><Text allowFontScaling style={[styles.title, { color: theme.text, fontFamily: theme.fontFamily, fontSize: 26 * theme.fontScale }]}>Groups</Text><Pressable onPress={create} style={[styles.add, { backgroundColor: theme.primary }]}><Icon name="plus" size={20} color="#FFFFFF" /></Pressable></View>
    <View style={[styles.createBox, { backgroundColor: theme.surface, borderColor: theme.border }]}><TextInput allowFontScaling value={name} onChangeText={setName} placeholder="New group name" placeholderTextColor={theme.muted} style={{ flex: 1, color: theme.text, fontFamily: theme.fontFamily, fontSize: 14 * theme.fontScale }} /><Pressable accessibilityLabel="Create group" onPress={create}><Icon name="plus" color={theme.primary} /></Pressable></View>
    <FlatList data={groups.filter(Boolean)} keyExtractor={(item) => String(item._id)} onRefresh={load} refreshing={loading} contentContainerStyle={styles.list} ListEmptyComponent={<Text allowFontScaling style={{ color: theme.muted, textAlign: "center", padding: 28 }}>No groups yet</Text>} renderItem={({ item }) => <Pressable onPress={() => router.push(`/group/${item._id}`)} style={[styles.row, { borderBottomColor: theme.border }]}><Avatar uri={item.avatar} name={item.name} size={48} /><View style={{ flex: 1, minWidth: 0 }}><Text allowFontScaling numberOfLines={1} style={{ color: theme.fontColor || theme.text, fontFamily: theme.fontFamily, fontWeight: "700", fontSize: 16 * theme.fontScale }}>{item.name}</Text><Text allowFontScaling numberOfLines={1} style={{ color: theme.muted, fontFamily: theme.fontFamily, fontSize: 12 * theme.fontScale, marginTop: 3 }}>{item.type === "channel" ? "Channel" : `${item.members?.length || 0} members`}</Text></View>{unread[String(item._id)] > 0 && <View style={[styles.badge, { backgroundColor: theme.primary }]}><Text allowFontScaling style={[styles.badgeText, { fontSize: 11 * theme.fontScale }]}>{unread[String(item._id)] > 99 ? "99+" : unread[String(item._id)]}</Text></View>}</Pressable>} />
  </AppScreen>;
}

const styles = StyleSheet.create({ heading: { paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontSize: 26, fontWeight: "800" }, add: { height: 42, width: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, createBox: { minHeight: 48, borderWidth: 1, borderRadius: 14, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }, list: { paddingHorizontal: 16 }, row: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth }, badge: { minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, alignItems: "center", justifyContent: "center" }, badgeText: { color: "#FFF", fontSize: 11, fontWeight: "700" } });

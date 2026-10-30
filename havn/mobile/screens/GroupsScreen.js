import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import LoadingView from "../components/LoadingView";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useGroupStore } from "../stores/useGroupStore";

function previewText(message) {
  if (!message) return "";
  if (message.isDeleted) return "Message deleted";
  if (message.text) return message.text;
  if (message.image) return "Photo";
  if (message.video) return "Video";
  if (message.audio) return "Voice message";
  return "";
}

export default function GroupsScreen({ embedded = false }) {
  const theme = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const unread = useGroupStore((state) => state.unread);
  const storedGroups = useGroupStore((state) => state.groups);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api("/groups");
      const rows = Array.isArray(result) ? result.filter(Boolean) : [];
      const withLastMessages = await Promise.all(rows.map(async (group) => {
        try {
          const messages = await api("/groups/" + group._id + "/messages");
          return { ...group, lastMessage: Array.isArray(messages) ? messages[messages.length - 1] : null };
        } catch { return group; }
      }));
      setGroups(withLastMessages);
      useGroupStore.getState().setGroups(withLastMessages);
    } catch (error) { Alert.alert("Groups", error.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    setGroups((current) => current.map((group) => {
      const stored = storedGroups.find((item) => String(item._id) === String(group._id));
      return stored?.lastMessage ? { ...group, lastMessage: stored.lastMessage } : group;
    }));
  }, [storedGroups]);

  if (loading && !groups.length) return <AppScreen edges={embedded ? [] : undefined}><LoadingView label="Loading groups" /></AppScreen>;
  return <AppScreen edges={embedded ? [] : undefined}>
    <View style={styles.heading}><Text allowFontScaling style={[styles.title, { color: theme.text }]}>Groups</Text><Pressable accessibilityRole="button" accessibilityLabel="Create a group or channel" onPress={() => router.push("/create-group")} style={[styles.add, { backgroundColor: theme.primary }]}><Icon name="plus" size={20} color="#FFFFFF" /></Pressable></View>
    <FlatList
      data={groups.filter(Boolean)}
      keyExtractor={(item) => String(item._id)}
      onRefresh={load}
      refreshing={loading}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text allowFontScaling style={{ color: theme.muted, textAlign: "center", padding: 28 }}>No groups yet</Text>}
      renderItem={({ item }) => {
        const count = Number(unread[String(item._id)]) || 0;
        const message = item.lastMessage;
        return <Pressable onPress={() => router.push("/group/" + item._id)} style={[styles.row, { borderBottomColor: theme.border }]}>
          <Avatar uri={item.avatar} name={item.name} size={50} />
          <View style={styles.rowBody}>
            <View style={styles.rowHead}><Text allowFontScaling numberOfLines={1} style={[styles.name, { color: theme.fontColor || theme.text, fontFamily: theme.fontFamily }]}>{item.name || "Group"}</Text>{message?.createdAt && <Text style={[styles.time, { color: theme.muted }]}>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: false })}</Text>}</View>
            <View style={styles.previewLine}><Text allowFontScaling numberOfLines={1} style={[styles.preview, { color: theme.muted, fontFamily: theme.fontFamily }]}>{item.type === "channel" ? "Channel" : "Group"}{previewText(message) ? " · " + previewText(message) : ""}</Text>{count > 0 && <View style={[styles.badge, { backgroundColor: theme.primary }]}><Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text></View>}</View>
          </View>
        </Pressable>;
      }}
    />
  </AppScreen>;
}

const styles = StyleSheet.create({ heading: { paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontSize: 25, fontWeight: "800" }, add: { height: 42, width: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, list: { paddingHorizontal: 16, paddingBottom: 14 }, row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth }, rowBody: { flex: 1, minWidth: 0 }, rowHead: { flexDirection: "row", alignItems: "center", gap: 8 }, name: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: "700" }, time: { fontSize: 11 }, previewLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }, preview: { flex: 1, minWidth: 0, fontSize: 13 }, badge: { minWidth: 21, height: 21, paddingHorizontal: 5, borderRadius: 11, alignItems: "center", justifyContent: "center" }, badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" } });

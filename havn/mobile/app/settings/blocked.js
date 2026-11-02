import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import AppScreen from "../../components/AppScreen";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import LoadingView from "../../components/LoadingView";
import { showDialog } from "../../lib/dialog";
import { useTheme } from "../../lib/theme";
import { useBlockedStore } from "../../stores/useBlockedStore";

export default function BlockedContactsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const contacts = useBlockedStore((state) => state.contacts);
  const loading = useBlockedStore((state) => state.isLoading);
  const error = useBlockedStore((state) => state.error);
  const load = useBlockedStore((state) => state.load);
  const unblock = useBlockedStore((state) => state.unblock);

  useEffect(() => { load(); }, [load]);

  const confirmUnblock = (contact) => showDialog("Unblock contact?", contact.fullName || `@${contact.username}`, [
    { text: "Cancel", style: "cancel" },
    { text: "Unblock", onPress: async () => { const success = await unblock(contact._id); if (!success) showDialog("Couldn't unblock", useBlockedStore.getState().error); } },
  ]);

  return <AppScreen>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
      <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontFamily }]}>Blocked contacts</Text>
    </View>
    {loading ? <LoadingView label="Loading blocked contacts" /> : error ? <Pressable onPress={load} style={styles.empty}><Text style={{ color: theme.danger }}>{error}</Text><Text style={{ color: theme.primary, marginTop: 8 }}>Try again</Text></Pressable> : <FlatList
      data={contacts}
      keyExtractor={(item) => String(item._id)}
      contentContainerStyle={contacts.length ? styles.list : styles.empty}
      ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: "center", fontFamily: theme.fontFamily }}>You haven't blocked anyone</Text>}
      renderItem={({ item }) => <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Avatar uri={item.profilePic} name={item.fullName || item.username} size={46} />
        <View style={styles.identity}><Text numberOfLines={1} style={{ color: theme.text, fontFamily: theme.fontFamily, fontWeight: "700" }}>{item.fullName || item.username}</Text><Text numberOfLines={1} style={{ color: theme.muted, fontFamily: theme.fontFamily }}>@{item.username}</Text></View>
        <Pressable accessibilityRole="button" onPress={() => confirmUnblock(item)} style={[styles.button, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: "700" }}>Unblock</Text></Pressable>
      </View>}
    />}
  </AppScreen>;
}

const styles = StyleSheet.create({ header: { minHeight: 60, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 }, back: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, title: { fontSize: 20, fontWeight: "800" }, list: { padding: 14, gap: 10 }, row: { minHeight: 70, borderWidth: 1, borderRadius: 15, padding: 11, flexDirection: "row", alignItems: "center", gap: 11 }, identity: { flex: 1, minWidth: 0, gap: 3 }, button: { minHeight: 42, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }, empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 } });

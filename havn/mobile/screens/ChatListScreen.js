import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import Avatar from "../components/Avatar";
import ChatRow from "../components/ChatRow";
import RowErrorBoundary from "../components/RowErrorBoundary";
import Icon from "../components/Icon";
import { SkeletonRows } from "../components/LoadingView";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useAuthStore } from "../stores/useAuthStore";
import { useChatStore } from "../stores/useChatStore";
import { usePresenceStore } from "../stores/usePresenceStore";

function SearchResult({ person, onMessage }) {
  const theme = useTheme();
  return <View style={[styles.result, { borderBottomColor: theme.border }]}>
    <Avatar uri={person.profilePic} name={person.fullName || person.username} size={44} />
    <View style={styles.resultName}><Text allowFontScaling numberOfLines={1} style={[styles.personName, { color: theme.text }]}>{person.fullName || person.username}</Text><Text allowFontScaling numberOfLines={1} style={[styles.personHandle, { color: theme.muted }]}>@{person.username}</Text></View>
    <Pressable accessibilityRole="button" onPress={onMessage} style={[styles.messageButton, { backgroundColor: theme.primary }]}><Text allowFontScaling style={styles.messageButtonText}>Message</Text></Pressable>
  </View>;
}

export default function ChatListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const authUser = useAuthStore((state) => state.authUser);
  const chats = useChatStore((state) => state.chats);
  const isLoading = useChatStore((state) => state.isLoading);
  const isRefreshing = useChatStore((state) => state.isRefreshing);
  const error = useChatStore((state) => state.error);
  const unreadCounts = useChatStore((state) => state.unreadCounts);
  const searchResults = useChatStore((state) => state.searchResults);
  const query = useChatStore((state) => state.query);
  const loadChats = useChatStore((state) => state.loadChats);
  const searchUsers = useChatStore((state) => state.searchUsers);
  const rememberPerson = useChatStore((state) => state.rememberPerson);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [assistantName, setAssistantName] = useState("Havn AI");

  useEffect(() => { loadChats(); }, [loadChats]);
  useEffect(() => {
    api("/groups/assistant").then((assistant) => {
      if (typeof assistant?.name === "string" && assistant.name.trim()) setAssistantName(assistant.name.trim());
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchText), 280);
    return () => clearTimeout(timer);
  }, [searchText, searchUsers]);

  const openPerson = (person) => {
    rememberPerson(person);
    router.push(`/chat/${person._id}`);
  };
  const searching = searchOpen && searchText.trim().length > 0;
  const safeChats = Array.isArray(chats) ? chats.filter(Boolean) : [];
  const safeSearchResults = Array.isArray(searchResults) ? searchResults.filter(Boolean) : [];
  const listData = [{ _id: "__assistant__", assistant: true }, ...safeChats];

  return <AppScreen edges={["top", "left", "right"]}>
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <View style={styles.headingGroup}><Text allowFontScaling style={[styles.heading, { color: theme.text }]}>Chats</Text><Text allowFontScaling style={[styles.subtitle, { color: theme.muted }]}>Private conversations</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? "Close search" : "Search by username"} onPress={() => { setSearchOpen((value) => !value); setSearchText(""); }} style={[styles.headerButton, { backgroundColor: theme.surface }]}><Icon name={searchOpen ? "close" : "search"} color={theme.text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push("/settings")} style={[styles.avatarButton, { borderColor: theme.border }]}><Avatar uri={authUser?.profilePic} name={authUser?.fullName} size={40} /></Pressable>
    </View>
    {searchOpen && <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}><Icon name="search" color={theme.muted} size={19} /><TextInput value={searchText} onChangeText={setSearchText} autoCapitalize="none" autoCorrect={false} placeholder="Search username" placeholderTextColor={theme.muted} style={[styles.searchInput, { color: theme.text }]} /></View>}
    {searching ? <FlatList
      data={safeSearchResults}
      keyExtractor={(item, index) => String(item?._id || `missing-search-${index}`)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.searchResults}
      ListEmptyComponent={!error ? <Text allowFontScaling style={[styles.emptySearch, { color: theme.muted }]}>{searchText.length < 2 ? "Type at least 2 characters." : "No people found."}</Text> : <Text style={[styles.emptySearch, { color: theme.danger }]}>{error}</Text>}
      renderItem={({ item }) => <RowErrorBoundary key={String(item?._id || "missing-search-result")}><SearchResult person={item} onMessage={() => openPerson(item)} /></RowErrorBoundary>}
    /> : isLoading && chats.length === 0 ? <SkeletonRows count={6} /> : <FlatList
      data={listData}
      keyExtractor={(item, index) => String(item?._id || (item?.assistant ? "__assistant__" : `missing-chat-${index}`))}
      contentContainerStyle={[styles.list, !safeChats.length && styles.flexGrow]}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadChats({ refresh: true })} tintColor={theme.primary} colors={[theme.primary]} />}
      ListEmptyComponent={safeChats.length === 0 ? <View style={styles.empty}><Text allowFontScaling style={[styles.emptyTitle, { color: theme.text }]}>No conversations yet</Text><Text allowFontScaling style={[styles.emptyCopy, { color: theme.muted }]}>Search for a username to start a chat.</Text></View> : null}
      ListHeaderComponent={error && safeChats.length === 0 ? <Pressable onPress={() => loadChats()}><Text style={[styles.error, { color: theme.danger }]}>{error} · Tap to retry</Text></Pressable> : null}
      renderItem={({ item }) => <RowErrorBoundary key={String(item?._id || "missing-chat-row")}>
        {item?.assistant
          ? <ChatRow assistant assistantName={assistantName} onPress={() => router.push("/assistant")} />
          : item ? <ChatRow person={item} unread={unreadCounts[String(item._id)] ?? (Number(item.unreadCount) || 0)} online={onlineUsers.includes(String(item._id))} onPress={() => openPerson(item)} /> : null}
      </RowErrorBoundary>}
    />}
  </AppScreen>;
}

const styles = StyleSheet.create({ header: { minHeight: 76, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 }, headingGroup: { flex: 1, minWidth: 0 }, heading: { fontSize: 27, fontWeight: "800", letterSpacing: -0.4 }, subtitle: { fontSize: 12, marginTop: 2 }, headerButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, avatarButton: { padding: 1, borderRadius: 22, borderWidth: 1 }, searchBox: { marginHorizontal: 16, marginVertical: 12, height: 48, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }, searchInput: { flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 0 }, list: { paddingTop: 8, paddingBottom: 12 }, flexGrow: { flexGrow: 1 }, empty: { flex: 1, minHeight: 300, justifyContent: "center", alignItems: "center", padding: 30 }, emptyTitle: { fontSize: 20, fontWeight: "700" }, emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 }, error: { padding: 16, fontSize: 13 }, searchResults: { paddingHorizontal: 16 }, result: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth }, resultName: { flex: 1, minWidth: 0 }, personName: { fontSize: 15, fontWeight: "700" }, personHandle: { fontSize: 12, marginTop: 2 }, messageButton: { minHeight: 38, justifyContent: "center", paddingHorizontal: 13, borderRadius: 11 }, messageButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" }, emptySearch: { padding: 24, textAlign: "center", fontSize: 14 } });

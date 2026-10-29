import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import Icon from "../components/Icon";
import LoadingView from "../components/LoadingView";
import MessageBubble from "../components/MessageBubble";
import { useTheme } from "../lib/theme";
import { useAuthStore } from "../stores/useAuthStore";
import { useAssistantStore } from "../stores/useAssistantStore";

const suggestions = [
  "Help me plan my week",
  "Explain a tricky idea simply",
  "Help me write a thoughtful reply",
];

export default function AssistantScreen() {
  const theme = useTheme();
  const router = useRouter();
  const listRef = useRef(null);
  const nearBottomRef = useRef(true);
  const draggingRef = useRef(false);
  const olderLockRef = useRef(false);
  const storedMessages = useAssistantStore((state) => state.messages);
  const ownerId = useAssistantStore((state) => state.ownerId);
  const authUserId = useAuthStore((state) => state.authUser?._id);
  const messages = String(ownerId) === String(authUserId) ? storedMessages : [];
  const hasMore = useAssistantStore((state) => state.hasMore);
  const loading = useAssistantStore((state) => state.isLoading);
  const loadingOlder = useAssistantStore((state) => state.isLoadingOlder);
  const sending = useAssistantStore((state) => state.isSending);
  const storedError = useAssistantStore((state) => state.error);
  const error = String(ownerId) === String(authUserId) ? storedError : "";
  const errorType = useAssistantStore((state) => state.errorType);
  const loadHistory = useAssistantStore((state) => state.loadHistory);
  const loadOlder = useAssistantStore((state) => state.loadOlder);
  const send = useAssistantStore((state) => state.send);
  const retry = useAssistantStore((state) => state.retry);
  const clear = useAssistantStore((state) => state.clear);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, sending]);

  const loadEarlier = useCallback(async () => {
    if (olderLockRef.current || loadingOlder || !hasMore) return;
    olderLockRef.current = true;
    await loadOlder();
    olderLockRef.current = false;
  }, [hasMore, loadOlder, loadingOlder]);

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setText("");
    const sent = await send(value);
    if (sent) {
      nearBottomRef.current = true;
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const handleSuggestion = async (suggestion) => {
    if (sending) return;
    const sent = await send(suggestion);
    if (sent) {
      nearBottomRef.current = true;
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const confirmClear = () => {
    setMenuOpen(false);
    Alert.alert("Clear chat?", "This removes your Havn AI conversation from your account.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear chat", style: "destructive", onPress: async () => {
        const cleared = await clear();
        if (cleared) listRef.current?.scrollToOffset({ offset: 0, animated: false });
      } },
    ]);
  };

  const retryRequest = async () => {
    const succeeded = await retry();
    if (succeeded) {
      nearBottomRef.current = true;
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={[styles.emptyAvatar, { backgroundColor: theme.primary }]}><Icon name="bot" color={theme.white} size={28} /></View>
      <Text allowFontScaling style={[styles.emptyTitle, { color: theme.text }]}>Talk it through with Havn AI</Text>
      <Text allowFontScaling style={[styles.emptyCopy, { color: theme.muted }]}>Ask a question, explore an idea, or get help finding the right words. This chat is private to you.</Text>
      <View style={styles.suggestions}>
        {suggestions.map((suggestion) => <Pressable key={suggestion} onPress={() => handleSuggestion(suggestion)} disabled={sending} style={[styles.suggestion, { borderColor: theme.border, backgroundColor: theme.surface, opacity: sending ? 0.55 : 1 }]}>
          <Text allowFontScaling style={{ color: theme.text }}>{suggestion}</Text>
        </Pressable>)}
      </View>
    </View>
  );

  return <AppScreen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}><Icon name="bot" color={theme.white} size={22} /></View>
        <View style={styles.title}>
          <Text allowFontScaling numberOfLines={1} style={[styles.name, { color: theme.text }]}>Havn AI</Text>
          <Text allowFontScaling numberOfLines={1} style={[styles.subtitle, { color: theme.muted }]}>Private chat</Text>
        </View>
        <View style={styles.menuWrap}>
          <Pressable accessibilityRole="button" accessibilityLabel="AI chat options" onPress={() => setMenuOpen((open) => !open)} style={styles.menuButton}><Icon name="more" color={theme.muted} /></Pressable>
          {menuOpen && <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear chat" disabled={sending} onPress={confirmClear} style={[styles.menuItem, { opacity: sending ? 0.5 : 1 }]}>
              <Icon name="trash" color={theme.danger} size={18} /><Text allowFontScaling style={{ color: theme.text, fontSize: 14 }}>Clear chat</Text>
            </Pressable>
          </View>}
        </View>
      </View>

      {loading && messages.length === 0 ? <LoadingView label="Loading Havn AI chat" /> : errorType === "history" && messages.length === 0 ? <View style={styles.loadError}>
        <Text allowFontScaling style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={retryRequest} style={[styles.retryButton, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: "700" }}>Retry</Text></Pressable>
      </View> : <FlatList
        ref={listRef}
        style={styles.flex}
        data={messages}
        keyExtractor={(message) => String(message._id)}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        contentContainerStyle={styles.messages}
        onScrollBeginDrag={() => { draggingRef.current = true; }}
        onScrollEndDrag={() => { draggingRef.current = false; }}
        onMomentumScrollEnd={() => { draggingRef.current = false; }}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          nearBottomRef.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
          if (draggingRef.current && contentOffset.y < 40 && hasMore) loadEarlier();
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => { if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false }); }}
        ListHeaderComponent={hasMore ? <Pressable accessibilityRole="button" disabled={loadingOlder} onPress={loadEarlier} style={[styles.loadOlder, { borderColor: theme.border, opacity: loadingOlder ? 0.55 : 1 }]}>
          <Text allowFontScaling style={{ color: theme.muted, fontSize: 12 }}>{loadingOlder ? "Loading earlier messages..." : "Load earlier messages"}</Text>
        </Pressable> : null}
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => <MessageBubble message={item} own={item.role === "user"} />}
      />}

      {sending && <View style={[styles.typing, { backgroundColor: theme.incoming }]}><Text allowFontScaling style={{ color: theme.muted }}>Havn AI is typing...</Text></View>}
      {!!error && (errorType !== "history" || messages.length > 0) && <View style={[styles.error, { backgroundColor: theme.background }]}>
        <Text allowFontScaling style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={retryRequest} disabled={sending} hitSlop={8}><Text allowFontScaling style={{ color: theme.primary, fontWeight: "700" }}>Retry</Text></Pressable>
      </View>}

      <View style={[styles.composer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput value={text} onChangeText={(value) => setText(value.slice(0, 2000))} editable={!sending} maxLength={2000} multiline placeholder="Message Havn AI" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text }]} />
          <Text allowFontScaling style={[styles.counter, { color: text.length >= 1900 ? theme.danger : theme.muted }]}>{text.length}/2000</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!text.trim() || sending} onPress={handleSend} style={[styles.send, { backgroundColor: theme.primary, opacity: !text.trim() || sending ? 0.5 : 1 }]}>
            <Icon name="send" color={theme.white} size={18} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </AppScreen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  header: { minHeight: 68, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 11 },
  title: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  menuWrap: { position: "relative", zIndex: 2 },
  menuButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  menu: { position: "absolute", top: 48, right: 4, width: 160, borderRadius: 14, borderWidth: 1, paddingVertical: 4, elevation: 8 },
  menuItem: { minHeight: 48, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  messages: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 8, paddingVertical: 12 },
  loadOlder: { alignSelf: "center", minHeight: 38, justifyContent: "center", borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, marginBottom: 12 },
  empty: { flexGrow: 1, minHeight: 380, alignItems: "center", justifyContent: "center", paddingHorizontal: 15, paddingVertical: 24 },
  emptyAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 19, fontWeight: "700", textAlign: "center" },
  emptyCopy: { maxWidth: 420, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  suggestions: { width: "100%", maxWidth: 430, gap: 8, marginTop: 20 },
  suggestion: { minHeight: 46, borderWidth: 1, borderRadius: 14, justifyContent: "center", paddingHorizontal: 14 },
  typing: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center", borderRadius: 18, paddingHorizontal: 13, marginHorizontal: 14, marginBottom: 5 },
  error: { paddingHorizontal: 14, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 12 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19 },
  loadError: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  retryButton: { minHeight: 42, justifyContent: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 20 },
  composer: { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrap: { maxWidth: 760, width: "100%", alignSelf: "center", minHeight: 52, flexDirection: "row", alignItems: "flex-end", borderWidth: 1, borderRadius: 19, padding: 5, gap: 5 },
  input: { flex: 1, minWidth: 0, maxHeight: 116, minHeight: 42, paddingHorizontal: 10, paddingVertical: 9, fontSize: 16, lineHeight: 21 },
  counter: { alignSelf: "flex-end", paddingBottom: 12, fontSize: 10 },
  send: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});

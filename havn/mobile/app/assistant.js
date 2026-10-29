import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import Icon from "../components/Icon";
import LoadingView from "../components/LoadingView";
import MessageBubble from "../components/MessageBubble";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useAssistantStore } from "../stores/useAssistantStore";

export default function AssistantScreen() {
  const theme = useTheme();
  const router = useRouter();
  const list = useRef(null);
  const messages = useAssistantStore((state) => state.messages);
  const loading = useAssistantStore((state) => state.isLoading);
  const sending = useAssistantStore((state) => state.isSending);
  const error = useAssistantStore((state) => state.error);
  const loadHistory = useAssistantStore((state) => state.loadHistory);
  const send = useAssistantStore((state) => state.send);
  const clear = useAssistantStore((state) => state.clear);
  const [name, setName] = useState("Kairos");
  const [text, setText] = useState("");
  const [failedText, setFailedText] = useState("");
  useEffect(() => {
    loadHistory();
    api("/groups/assistant").then((result) => setName(result.name || result.botName || "Kairos")).catch(() => {});
  }, [loadHistory]);
  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setText("");
    try { await send(value); setFailedText(""); } catch { setText(value); setFailedText(value); }
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
  };
  return <AppScreen>
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <Pressable onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
      <View style={styles.title}><Text allowFontScaling style={[styles.name, { color: theme.text }]}>{name}</Text><Text allowFontScaling style={{ color: theme.muted, fontSize: 12 }}>AI assistant · Replies are only visible to you</Text></View>
      <Pressable onPress={() => clear().catch((err) => {})} accessibilityRole="button" accessibilityLabel="Clear chat" style={styles.action}><Icon name="close" color={theme.muted} size={20} /></Pressable>
    </View>
    {loading && !messages.length ? <LoadingView label="Loading conversation" /> : <FlatList ref={list} data={messages} keyExtractor={(item) => item._id} contentContainerStyle={styles.messages} renderItem={({ item }) => <MessageBubble message={item} mine={item.role === "user"} />} ListEmptyComponent={<View style={styles.empty}><Text allowFontScaling style={[styles.emptyTitle, { color: theme.text }]}>A little help, whenever you need it.</Text><Text allowFontScaling style={{ color: theme.muted, textAlign: "center", lineHeight: 22 }}>Ask a question, brainstorm an idea, or get help putting something into words.</Text>{["Help me write a message", "Give me ideas for today", "Explain something simply"].map((suggestion) => <Pressable key={suggestion} onPress={() => setText(suggestion)} style={[styles.suggestion, { borderColor: theme.border }]}><Text allowFontScaling style={{ color: theme.primary }}>{suggestion}</Text></Pressable>)}</View>} />}
    {sending && <Text allowFontScaling style={[styles.typing, { color: theme.muted }]}>Kairos is typing...</Text>}
    {!!error && <View style={styles.error}><Text allowFontScaling style={{ color: theme.danger, flex: 1 }}>{error}</Text><Pressable onPress={() => failedText ? submit() : loadHistory()}><Text style={{ color: theme.primary, fontWeight: "700" }}>Retry</Text></Pressable></View>}
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
      <View style={[styles.composer, { backgroundColor: theme.background, borderTopColor: theme.border }]}><TextInput value={text} onChangeText={setText} editable={!sending} maxLength={2000} multiline placeholder="Message Kairos" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]} /><Pressable disabled={!text.trim() || sending} onPress={submit} style={[styles.send, { backgroundColor: theme.primary, opacity: !text.trim() || sending ? 0.5 : 1 }]}><Icon name="send" color={theme.white} size={19} /></Pressable></View>
    </KeyboardAvoidingView>
  </AppScreen>;
}

const styles = StyleSheet.create({ header: { height: 64, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth }, back: { width: 44, height: 48, justifyContent: "center" }, title: { flex: 1, minWidth: 0 }, name: { fontSize: 17, fontWeight: "800" }, action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, messages: { flexGrow: 1, justifyContent: "flex-end", padding: 14 }, empty: { alignItems: "center", justifyContent: "center", paddingVertical: 34, gap: 12 }, emptyTitle: { fontSize: 21, fontWeight: "800", textAlign: "center" }, suggestion: { minHeight: 44, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center", alignSelf: "stretch" }, typing: { paddingHorizontal: 16, paddingBottom: 7 }, error: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 }, composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth }, input: { flex: 1, minWidth: 0, maxHeight: 120, minHeight: 44, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16 }, send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" } });

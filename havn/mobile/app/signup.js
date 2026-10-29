import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import ActionButton from "../components/ActionButton";
import { useTheme } from "../lib/theme";
import { useAuthStore } from "../stores/useAuthStore";

export default function SignupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const signup = useAuthStore((state) => state.signup);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await signup(form);
      router.push({ pathname: "/verify", params: { email: result.email } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text allowFontScaling style={[styles.title, { color: theme.text }]}>Create your account</Text>
            <Text allowFontScaling style={[styles.subtitle, { color: theme.muted }]}>Choose a username people can find.</Text>
            <Text allowFontScaling style={[styles.label, { color: theme.text }]}>Username</Text>
            <TextInput value={form.username} onChangeText={update("username")} autoCapitalize="none" autoCorrect={false} maxLength={30} placeholder="yourname" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} />
            <Text allowFontScaling style={[styles.label, { color: theme.text }]}>Email</Text>
            <TextInput value={form.email} onChangeText={update("email")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="you@example.com" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} />
            <Text allowFontScaling style={[styles.label, { color: theme.text }]}>Password</Text>
            <TextInput value={form.password} onChangeText={update("password")} secureTextEntry autoComplete="new-password" placeholder="At least 6 characters" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} />
            {!!error && <Text allowFontScaling style={{ color: theme.danger, marginTop: 12 }}>{error}</Text>}
            <ActionButton title="Create account" busy={busy} disabled={!form.username || !form.email || !form.password} onPress={submit} style={{ marginTop: 24 }} />
            <View style={styles.footer}><Text allowFontScaling style={{ color: theme.muted }}>Already have an account? </Text><Link href="/login" style={{ color: theme.primary, fontWeight: "700" }}>Sign in</Link></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 }, scroll: { flexGrow: 1, justifyContent: "center", padding: 18 }, card: { width: "100%", maxWidth: 520, alignSelf: "center", borderWidth: 1, borderRadius: 24, padding: 22 }, title: { fontSize: 28, fontWeight: "800" }, subtitle: { fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 18 }, label: { fontSize: 14, fontWeight: "700", marginTop: 14, marginBottom: 8 }, input: { minHeight: 50, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 }, footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 18, padding: 10 } });

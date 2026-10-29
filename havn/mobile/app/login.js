import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "../components/Icon";
import ActionButton from "../components/ActionButton";
import { useTheme } from "../lib/theme";
import { useAuthStore } from "../stores/useAuthStore";

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      router.replace(String(params.redirect || "/"));
    } catch (err) {
      if (err.data?.needsVerification && err.data.email) {
        router.replace({ pathname: "/verify", params: { email: err.data.email } });
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.brandMark, { backgroundColor: theme.primary }]}><Text style={styles.brandH}>h</Text></View>
            <Text allowFontScaling style={[styles.heading, { color: theme.text }]}>Welcome back</Text>
            <Text allowFontScaling style={[styles.subtitle, { color: theme.muted }]}>Sign in to pick up where you left off.</Text>

            <Text allowFontScaling style={[styles.label, { color: theme.text }]}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} />

            <Text allowFontScaling style={[styles.label, { color: theme.text }]}>Password</Text>
            <View style={[styles.passwordWrap, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoComplete="password" textContentType="password" placeholder="Enter your password" placeholderTextColor={theme.muted} style={[styles.password, { color: theme.text }]} />
              <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} onPress={() => setVisible((current) => !current)} hitSlop={8} style={styles.eye}><Icon name={visible ? "eyeOff" : "eye"} color={theme.muted} /></Pressable>
            </View>
            {!!error && <Text allowFontScaling style={[styles.error, { color: theme.danger }]}>{error}</Text>}
            <ActionButton title="Sign in" onPress={submit} busy={busy} disabled={!email.trim() || !password} style={styles.submit} />
            <Link href="https://havn.kairos-va.com/forgot-password" asChild><Pressable style={styles.link}><Text allowFontScaling style={{ color: theme.primary }}>Forgot password?</Text></Pressable></Link>
            <View style={styles.signup}><Text allowFontScaling style={{ color: theme.muted }}>New here? </Text><Link href="/signup" style={{ color: theme.primary, fontWeight: "700" }}>Create an account</Link></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 }, flex: { flex: 1 }, scroll: { flexGrow: 1, justifyContent: "center", padding: 18 }, card: { width: "100%", maxWidth: 520, alignSelf: "center", borderRadius: 26, borderWidth: 1, padding: 22 }, brandMark: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 22 }, brandH: { color: "#FFF7ED", fontSize: 34, fontWeight: "800", lineHeight: 38 }, heading: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }, subtitle: { fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 26 }, label: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 14 }, input: { minHeight: 50, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 }, passwordWrap: { minHeight: 50, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center" }, password: { flex: 1, minWidth: 0, paddingLeft: 14, fontSize: 16 }, eye: { minWidth: 46, minHeight: 48, alignItems: "center", justifyContent: "center" }, error: { fontSize: 14, marginTop: 12 }, submit: { marginTop: 22 }, link: { alignSelf: "center", padding: 14, minHeight: 48, justifyContent: "center" }, signup: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", marginTop: 4, paddingVertical: 6 } });

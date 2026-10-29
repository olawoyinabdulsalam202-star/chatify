import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import ActionButton from "../components/ActionButton";
import { useTheme } from "../lib/theme";
import { useAuthStore } from "../stores/useAuthStore";

export default function VerifyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = String(params.email || "");
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      await verifyOtp(email, otp);
      router.replace("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text allowFontScaling style={[styles.title, { color: theme.text }]}>Check your email</Text>
          <Text allowFontScaling style={[styles.copy, { color: theme.muted }]}>Enter the verification code sent to {email}.</Text>
          <TextInput value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} placeholder="000000" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]} />
          {!!error && <Text allowFontScaling style={{ color: theme.danger, marginTop: 12 }}>{error}</Text>}
          <ActionButton title="Verify email" busy={busy} disabled={otp.length !== 6} onPress={verify} style={{ marginTop: 20 }} />
          <Link href="/login" style={{ color: theme.primary, textAlign: "center", padding: 16 }}>Back to sign in</Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, justifyContent: "center", padding: 18 }, card: { width: "100%", maxWidth: 500, alignSelf: "center", padding: 22, borderRadius: 24, borderWidth: 1 }, title: { fontSize: 28, fontWeight: "800" }, copy: { fontSize: 15, lineHeight: 22, marginTop: 8 }, input: { marginTop: 22, minHeight: 58, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 24, letterSpacing: 8, textAlign: "center" } });

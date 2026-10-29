import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppScreen from "../../components/AppScreen";
import ActionButton from "../../components/ActionButton";
import Icon from "../../components/Icon";
import LoadingView from "../../components/LoadingView";
import { api } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { useAuthStore } from "../../stores/useAuthStore";

export default function QrApprovalScreen() {
  const { code } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const authUser = useAuthStore((state) => state.authUser);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!authUser) router.replace({ pathname: "/login", params: { redirect: `/qr/${code}` } });
  }, [authUser, code, router]);
  useEffect(() => { api(`/auth/qr/${encodeURIComponent(String(code || ""))}/info`).then(setInfo).catch((err) => setError(err.message)); }, [code]);
  const approve = async () => {
    setBusy(true);
    try { await api("/auth/qr/approve", { method: "POST", body: { code } }); Alert.alert("Device linked", "You can use Havn on the web now."); router.replace("/"); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <AppScreen style={styles.screen}>
    <Pressable onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
    {!info && !error ? <LoadingView label="Checking login" /> : <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Icon name="monitor" color={theme.primary} size={36} />
      <Text allowFontScaling style={[styles.title, { color: theme.text }]}>Link web device</Text>
      {error ? <Text allowFontScaling style={{ color: theme.danger, textAlign: "center" }}>{error}</Text> : <Text allowFontScaling style={[styles.description, { color: theme.muted }]}>Log in on {info?.browser || "Browser"}, {info?.operatingSystem || "device"}{info?.city ? `, from ${info.city}` : ""}?</Text>}
      {info && <ActionButton title="Approve" busy={busy} onPress={approve} style={{ alignSelf: "stretch" }} />}
    </View>}
  </AppScreen>;
}

const styles = StyleSheet.create({ screen: { padding: 18 }, back: { width: 44, height: 44, justifyContent: "center" }, card: { marginTop: 40, alignItems: "center", borderRadius: 24, padding: 24, gap: 17 }, title: { fontSize: 24, fontWeight: "800", textAlign: "center" }, description: { fontSize: 16, lineHeight: 24, textAlign: "center", marginBottom: 8 } });

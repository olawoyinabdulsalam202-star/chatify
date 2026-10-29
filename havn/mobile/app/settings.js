import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import ActionButton from "../components/ActionButton";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import LoadingView from "../components/LoadingView";
import { api } from "../lib/api";
import { registerPushDevice, unregisterPushDevice } from "../lib/push";
import { useTheme } from "../lib/theme";
import { useAuthStore } from "../stores/useAuthStore";
import { useAppStore } from "../stores/useAppStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

function SettingRow({ icon, title, subtitle, onPress, trailing }) {
  const theme = useTheme();
  return <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: theme.border }]}>
    <Icon name={icon} color={theme.primary} />
    <View style={styles.rowText}><Text allowFontScaling style={{ color: theme.text, fontWeight: "700" }}>{title}</Text>{!!subtitle && <Text allowFontScaling style={{ color: theme.muted, marginTop: 3 }}>{subtitle}</Text>}</View>
    {trailing || <Icon name="chevron" color={theme.muted} size={19} />}
  </Pressable>;
}

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.authUser);
  const logout = useAuthStore((state) => state.logout);
  const soundEnabled = useAppStore((state) => state.soundEnabled);
  const setSoundEnabled = useAppStore((state) => state.setSoundEnabled);
  const [sessions, setSessions] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadSessions = useCallback(async () => {
    setError("");
    try { setSessions(await api("/auth/sessions")); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    loadSessions();
    AsyncStorage.getItem("havn.notificationsEnabled").then((value) => setNotificationsEnabled(value === "true")).catch(() => {});
  }, [loadSessions]);
  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      await unregisterPushDevice();
      setNotificationsEnabled(false);
      await AsyncStorage.setItem("havn.notificationsEnabled", "false").catch(() => {});
      return;
    }
    const result = await registerPushDevice();
    if (result.ok) {
      setNotificationsEnabled(true);
      await AsyncStorage.setItem("havn.notificationsEnabled", "true").catch(() => {});
    } else Alert.alert("Notifications", result.message || (result.reason === "permission-denied" ? "Notification permission was not granted." : "Notifications could not be enabled on this device."));
  };
  const toggleSound = async () => {
    await setSoundEnabled(!soundEnabled);
  };
  const revoke = (session) => Alert.alert("Remove linked device?", session.deviceName || "This device", [
    { text: "Cancel", style: "cancel" },
    { text: "Revoke", style: "destructive", onPress: async () => {
      try { await api(`/auth/sessions/${session._id}`, { method: "DELETE" }); await loadSessions(); }
      catch (err) { Alert.alert("Could not revoke device", err.message); }
    } },
  ]);
  return <AppScreen>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
        <Text allowFontScaling style={[styles.heading, { color: theme.text }]}>Settings</Text>
      </View>
      <View style={[styles.profile, { backgroundColor: theme.surface }]}><Avatar uri={user?.profilePic} name={user?.fullName || user?.username} size={58} /><View style={styles.profileText}><Text allowFontScaling numberOfLines={1} style={[styles.name, { color: theme.text }]}>{user?.fullName || user?.username}</Text><Text allowFontScaling numberOfLines={1} style={{ color: theme.muted }}>@{user?.username}</Text></View></View>
      <Text allowFontScaling style={[styles.section, { color: theme.muted }]}>PREFERENCES</Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <SettingRow icon={soundEnabled ? "sound" : "soundOff"} title="Message sounds" subtitle={soundEnabled ? "On" : "Off"} onPress={toggleSound} trailing={<Text style={{ color: theme.primary, fontWeight: "700" }}>{soundEnabled ? "On" : "Off"}</Text>} />
        <SettingRow icon="bell" title="Notifications" subtitle={notificationsEnabled ? "On · tap to turn off" : "Off · tap to turn on"} onPress={toggleNotifications} trailing={<Text style={{ color: theme.primary, fontWeight: "700" }}>{notificationsEnabled ? "On" : "Off"}</Text>} />
        <SettingRow icon="camera" title="Link a device" subtitle="Scan a web login QR code" onPress={() => router.push("/link-device")} />
      </View>
      <Text allowFontScaling style={[styles.section, { color: theme.muted }]}>LINKED DEVICES</Text>
      {loading ? <LoadingView label="Loading devices" /> : error ? <View><Text allowFontScaling style={{ color: theme.danger, marginBottom: 8 }}>{error}</Text><ActionButton title="Retry" secondary onPress={loadSessions} /></View> : sessions.length === 0 ? <Text allowFontScaling style={{ color: theme.muted, paddingVertical: 8 }}>No other devices are linked.</Text> : sessions.map((session) => <View key={session._id} style={[styles.device, { backgroundColor: theme.surface }]}>
        <Icon name="monitor" color={theme.primary} /><View style={styles.rowText}><Text allowFontScaling style={{ color: theme.text, fontWeight: "700" }} numberOfLines={1}>{session.deviceName || session.platform || "Linked device"}</Text><Text allowFontScaling style={{ color: theme.muted, marginTop: 3 }} numberOfLines={1}>Last active {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : "recently"}</Text></View><Pressable onPress={() => revoke(session)} accessibilityRole="button" accessibilityLabel="Revoke linked device" style={styles.revoke}><Text style={{ color: theme.danger, fontWeight: "700" }}>Revoke</Text></Pressable>
      </View>)}
      <ActionButton title="Sign out" secondary onPress={() => logout()} style={styles.logout} />
    </ScrollView>
  </AppScreen>;
}

const styles = StyleSheet.create({ content: { padding: 18, paddingBottom: 32 }, header: { flexDirection: "row", alignItems: "center", marginBottom: 20 }, back: { width: 44, height: 44, justifyContent: "center" }, heading: { fontSize: 25, fontWeight: "800", marginLeft: 4 }, profile: { minHeight: 82, borderRadius: 20, padding: 12, flexDirection: "row", alignItems: "center", gap: 13 }, profileText: { flex: 1, minWidth: 0 }, name: { fontSize: 18, fontWeight: "800", marginBottom: 3 }, section: { fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: 27, marginBottom: 10 }, card: { borderRadius: 20, paddingHorizontal: 15 }, row: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: StyleSheet.hairlineWidth }, rowText: { flex: 1, minWidth: 0 }, device: { minHeight: 72, borderRadius: 17, padding: 13, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }, revoke: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 }, logout: { marginTop: 30 } });

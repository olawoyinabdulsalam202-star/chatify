import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import Constants, { ExecutionEnvironment } from "expo-constants";
import AppScreen from "../../components/AppScreen";
import ActionButton from "../../components/ActionButton";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import LoadingView from "../../components/LoadingView";
import { api, API_ORIGIN } from "../../lib/api";
import { FONT_CATEGORIES, FONTS, getNativeFontFamily, loadFont } from "../../lib/fonts";
import { isExpoGo, registerPushDevice, unregisterPushDevice } from "../../lib/push";
import { useTheme } from "../../lib/theme";
import { useAuthStore } from "../../stores/useAuthStore";
import { useAppStore } from "../../stores/useAppStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TITLES = { account: "Account", privacy: "Privacy", chats: "Chats", notifications: "Notifications", help: "Help", devices: "Linked devices" };
const DISAPPEAR_OPTIONS = [{ value: 0, label: "Off" }, { value: 86400, label: "24 hours" }, { value: 604800, label: "7 days" }, { value: 7776000, label: "90 days" }];
const FONT_SIZES = [{ value: "small", label: "Small", multiplier: 0.9 }, { value: "medium", label: "Medium", multiplier: 1 }, { value: "large", label: "Large", multiplier: 1.16 }];
const COLOR_SWATCHES = ["#FAF7F2", "#FFFFFF", "#FCA5A5", "#FDBA74", "#FDE047", "#86EFAC", "#67E8F9", "#93C5FD", "#C4B5FD", "#F9A8D4", "#D6D3D1", "#A8A29E"];
const USERNAME_COOLDOWN = 7 * 24 * 60 * 60 * 1000;

function PageHeader({ title }) {
  const router = useRouter(); const theme = useTheme();
  return <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable><Text allowFontScaling style={[styles.heading, { color: theme.text, fontFamily: theme.fontFamily, fontSize: 23 * theme.fontScale }]}>{title}</Text></View>;
}

function Card({ children, style }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

function Field({ title, helper, children }) {
  const theme = useTheme();
  return <View style={styles.field}><Text allowFontScaling style={[styles.label, { color: theme.text, fontFamily: theme.fontFamily, fontSize: 14 * theme.fontScale }]}>{title}</Text>{helper ? <Text allowFontScaling style={[styles.helper, { color: theme.muted, fontFamily: theme.fontFamily, fontSize: 12 * theme.fontScale }]}>{helper}</Text> : null}{children}</View>;
}

function ToggleRow({ title, value, onValueChange, description }) {
  const theme = useTheme();
  return <View style={styles.toggleRow}><View style={styles.grow}><Text allowFontScaling style={[styles.label, { color: theme.text, fontFamily: theme.fontFamily, fontSize: 14 * theme.fontScale }]}>{title}</Text>{description ? <Text allowFontScaling style={[styles.helper, { color: theme.muted, fontFamily: theme.fontFamily, fontSize: 12 * theme.fontScale }]}>{description}</Text> : null}</View><Switch value={value} onValueChange={onValueChange} trackColor={{ false: theme.elevated, true: theme.primary }} thumbColor="#FFFFFF" /></View>;
}

function TextBox({ value, onChangeText, placeholder, multiline = false, keyboardType, maxLength, autoCapitalize = "sentences", style }) {
  const theme = useTheme();
  return <TextInput allowFontScaling value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.muted} multiline={multiline} keyboardType={keyboardType} maxLength={maxLength} autoCapitalize={autoCapitalize} autoCorrect={false} style={[styles.textbox, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, fontFamily: theme.fontFamily, fontSize: 14 * theme.fontScale }, multiline && styles.multiline, style]} />;
}

function Notice({ message, error = false }) {
  const theme = useTheme();
  if (!message) return null;
  return <Text accessibilityRole={error ? "alert" : undefined} style={[styles.notice, { color: error ? theme.danger : theme.success }]}>{message}</Text>;
}

export default function SettingsSection() {
  const { section: rawSection } = useLocalSearchParams();
  const section = String(rawSection || "");
  const router = useRouter();
  const theme = useTheme();
  const user = useAuthStore((state) => state.authUser);
  const sessionId = useAuthStore((state) => state.sessionId);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const soundEnabled = useAppStore((state) => state.soundEnabled);
  const setSoundEnabled = useAppStore((state) => state.setSoundEnabled);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [username, setUsername] = useState(user?.username || "");
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameChangedAt, setUsernameChangedAt] = useState(user?.usernameChangedAt || null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [showLastSeen, setShowLastSeen] = useState(user?.showLastSeen !== false);
  const [disappearEnabled, setDisappearEnabled] = useState(Boolean(user?.settings?.disappearingMessages?.enabled));
  const [disappearDuration, setDisappearDuration] = useState(Number(user?.settings?.disappearingMessages?.duration) || 86400);
  const [awayMessage, setAwayMessage] = useState(user?.settings?.awayMessage || "");

  const [selectedTheme, setSelectedTheme] = useState(user?.settings?.theme || "dark");
  const [fontSize, setFontSize] = useState(user?.settings?.fontSize || "medium");
  const [fontFamily, setFontFamily] = useState(user?.settings?.fontFamily || "sans");
  const [fontColor, setFontColor] = useState(user?.settings?.fontColor || "");
  const [fontLoading, setFontLoading] = useState(false);
  const savedChatsRef = useRef({ theme: user?.settings?.theme || "dark", fontSize: user?.settings?.fontSize || "medium", fontFamily: user?.settings?.fontFamily || "sans", fontColor: user?.settings?.fontColor || "" });

  const [pushPermission, setPushPermission] = useState("unknown");
  const [pushCanAskAgain, setPushCanAskAgain] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushTestBusy, setPushTestBusy] = useState(false);
  const [pushDiagnostic, setPushDiagnostic] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    if (section !== "account") return;
    let active = true;
    api("/auth/check").then((result) => {
      if (!active) return;
      updateUser(result);
      setUsername(result.username || "");
      setUsernameChangedAt(result.usernameChangedAt || null);
    }).catch(() => {});
    return () => { active = false; };
  }, [section]);

  useEffect(() => {
    if (section === "notifications") {
      let active = true;
      const refreshPermission = async () => {
        if (isExpoGo()) { if (active) setPushPermission("unsupported"); return; }
        const permission = await Notifications.getPermissionsAsync();
        if (active) { setPushPermission(permission.status); setPushCanAskAgain(permission.canAskAgain !== false); }
      };
      (async () => {
        await refreshPermission();
        const stored = await AsyncStorage.getItem("havn.notificationsEnabled").catch(() => null);
        if (active) setPushEnabled(stored === "true" && (await Notifications.getPermissionsAsync()).status === "granted");
      })();
      const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refreshPermission(); });
      return () => { active = false; subscription.remove(); };
    }
    return undefined;
  }, [section]);

  useEffect(() => {
    if (section !== "help") return undefined;
    let active = true;
    api("/push/config").then((result) => { if (active) setPushDiagnostic({ enabled: !!result.enabled, hasKey: Boolean(result.publicKey) }); })
      .catch((err) => { if (active) setPushDiagnostic({ error: err.message }); });
    return () => { active = false; };
  }, [section]);

  useEffect(() => {
    if (section !== "devices") return undefined;
    let active = true;
    setSessionsLoading(true);
    api("/auth/sessions").then((result) => { if (active) setSessions(Array.isArray(result) ? result : []); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setSessionsLoading(false); });
    return () => { active = false; };
  }, [section]);

  useEffect(() => {
    if (section !== "chats") return undefined;
    let active = true;
    setFontLoading(true);
    loadFont(fontFamily).finally(() => { if (active) setFontLoading(false); });
    return () => { active = false; };
  }, [section, fontFamily]);

  useEffect(() => {
    if (section !== "chats") return undefined;
    return () => {
      const current = useAuthStore.getState().authUser;
      if (current) updateUser({ settings: { ...current.settings, ...savedChatsRef.current } });
    };
  }, [section]);

  const cooldownRemaining = useMemo(() => {
    if (!usernameChangedAt) return 0;
    return USERNAME_COOLDOWN - (Date.now() - new Date(usernameChangedAt).getTime());
  }, [usernameChangedAt]);
  const usernameLocked = cooldownRemaining > 0;
  const daysUntilUnlock = Math.ceil(cooldownRemaining / 86400000);
  const patchSettingsLive = (fields) => updateUser({ settings: { ...(useAuthStore.getState().authUser?.settings || {}), ...fields } });
  const setLiveFontColor = (value) => {
    const next = value.slice(0, 7);
    setFontColor(next);
    patchSettingsLive({ fontColor: /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(next) ? next : "" });
  };
  const saveSettings = async (payload, successMessage) => {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await api("/auth/settings", { method: "PUT", body: payload });
      updateUser(result);
      if (section === "chats") savedChatsRef.current = { ...savedChatsRef.current, ...payload };
      setNotice(successMessage);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const saveUsername = async () => {
    const next = username.trim().toLowerCase();
    if (!next || next === user?.username) { setUsername(user?.username || ""); setEditingUsername(false); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await api("/auth/username", { method: "PUT", body: { username: next } });
      updateUser(result); setUsername(result.username); setUsernameChangedAt(result.usernameChangedAt || new Date().toISOString()); setEditingUsername(false); setNotice("Username updated.");
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const saveChats = () => {
    if (fontColor && !/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(fontColor)) {
      setError("Choose a valid message text color or reset it to default.");
      return;
    }
    saveSettings({ theme: selectedTheme, fontSize, fontFamily, fontColor }, "Chat settings saved.");
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError("Allow photo access to update your profile picture."); return; }
    const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, base64: true });
    const asset = selected.assets?.[0];
    if (selected.canceled || !asset?.base64) return;
    setPhotoBusy(true); setError(""); setNotice("");
    try {
      const result = await api("/auth/update-profile", { method: "PUT", body: { profilePic: `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` } });
      updateUser({ profilePic: result.profilePic }); setNotice("Profile photo updated.");
    } catch (err) { setError(err.message); }
    finally { setPhotoBusy(false); }
  };

  const enableNotifications = async () => {
    setPushBusy(true); setError(""); setNotice("");
    const result = await registerPushDevice();
    setPushBusy(false);
    if (result.ok) {
      setPushPermission("granted"); setPushEnabled(true); await AsyncStorage.setItem("havn.notificationsEnabled", "true").catch(() => {}); setNotice("Notifications enabled.");
    } else if (result.reason === "permission-denied") {
      const permission = await Notifications.getPermissionsAsync();
      setPushPermission("denied"); setPushCanAskAgain(permission.canAskAgain !== false);
      setError(permission.canAskAgain === false ? "Notifications are blocked. Enable them in Android system settings." : "Notification permission wasn't granted.");
    } else if (result.reason === "expo-go") {
      setPushPermission("unsupported"); setError("Notifications need the installed app. Expo Go does not support remote notifications.");
    } else setError(result.message || "Couldn't enable notifications. Please try again.");
  };
  const turnOffNotifications = async () => {
    await unregisterPushDevice(); setPushEnabled(false); await AsyncStorage.setItem("havn.notificationsEnabled", "false").catch(() => {}); setNotice("Notifications turned off for this device.");
  };
  const sendTestNotification = async () => {
    setPushTestBusy(true); setError(""); setNotice("");
    try { const result = await api("/push/test", { method: "POST" }); setNotice(result.message || "Test notification sent."); }
    catch (err) { setError(err.message); }
    finally { setPushTestBusy(false); }
  };

  const revokeDevice = (device) => Alert.alert("Sign out this device?", device.deviceName || device.platform || "Linked device", [
    { text: "Cancel", style: "cancel" },
    { text: "Revoke", style: "destructive", onPress: async () => {
      setError(""); setNotice("");
      try { await api(`/auth/sessions/${device._id}`, { method: "DELETE" }); setSessions((items) => items.filter((item) => item._id !== device._id)); setNotice("Device signed out."); }
      catch (err) { setError(err.message); }
    } },
  ]);
  const logOutAll = () => Alert.alert("Log out of all devices?", "This will sign out this phone and every linked device.", [
    { text: "Cancel", style: "cancel" },
    { text: "Log out all", style: "destructive", onPress: async () => {
      setSaving(true); setError("");
      try { await unregisterPushDevice(); await api("/auth/logout-all", { method: "POST" }); await clearSession(); router.replace("/login"); }
      catch (err) { setError(err.message); }
      finally { setSaving(false); }
    } },
  ]);
  const checkForUpdates = async () => {
    setCheckingUpdate(true); setUpdateInfo(null); setError(""); setNotice("");
    try {
      const data = await api("/app/version"); const current = Constants.expoConfig?.version || "1.0.0"; const latest = data.android?.latestVersion || current;
      const compare = (a, b) => { const x = String(a).split(".").map(Number); const y = String(b).split(".").map(Number); for (let i = 0; i < Math.max(x.length, y.length); i += 1) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
      if (compare(current, latest) >= 0) setNotice("You are up to date."); else setUpdateInfo(data.android);
    } catch (err) { setError(err.message); }
    finally { setCheckingUpdate(false); }
  };

  if (!TITLES[section]) { router.replace("/settings"); return null; }

  const renderAccount = () => {
    const photosDisabled = photoBusy;
    return <>
      <Card><View style={styles.photoRow}><Avatar uri={user?.profilePic} name={user?.fullName || user?.username} size={64} /><View style={styles.grow}><Text allowFontScaling style={[styles.label, { color: theme.text }]}>{user?.fullName || "Havn member"}</Text><Text allowFontScaling style={[styles.helper, { color: theme.muted }]}>Profile photo</Text></View><Pressable disabled={photosDisabled} onPress={choosePhoto} style={[styles.smallButton, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: "700" }}>{photoBusy ? "Saving" : "Edit photo"}</Text></Pressable></View></Card>
      <Card><Field title="Username" helper="Your @handle — how people find and add you. You can change it once every 7 days.">
        {editingUsername ? <><TextBox value={username} onChangeText={(value) => setUsername(value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))} maxLength={30} autoCapitalize="none" placeholder="ghostcode" style={{ paddingLeft: 35 }} /><Text style={[styles.helper, { color: theme.muted, marginTop: 8 }]}>3–30 characters: lowercase letters, numbers, dots and underscores.</Text><View style={styles.actions}><ActionButton title={saving ? "Saving" : "Save"} onPress={saveUsername} disabled={saving} style={styles.actionButton} /><ActionButton title="Cancel" secondary onPress={() => { setUsername(user?.username || ""); setEditingUsername(false); setError(""); }} style={styles.actionButton} /></View></> : <View style={styles.usernameRow}><Text style={{ color: theme.text }}>@{user?.username}</Text><Pressable accessibilityRole="button" disabled={usernameLocked} onPress={() => { setUsername(user?.username || ""); setEditingUsername(true); }}><Text style={{ color: usernameLocked ? theme.muted : theme.primary, fontWeight: "700" }}>Edit</Text></Pressable></View>}
      </Field>{usernameLocked && !editingUsername && <Text style={[styles.helper, { color: theme.muted, marginTop: 10 }]}>You can change it again in {daysUntilUnlock} day{daysUntilUnlock === 1 ? "" : "s"}.</Text>}</Card>
    </>;
  };

  const renderPrivacy = () => <>
    <Card>
      <ToggleRow title="Show last seen" description="Lets people see when you were last online. If you turn this off, you won't be able to see anyone else's either." value={showLastSeen} onValueChange={setShowLastSeen} />
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
      <ToggleRow title="Disappearing messages" description="New messages you send will be marked for auto-removal after this duration." value={disappearEnabled} onValueChange={(value) => { setDisappearEnabled(value); setDisappearDuration(value ? disappearDuration || 86400 : 0); }} />
      <View style={styles.chipWrap}>{DISAPPEAR_OPTIONS.map((option) => { const selected = option.value === 0 ? !disappearEnabled : disappearEnabled && disappearDuration === option.value; return <Pressable key={option.value} onPress={() => { if (option.value === 0) { setDisappearEnabled(false); setDisappearDuration(0); } else { setDisappearEnabled(true); setDisappearDuration(option.value); } }} style={[styles.chip, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary + "18" : theme.background }]}><Text style={{ color: selected ? theme.primary : theme.muted, fontWeight: "600" }}>{option.label}</Text></Pressable>; })}</View>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
      <Field title="Away message" helper="Shown to people who message you (optional)."><TextBox value={awayMessage} onChangeText={setAwayMessage} maxLength={200} multiline placeholder="e.g. I'll reply after 6pm" /></Field>
    </Card>
    <ActionButton title={saving ? "Saving" : "Save privacy"} busy={saving} onPress={() => saveSettings({ showLastSeen, awayMessage, disappearingMessages: { enabled: disappearEnabled, duration: disappearDuration } }, "Privacy settings saved.")} />
  </>;

  const renderChats = () => <>
    <Card><Field title="Theme" helper="Applies instantly so you can see it. Press Save to keep it."><View style={styles.twoColumns}>{[{ value: "dark", label: "Dark", color: "#141311" }, { value: "light", label: "Light", color: "#FAF7F2" }].map((item) => <Pressable key={item.value} onPress={() => { setSelectedTheme(item.value); patchSettingsLive({ theme: item.value }); }} style={[styles.themeCard, { borderColor: selectedTheme === item.value ? theme.primary : theme.border, backgroundColor: item.color }]}><View style={[styles.themeDot, { backgroundColor: item.value === "dark" ? "#C2410C" : "#C2410C" }]} /><Text style={{ color: item.value === "dark" ? "#EEE7DD" : "#3A332B", fontWeight: "700" }}>{item.label}</Text><View style={[styles.themeLine, { backgroundColor: item.value === "dark" ? "#39332D" : "#E0D7CB" }]} /></Pressable>)}</View></Field>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
      <Field title="Font size"><View style={styles.chipWrap}>{FONT_SIZES.map((item) => <Pressable key={item.value} onPress={() => { setFontSize(item.value); patchSettingsLive({ fontSize: item.value }); }} style={[styles.chip, { borderColor: fontSize === item.value ? theme.primary : theme.border, backgroundColor: fontSize === item.value ? theme.primary + "18" : theme.background }]}><Text style={{ color: fontSize === item.value ? theme.primary : theme.muted, fontSize: 13 * item.multiplier }}>{item.label}</Text></Pressable>)}</View></Field>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
      <Field title="Font" helper={`${FONTS.length} fonts. Only the one you pick gets downloaded.`}>
        <Text style={[styles.previewLine, { color: theme.text, borderColor: theme.border, fontFamily: getNativeFontFamily(fontFamily) }]}>The quick brown fox jumps over the lazy dog{"\n"}0123456789 — Sphinx of black quartz, judge my vow.</Text>
        {fontLoading && <Text style={[styles.helper, { color: theme.muted, marginTop: 7 }]}>Loading font…</Text>}
        {FONT_CATEGORIES.map((category) => <View key={category.key} style={styles.fontCategory}><Text style={[styles.categoryTitle, { color: theme.muted }]}>{category.label}</Text>{FONTS.filter((font) => font.category === category.key).map((font) => <Pressable key={font.id} onPress={async () => { setFontFamily(font.id); patchSettingsLive({ fontFamily: font.id }); setFontLoading(true); const loaded = await loadFont(font.id); setFontLoading(false); if (!loaded && font.google) setError(`Couldn't load ${font.label}. The app will use the system font.`); else setError(""); }} style={[styles.fontChoice, { borderBottomColor: theme.border, backgroundColor: fontFamily === font.id ? theme.primary + "12" : "transparent" }]}><Text style={[styles.fontName, { color: theme.text, fontFamily: getNativeFontFamily(font.id) }]}>{font.label}</Text><Text style={[styles.fontSample, { color: theme.muted, fontFamily: getNativeFontFamily(font.id) }]}>Aa 0123</Text></Pressable>)}</View>)}
      </Field>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
      <Field title="Message text color"><View style={styles.colorInputRow}><TextBox value={fontColor} onChangeText={setLiveFontColor} autoCapitalize="none" placeholder="#FAF7F2" style={styles.hexInput} /><Pressable onPress={() => setLiveFontColor("")}><Text style={{ color: theme.muted, fontSize: 12 }}>Reset to default</Text></Pressable></View><View style={styles.swatches}>{COLOR_SWATCHES.map((color) => <Pressable key={color} accessibilityLabel={`Set message color ${color}`} onPress={() => setLiveFontColor(color)} style={[styles.swatch, { backgroundColor: color, borderColor: fontColor.toLowerCase() === color.toLowerCase() ? theme.primary : theme.border }]} />)}</View><View style={[styles.previewBubble, { backgroundColor: theme.outgoing }]}><Text style={{ color: /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(fontColor) ? fontColor : theme.outgoingText, fontFamily: getNativeFontFamily(fontFamily), fontSize: 14 * (FONT_SIZES.find((item) => item.value === fontSize)?.multiplier || 1) }}>This is a message preview.</Text></View></Field>
    </Card>
    <ActionButton title={saving ? "Saving" : "Save chats"} busy={saving} onPress={saveChats} />
  </>;

  const renderNotifications = () => {
    const unsupported = pushPermission === "unsupported" || isExpoGo() || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    const blocked = pushPermission === "blocked" || (pushPermission === "denied" && !pushCanAskAgain);
    return <>
      <Card><Field title="Device notifications" helper="Get notified about new messages even when Havn is closed.">
        {unsupported ? <Text style={[styles.statusCard, { color: theme.muted, backgroundColor: theme.background, borderColor: theme.border }]}>Notifications need the installed app. Expo Go does not support remote notifications.</Text>
        : pushEnabled ? <View style={[styles.statusCard, styles.statusRow, { backgroundColor: theme.background, borderColor: theme.border }]}><Text style={{ color: theme.success, flex: 1 }}>Enabled on this device</Text><Pressable disabled={pushTestBusy} onPress={sendTestNotification}><Text style={{ color: theme.primary, fontWeight: "700" }}>{pushTestBusy ? "Sending…" : "Send test notification"}</Text></Pressable><Pressable onPress={turnOffNotifications}><Text style={{ color: theme.danger, marginLeft: 12 }}>Turn off</Text></Pressable></View>
        : blocked ? <View style={[styles.statusCard, { backgroundColor: theme.background, borderColor: theme.border }]}><Text style={{ color: theme.warning || "#B45309" }}>Notifications are blocked in Android system settings.</Text><Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 12 }}><Text style={{ color: theme.primary, fontWeight: "700" }}>Open system settings</Text></Pressable></View>
        : <ActionButton title={pushBusy ? "Enabling…" : "Enable notifications"} busy={pushBusy} onPress={enableNotifications} />}
      </Field><View style={[styles.separator, { backgroundColor: theme.border }]} /><ToggleRow title="Message sounds" description="Play a sound when a new message arrives." value={soundEnabled} onValueChange={(value) => setSoundEnabled(value)} /></Card>
      <Notice message={notice} /><Notice message={error} error />
    </>;
  };

  const renderHelp = () => {
    const version = Constants.expoConfig?.version || "1.0.0";
    const build = Constants.expoConfig?.android?.versionCode || Constants.nativeBuildVersion || "1";
    return <>
      <Card><Text style={[styles.cardTitle, { color: theme.text }]}>Havn</Text><Text style={[styles.helper, { color: theme.muted, marginTop: 4 }]}>Private messaging — direct chats, groups, calls and stories.</Text><Text selectable style={[styles.mono, { color: theme.muted }]}>version {version} (build {build})</Text></Card>
      <Card><Text style={[styles.cardTitle, { color: theme.text, marginBottom: 10 }]}>Diagnostics</Text><Text selectable style={[styles.mono, { color: theme.muted }]}>backend {API_ORIGIN}{"\n"}source {process.env.EXPO_PUBLIC_API_URL ? "EXPO_PUBLIC_API_URL" : "fallback (env not set)"}{"\n"}push/config {pushDiagnostic ? pushDiagnostic.error || `enabled=${String(pushDiagnostic.enabled)} · key=${pushDiagnostic.hasKey ? "present" : "missing"}` : "checking…"}</Text></Card>
      <Card style={{ paddingVertical: 0 }}>{[["Terms of Service", "terms"], ["Privacy Policy", "privacy"]].map(([title, key], index) => <Pressable key={key} onPress={() => router.push(`/settings/legal/${key}`)} style={[styles.linkRow, index === 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}><Text style={{ color: theme.text, flex: 1 }}>{title}</Text><Icon name="chevron" color={theme.muted} size={19} /></Pressable>)}</Card>
      <ActionButton title={checkingUpdate ? "Checking…" : "Check for updates"} busy={checkingUpdate} secondary onPress={checkForUpdates} />
      {updateInfo?.apkUrl ? <View style={[styles.updateCard, { backgroundColor: theme.surface }]}><Text style={{ color: theme.text, flex: 1 }}>Version {updateInfo.latestVersion} is available.</Text><Pressable onPress={() => Linking.openURL(updateInfo.apkUrl)}><Text style={{ color: theme.primary, fontWeight: "700" }}>Update</Text></Pressable></View> : null}
      <Notice message={notice} /><Notice message={error} error />
    </>;
  };

  const renderDevices = () => {
    const ordered = [...sessions].sort((a, b) => Number(Boolean(b.current || String(b._id) === String(sessionId))) - Number(Boolean(a.current || String(a._id) === String(sessionId))));
    return <>
      <ActionButton title="Link a device" secondary onPress={() => router.push("/link-device")} />
      {sessionsLoading ? <LoadingView label="Loading linked devices" /> : error ? <Notice message={error} error /> : ordered.length ? ordered.map((device) => {
        const current = Boolean(device.current || String(device._id) === String(sessionId));
        return <Card key={device._id} style={styles.deviceCard}><Icon name={device.platform === "android" ? "phone" : "monitor"} color={theme.primary} /><View style={styles.grow}><Text numberOfLines={1} style={[styles.deviceName, { color: theme.text }]}>{current ? "This device" : device.deviceName || device.platform || "Linked device"}</Text><Text numberOfLines={2} style={[styles.helper, { color: theme.muted }]}>Last active {device.lastUsedAt ? new Date(device.lastUsedAt).toLocaleString() : "recently"}</Text></View>{current ? <Text style={{ color: theme.success, fontWeight: "700", fontSize: 12 }}>This device</Text> : <Pressable onPress={() => revokeDevice(device)} style={styles.revoke}><Text style={{ color: theme.danger, fontWeight: "700" }}>Revoke</Text></Pressable>}</Card>;
      }) : <Text style={[styles.helper, { color: theme.muted }]}>No linked mobile devices.</Text>}
      <ActionButton title={saving ? "Logging out…" : "Log out of all devices"} busy={saving} secondary onPress={logOutAll} style={{ marginTop: 10, backgroundColor: theme.danger + "12", borderColor: theme.danger + "44" }} />
      <Notice message={notice} /><Notice message={error} error />
    </>;
  };

  let content;
  if (section === "account") content = renderAccount();
  else if (section === "privacy") content = renderPrivacy();
  else if (section === "chats") content = renderChats();
  else if (section === "notifications") content = renderNotifications();
  else if (section === "help") content = renderHelp();
  else content = renderDevices();

  return <AppScreen><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><PageHeader title={TITLES[section]} />{content}<Notice message={section !== "notifications" && section !== "help" && section !== "devices" ? notice : ""} /><Notice message={section !== "notifications" && section !== "help" && section !== "devices" ? error : ""} error /></ScrollView></AppScreen>;
}

const styles = StyleSheet.create({ content: { padding: 17, paddingBottom: 32, gap: 14 }, header: { flexDirection: "row", alignItems: "center", marginBottom: 2 }, back: { width: 44, height: 44, justifyContent: "center" }, heading: { fontSize: 23, fontWeight: "800", marginLeft: 3 }, card: { borderWidth: 1, borderRadius: 18, padding: 16 }, field: { gap: 7 }, label: { fontSize: 14, fontWeight: "600" }, helper: { fontSize: 12, lineHeight: 18 }, textbox: { minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }, multiline: { minHeight: 86, textAlignVertical: "top" }, notice: { fontSize: 13, lineHeight: 18, paddingHorizontal: 2 }, photoRow: { flexDirection: "row", alignItems: "center", gap: 12 }, grow: { flex: 1, minWidth: 0 }, smallButton: { minHeight: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" }, usernameRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, actions: { flexDirection: "row", gap: 8, marginTop: 5 }, actionButton: { flex: 1 }, separator: { height: StyleSheet.hairlineWidth, marginVertical: 15 }, toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 }, chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }, chip: { minHeight: 38, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" }, twoColumns: { flexDirection: "row", gap: 10 }, themeCard: { flex: 1, minHeight: 84, borderWidth: 2, borderRadius: 13, padding: 10, justifyContent: "space-between" }, themeDot: { width: 16, height: 16, borderRadius: 8 }, themeLine: { height: 5, width: "80%", borderRadius: 3 }, previewLine: { borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 14, lineHeight: 22 }, fontCategory: { marginTop: 16 }, categoryTitle: { fontSize: 12, fontWeight: "700", marginBottom: 5 }, fontChoice: { minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 }, fontName: { fontSize: 14 }, fontSample: { fontSize: 12 }, colorInputRow: { flexDirection: "row", alignItems: "center", gap: 10 }, hexInput: { width: 112, minHeight: 42 }, swatches: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 11 }, swatch: { width: 28, height: 28, borderRadius: 15, borderWidth: 2 }, previewBubble: { alignSelf: "flex-end", maxWidth: "88%", marginTop: 14, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 }, statusCard: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 19 }, statusRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }, cardTitle: { fontSize: 14, fontWeight: "700" }, mono: { fontFamily: "monospace", fontSize: 11, lineHeight: 18, marginTop: 11 }, linkRow: { minHeight: 54, flexDirection: "row", alignItems: "center" }, updateCard: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 13 }, deviceCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13 }, deviceName: { fontSize: 14, fontWeight: "700" }, revoke: { minHeight: 42, justifyContent: "center", paddingHorizontal: 8 } });

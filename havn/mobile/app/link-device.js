import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import ActionButton from "../components/ActionButton";
import Icon from "../components/Icon";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";

function qrCode(value) {
  return String(value || "").match(/(?:havn:\/\/qr\/|\/qr\/)([A-Za-z0-9_-]+)/)?.[1] || "";
}

export default function LinkDeviceScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const scan = async ({ data }) => {
    if (scanned || busy) return;
    const code = qrCode(data);
    if (!code) return;
    setScanned(true);
    setBusy(true);
    try {
      const info = await api(`/auth/qr/${encodeURIComponent(code)}/info`);
      Alert.alert(`Log in on ${info.browser || "Browser"}, ${info.operatingSystem || "device"}?`, info.city ? `From ${info.city}` : "Approve this web login?", [
        { text: "Cancel", style: "cancel", onPress: () => setScanned(false) },
        { text: "Approve", onPress: async () => {
          try { await api("/auth/qr/approve", { method: "POST", body: { code } }); Alert.alert("Device linked", "You can use Havn on the web now."); router.back(); }
          catch (error) { Alert.alert("Could not link device", error.message); setScanned(false); }
        } },
      ]);
    } catch (error) {
      Alert.alert("QR code unavailable", error.message, [{ text: "Scan again", onPress: () => setScanned(false) }]);
    } finally { setBusy(false); }
  };
  return <AppScreen style={{ padding: 18 }}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable><Text allowFontScaling style={[styles.title, { color: theme.text }]}>Link a device</Text></View>
    <Text allowFontScaling style={[styles.instruction, { color: theme.muted }]}>Scan the QR code shown on Havn Web to link this device.</Text>
    {permission?.granted ? <View style={styles.cameraWrap}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned ? undefined : scan} /></View> : <View style={[styles.permission, { backgroundColor: theme.surface }]}><Text allowFontScaling style={{ color: theme.text, textAlign: "center", lineHeight: 23 }}>Camera access is needed to scan a web login code.</Text><ActionButton title="Allow camera" onPress={requestPermission} style={{ marginTop: 16, alignSelf: "stretch" }} /></View>}
    {busy && <Text allowFontScaling style={{ color: theme.muted, textAlign: "center", padding: 14 }}>Checking code...</Text>}
  </AppScreen>;
}

const styles = StyleSheet.create({ header: { height: 48, flexDirection: "row", alignItems: "center", gap: 6 }, back: { width: 44, height: 44, justifyContent: "center" }, title: { fontSize: 23, fontWeight: "800" }, instruction: { fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 22 }, cameraWrap: { flex: 1, maxHeight: 480, borderRadius: 24, overflow: "hidden" }, camera: { flex: 1 }, permission: { flex: 1, maxHeight: 300, borderRadius: 24, padding: 22, justifyContent: "center" } });

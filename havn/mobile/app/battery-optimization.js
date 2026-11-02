import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import AppScreen from "../components/AppScreen";
import Icon from "../components/Icon";
import { useTheme } from "../lib/theme";
import { useCallStore } from "../stores/useCallStore";

const guidance = [
  ["tecno", "Open Phone Master, choose Battery Lab, then allow Havn to run in the background."],
  ["infinix", "Open Phone Master, choose Battery Lab or Power Marathon, then allow Havn to run in the background."],
  ["itel", "Open Phone Master or Power Manager and disable battery restrictions for Havn."],
  ["xiaomi", "Open App info, Battery saver, then choose No restrictions. Also allow Autostart if available."],
  ["oppo", "Open App info, Battery usage, then allow background activity and auto launch."],
  ["vivo", "Open iManager, App manager, then allow Havn to run in the background and start automatically."],
  ["samsung", "Open Battery, Background usage limits, then add Havn to Never sleeping apps."],
];

export default function BatteryOptimizationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const manufacturer = String(Device.manufacturer || "").toLowerCase();
  const instruction = guidance.find(([brand]) => manufacturer.includes(brand))?.[1] || "Allow Havn to run without battery restrictions so incoming calls can ring reliably.";
  const continueToCall = async () => {
    await AsyncStorage.setItem("havn.batteryPromptSeen", "1");
    const queued = useCallStore.getState().queuedCall;
    if (queued) {
      try {
        await useCallStore.getState().resumeQueuedCall();
      } catch (error) {
        router.back();
      }
    } else router.back();
  };
  const openBatterySettings = async () => {
    setOpening(true);
    try {
      if (Platform.OS === "android" && Linking.sendIntent) {
        await Linking.sendIntent("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", [{ key: "package", value: "com.kairosva.havn" }]);
      } else await Linking.openSettings();
    } catch { await Linking.openSettings().catch(() => {}); }
    finally { setOpening(false); }
  };
  return <AppScreen><ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Icon name="back" color={theme.text} /></Pressable>
    <View style={[styles.icon, { backgroundColor: theme.elevated }]}><Icon name="phone" color={theme.primary} size={32} /></View>
    <Text style={[styles.title, { color: theme.text, fontFamily: theme.fontFamily }]}>Keep calls ringing</Text>
    <Text style={[styles.copy, { color: theme.muted, fontFamily: theme.fontFamily }]}>Some phones stop apps in the background to save battery. Allow Havn to run without battery restrictions so incoming calls can reach you.</Text>
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.brand, { color: theme.text }]}>{Device.manufacturer || "Your device"}</Text><Text style={{ color: theme.muted, lineHeight: 22 }}>{instruction}</Text></View>
    <Pressable onPress={openBatterySettings} style={[styles.primary, { backgroundColor: theme.primary }]}><Text style={styles.primaryText}>{opening ? "Opening settings..." : "Open battery settings"}</Text></Pressable>
    <Pressable onPress={continueToCall} style={styles.skip}><Text style={{ color: theme.muted }}>Continue</Text></Pressable>
  </ScrollView></AppScreen>;
}

const styles = StyleSheet.create({ content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 }, back: { width: 44, height: 44, justifyContent: "center" }, icon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", alignSelf: "center" }, title: { textAlign: "center", fontSize: 26, fontWeight: "800" }, copy: { textAlign: "center", lineHeight: 22, fontSize: 15 }, card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8, marginTop: 8 }, brand: { fontSize: 15, fontWeight: "700" }, primary: { minHeight: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 8 }, primaryText: { color: "#FFFFFF", fontWeight: "700" }, skip: { minHeight: 44, alignItems: "center", justifyContent: "center" } });

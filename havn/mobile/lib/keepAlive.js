import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import notifee, { AndroidForegroundServiceType } from "@notifee/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showDialog } from "./dialog";
import { initNotificationChannels } from "./callNotifications";

const KEEP_ALIVE_KEY = "havn.keepAlive";
const EXPLAINED_KEY = "havn.keepAliveExplained";
const NOTIFICATION_ID = "havn-connection";
const nativeReady = Platform.OS === "android" && Constants.appOwnership !== "expo" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
let serviceRegistered = false;

function registerService() {
  if (!nativeReady || serviceRegistered) return;
  notifee.registerForegroundService(async () => new Promise(() => {}));
  serviceRegistered = true;
}

export async function startKeepAlive() {
  if (!nativeReady) return false;
  registerService();
  await initNotificationChannels();
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: "Havn",
    body: "Havn is connected",
    data: { kind: "connection" },
    android: {
      channelId: "connection",
      smallIcon: "notification_icon",
      color: "#C2410C",
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      ongoing: true,
      autoCancel: false,
      pressAction: { id: "default", launchActivity: "default" },
    },
  });
  return true;
}

export async function stopKeepAlive() {
  if (!nativeReady) return;
  try { await notifee.stopForegroundService(); } catch (error) {
    console.warn("Could not stop background connection service:", error.message);
  }
  await notifee.cancelNotification(NOTIFICATION_ID).catch(() => {});
}

export async function enableKeepAliveWithExplanation(openBatterySettings) {
  if (!nativeReady) return false;
  const explained = await AsyncStorage.getItem(EXPLAINED_KEY).catch(() => null);
  let choice = "Enable";
  if (explained !== "true") {
    choice = await showDialog(
      "Stay connected in background",
      "Havn keeps a quiet notification so people see you online, like WhatsApp. You can review battery restrictions in Battery settings.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Enable" },
        { text: "Battery settings", onPress: openBatterySettings },
      ]
    );
    await AsyncStorage.setItem(EXPLAINED_KEY, "true").catch(() => {});
    if (choice === "Not now" || !choice) {
      await AsyncStorage.setItem(KEEP_ALIVE_KEY, "false").catch(() => {});
      await stopKeepAlive();
      return false;
    }
  }
  await AsyncStorage.setItem(KEEP_ALIVE_KEY, "true").catch(() => {});
  return startKeepAlive();
}

export async function setKeepAliveEnabled(enabled) {
  await AsyncStorage.setItem(KEEP_ALIVE_KEY, enabled ? "true" : "false").catch(() => {});
  if (enabled) return startKeepAlive();
  await stopKeepAlive();
  return false;
}

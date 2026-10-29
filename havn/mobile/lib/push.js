import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

export function isExpoGo() {
  return Constants.appOwnership === "expo" || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export async function registerPushDevice() {
  if (Platform.OS !== "android") return { ok: false, reason: "android-only" };
  if (isExpoGo()) {
    console.info("Native push registration skipped: Expo Go does not provide Android remote push tokens.");
    return { ok: false, reason: "expo-go" };
  }
  if (!Device.isDevice) {
    console.info("Native push registration skipped: this is not a physical device.");
    return { ok: false, reason: "simulator" };
  }

  await Notifications.setNotificationChannelAsync("messages", {
    name: "Messages",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lightColor: "#C2410C",
  });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return { ok: false, reason: "permission-denied" };

  try {
    const pushToken = await Notifications.getDevicePushTokenAsync();
    if (pushToken.type !== "android" || !pushToken.data) return { ok: false, reason: "no-fcm-token" };
    await api("/push/device", {
      method: "POST",
      body: { fcmToken: pushToken.data, appVersion: Constants.expoConfig?.version || "1.0.0" },
    });
    return { ok: true };
  } catch (error) {
    console.warn("Native push registration failed:", error.message);
    return { ok: false, reason: "registration-failed", message: error.message };
  }
}

export async function unregisterPushDevice() {
  try {
    await api("/push/device", { method: "DELETE" });
  } catch (error) {
    console.warn("Push token removal failed:", error.message);
  }
}

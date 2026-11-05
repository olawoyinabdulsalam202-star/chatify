import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import messaging from "@react-native-firebase/messaging";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const ENABLED_KEY = "havn.notificationsEnabled";
const LAST_ATTEMPT_KEY = "havn.push.lastAttemptAt";
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000;

export function isExpoGo() {
  return Constants.appOwnership === "expo" || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function result(ok, reason, details = {}) {
  console.info(`Native push registration: ${reason}`);
  return { ok, reason, ...details };
}

async function postToken(token) {
  if (!token) return result(false, "no-fcm-token");
  await api("/push/device", {
    method: "POST",
    body: { fcmToken: token, appVersion: Constants.expoConfig?.version || "1.0.0" },
  });
  await AsyncStorage.setItem(LAST_ATTEMPT_KEY, String(Date.now())).catch(() => {});
  return result(true, "registered");
}

export async function registerPushToken(token) {
  try {
    const enabled = await AsyncStorage.getItem(ENABLED_KEY).catch(() => null);
    if (enabled === "false") return result(false, "disabled-by-user");
    if (Platform.OS !== "android") return result(false, "android-only");
    if (isExpoGo()) return result(false, "expo-go");
    if (!Device.isDevice) return result(false, "simulator");
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") return result(false, "permission-denied");
    return await postToken(token);
  } catch (error) {
    return result(false, "registration-failed", { message: error.message });
  }
}

export async function registerPushDevice({ force = false, requestPermission = true } = {}) {
  try {
    if (Platform.OS !== "android") return result(false, "android-only");
    if (isExpoGo()) return result(false, "expo-go");
    if (!Device.isDevice) return result(false, "simulator");
    const enabled = await AsyncStorage.getItem(ENABLED_KEY).catch(() => null);
    if (enabled === "false") return result(false, "disabled-by-user");

    if (!force) {
      const lastAttemptAt = Number(await AsyncStorage.getItem(LAST_ATTEMPT_KEY).catch(() => 0));
      if (lastAttemptAt && Date.now() - lastAttemptAt < REFRESH_INTERVAL) return result(true, "recently-registered");
    }

    await AsyncStorage.setItem(LAST_ATTEMPT_KEY, String(Date.now())).catch(() => {});

    await Notifications.setNotificationChannelAsync("messages-v2", {
      name: "Messages",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 250, 200, 250],
      enableLights: true,
      lightColor: "#C2410C",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted" && requestPermission) permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return result(false, "permission-denied");
    if (enabled === null) await AsyncStorage.setItem(ENABLED_KEY, "true").catch(() => {});

    let token = "";
    try { token = await messaging().getToken(); } catch {}
    if (token) return await postToken(token);

    try {
      const fallback = await Notifications.getDevicePushTokenAsync();
      if (fallback.type === "android" && fallback.data) return await postToken(fallback.data);
    } catch {}
    return result(false, "no-fcm-token");
  } catch (error) {
    return result(false, "registration-failed", { message: error.message });
  }
}

export async function unregisterPushDevice() {
  try {
    await api("/push/device", { method: "DELETE" });
  } catch (error) {
    console.warn("Push token removal failed:", error.message);
  }
}

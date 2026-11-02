import messaging from "@react-native-firebase/messaging";
import notifee, { AndroidCategory, AndroidImportance, AndroidVisibility, EventType } from "@notifee/react-native";
import { Linking } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";

const CALL_CHANNEL = "incoming-calls";
const nativeMessagingReady = Constants.appOwnership !== "expo" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

async function showIncomingCall(data = {}) {
  await notifee.createChannel({
    id: CALL_CHANNEL,
    name: "Incoming calls",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    vibrationPattern: [0, 900, 500, 900],
  });
  await notifee.displayNotification({
    id: `call-${data.callId || "incoming"}`,
    title: data.senderName || "Incoming call",
    body: `${data.callType === "video" ? "Video" : "Voice"} call`,
    data,
    android: {
      channelId: CALL_CHANNEL,
      category: AndroidCategory.CALL,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      ongoing: true,
      autoCancel: false,
      timeoutAfter: 30_000,
      largeIcon: data.avatarUrl || undefined,
      fullScreenAction: { id: "default", launchActivity: "default" },
      pressAction: { id: "default", launchActivity: "default" },
      actions: [
        { title: "Answer", pressAction: { id: "answer-call", launchActivity: "default" } },
        { title: "Decline", pressAction: { id: "decline-call", launchActivity: "default" } },
      ],
    },
  });
}

async function showMessage(data = {}) {
  await notifee.createChannel({ id: "messages", name: "Messages", importance: AndroidImportance.HIGH, sound: "default", vibration: true });
  await notifee.displayNotification({
    id: data.tag || `message-${data.chatId || Date.now()}`,
    title: data.senderName || "Havn",
    body: data.body || "New message",
    data,
    android: { channelId: "messages", importance: AndroidImportance.HIGH, pressAction: { id: "default", launchActivity: "default" }, largeIcon: data.avatarUrl || undefined },
  });
}

function openNotificationDestination(data, actionId) {
  const path = data.kind === "call"
    ? actionId === "answer-call" ? "call?answer=1" : "call"
    : data.chatId ? `${data.kind === "group" ? "group" : "chat"}/${data.chatId}` : "";
  if (path) Linking.openURL(`havn:///${path}`).catch(() => {});
}

async function handleNativeMessage(message) {
  const data = message.data || {};
  if (data.kind === "call") await showIncomingCall(data);
  else if (data.kind === "callCancelled") await notifee.cancelNotification(`call-${data.callId || "incoming"}`);
  else if (data.kind === "dm" || data.kind === "group") await showMessage(data);
}

if (nativeMessagingReady) {
  messaging().setBackgroundMessageHandler(async (message) => {
    await handleNativeMessage(message);
  });
  messaging().onMessage(async (message) => {
    await handleNativeMessage(message);
  });
}

async function handleNotifeeEvent({ type, detail }) {
  const data = detail.notification?.data || {};
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === "decline-call") {
    await notifee.cancelNotification(detail.notification.id);
    if (data.callerId) Linking.openURL(`havn:///call?decline=${encodeURIComponent(data.callerId)}`).catch(() => {});
  } else if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    openNotificationDestination(data, detail.pressAction?.id);
  }
}

if (nativeMessagingReady) {
  notifee.onBackgroundEvent(handleNotifeeEvent);
  notifee.onForegroundEvent(handleNotifeeEvent);
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    openNotificationDestination(data, response.actionIdentifier);
  });
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) openNotificationDestination(response.notification.request.content.data || {}, response.actionIdentifier);
  }).catch(() => {});
}

export async function dismissIncomingCall(callId) {
  if (callId) await notifee.cancelNotification(`call-${callId}`);
  else await notifee.cancelAllNotifications();
}

export { showIncomingCall };

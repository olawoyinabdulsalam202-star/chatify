import messaging from "@react-native-firebase/messaging";
import notifee, { AndroidCategory, AndroidGroupAlertBehavior, AndroidImportance, AndroidStyle, AndroidVisibility, EventType } from "@notifee/react-native";
import { Linking } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { isNotificationTargetOpen } from "./notificationState";

const CALL_CHANNEL = "calls";
export const nativeMessagingReady = Constants.appOwnership !== "expo" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

async function createNotificationChannels() {
  await Promise.all([
    notifee.createChannel({ id: "messages", name: "Messages", importance: AndroidImportance.HIGH, sound: "default", vibration: true }),
    notifee.createChannel({ id: "status", name: "Status", importance: AndroidImportance.DEFAULT, sound: "default", vibration: true }),
    notifee.createChannel({ id: "social", name: "Friends and reactions", importance: AndroidImportance.DEFAULT, sound: "default", vibration: true }),
    notifee.createChannel({ id: CALL_CHANNEL, name: "Calls", importance: AndroidImportance.HIGH, sound: "default", vibration: true }),
  ]);
}

if (nativeMessagingReady) createNotificationChannels().catch((error) => console.warn("Notification channels could not be created:", error.message));

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

function notificationChannel(kind) {
  if (["status", "status-new"].includes(kind)) return "status";
  if (["friend", "reaction"].includes(kind)) return "social";
  if (kind === "call") return CALL_CHANNEL;
  return "messages";
}

async function showMessage(data = {}) {
  await createNotificationChannels();
  const groupChatId = data.groupId || (data.kind === "group" ? data.chatId : "");
  const groupId = groupChatId ? `havn-group-${groupChatId}` : undefined;
  const id = data.kind === "group" ? `group-message-${data.messageId || Date.now()}` : data.tag || `notification-${data.chatId || Date.now()}`;
  await notifee.displayNotification({
    id,
    title: data.title || data.senderName || "Havn",
    body: data.body || "New message",
    data,
    android: { channelId: notificationChannel(data.kind), importance: notificationChannel(data.kind) === "messages" ? AndroidImportance.HIGH : AndroidImportance.DEFAULT, pressAction: { id: "default", launchActivity: "default" }, largeIcon: data.avatarUrl || undefined, ...(groupId ? { groupId, groupAlertBehavior: AndroidGroupAlertBehavior.SUMMARY } : {}) },
  });
  if (groupId) {
    const displayed = await notifee.getDisplayedNotifications();
    const groupNotifications = displayed.filter((item) => item.notification.android?.groupId === groupId && !item.notification.android?.groupSummary);
    if (groupNotifications.length >= 3) {
      const lines = groupNotifications.slice(-5).map((item) => item.notification.body || "New message");
      await notifee.displayNotification({
        id: `${groupId}-summary`,
        title: data.title || "Group messages",
        body: `${groupNotifications.length} new messages`,
        data: { ...data, groupId: String(groupChatId) },
        android: { channelId: "messages", groupId, groupSummary: true, groupAlertBehavior: AndroidGroupAlertBehavior.SUMMARY, style: { type: AndroidStyle.INBOX, title: data.title || "Group messages", summary: `${groupNotifications.length} new messages`, lines }, pressAction: { id: "default", launchActivity: "default" } },
      });
    }
  }
}

function openNotificationDestination(data, actionId) {
  const groupId = data.groupId || (data.kind === "group" || data.kind === "group-added" || (data.kind === "reaction" && data.targetType === "group") ? data.chatId : "");
  const path = data.kind === "call"
    ? actionId === "answer-call" ? "call?answer=1" : "call"
    : ["status", "status-new"].includes(data.kind)
      ? `?statusAuthor=${encodeURIComponent(data.authorId || data.senderId || "")}&story=${encodeURIComponent(data.storyId || data.chatId || "")}`
      : data.kind === "friend"
        ? data.chatId ? `chat/${encodeURIComponent(data.chatId)}` : ""
        : groupId
          ? `group/${encodeURIComponent(groupId)}`
          : data.chatId ? `chat/${encodeURIComponent(data.chatId)}` : "";
  if (path) Linking.openURL(`havn:///${path}`).catch(() => {});
}

async function handleNativeMessage(message) {
  const data = message.data || {};
  if (data.kind === "call") await showIncomingCall(data);
  else if (data.kind === "callCancelled") await notifee.cancelNotification(`call-${data.callId || "incoming"}`);
  else if (["dm", "status-reply", "group", "group-added", "status", "status-new", "friend", "reaction"].includes(data.kind)) {
    if (!isNotificationTargetOpen(data)) await showMessage(data);
  }
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

export async function clearChatNotifications(chatId) {
  if (!nativeMessagingReady || !chatId) return;
  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all(displayed.filter((item) => String(item.notification.data?.chatId || item.notification.data?.groupId) === String(chatId)).map((item) => notifee.cancelDisplayedNotification(item.id)));
  } catch (error) {
    console.warn("Could not clear chat notifications:", error.message);
  }
}

export { showIncomingCall };

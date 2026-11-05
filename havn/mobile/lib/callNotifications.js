import messaging from "@react-native-firebase/messaging";
import notifee, { AndroidCategory, AndroidGroupAlertBehavior, AndroidImportance, AndroidStyle, AndroidVisibility, EventType } from "@notifee/react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { isNotificationTargetOpen } from "./notificationState";
import { push as navigate, queueForLogin } from "./navigation";

const CALL_CHANNEL = "calls";
const handledNotificationIds = new Set();
export const nativeMessagingReady = Constants.appOwnership !== "expo" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

function notificationId(data, id) {
  const stableId = data.callId || data.messageId || (data.kind === "status-new" && data.storyId) || data.tag || data.storyId || data.notificationId || id;
  return String(stableId || `${data.kind || "notification"}:${data.chatId || ""}:${data.createdAt || data.sentAt || "unknown"}`);
}

function markHandled(data, id) {
  const key = notificationId(data, id);
  if (handledNotificationIds.has(key)) return false;
  handledNotificationIds.add(key);
  if (handledNotificationIds.size > 500) handledNotificationIds.delete(handledNotificationIds.values().next().value);
  return true;
}

export function getNotificationDestination(data = {}, actionId) {
  const chatId = data.chatId || data.senderId || "";
  const groupId = data.groupId || (["group", "group-added"].includes(data.kind) || (data.kind === "reaction" && data.targetType === "group") ? chatId : "");
  if (data.kind === "call") {
    if (actionId === "decline-call") return data.callerId ? `/call?decline=${encodeURIComponent(data.callerId)}` : "/call";
    return actionId === "answer-call" ? "/call?answer=1" : "/call";
  }
  if (["status", "status-new"].includes(data.kind)) {
    const authorId = data.authorId || data.senderId || "";
    const storyId = data.storyId || (data.kind === "status" ? data.chatId : "") || "";
    return `/?statusAuthor=${encodeURIComponent(authorId)}&story=${encodeURIComponent(storyId)}`;
  }
  if (["group", "group-added"].includes(data.kind) || (data.kind === "reaction" && data.targetType === "group")) {
    return groupId ? `/group/${encodeURIComponent(groupId)}` : null;
  }
  if (["dm", "status-reply", "reaction", "friend"].includes(data.kind)) {
    return chatId ? `/chat/${encodeURIComponent(chatId)}` : null;
  }
  return null;
}

export function completeNotificationNavigation(data = {}) {
  const groupId = data.groupId || (["group", "group-added"].includes(data.kind) || (data.kind === "reaction" && data.targetType === "group") ? data.chatId : "");
  const chatId = groupId ? "" : data.chatId || (data.kind === "friend" ? data.senderId : "");
  if (groupId) {
    import("../stores/useGroupStore").then(({ useGroupStore }) => useGroupStore.getState().clearUnread(groupId));
    clearChatNotifications(groupId);
  } else if (chatId) {
    import("../stores/useChatStore").then(({ useChatStore }) => useChatStore.getState().clearUnread(chatId));
    clearChatNotifications(chatId);
  }
}

export async function consumeInitialNotification() {
  if (!nativeMessagingReady) return null;
  try {
    const initial = await notifee.getInitialNotification();
    if (!initial) return null;
    const data = initial.notification?.data || {};
    const actionId = initial.pressAction?.id || "default";
    const id = notificationId(data, initial.notification?.id);
    if (!markHandled(data, id)) return null;
    return { data, actionId, id };
  } catch (error) {
    console.warn("Initial notification could not be read:", error.message);
    return null;
  }
}

async function createNotificationChannels() {
  await notifee.deleteChannel("messages").catch(() => {});
  await Promise.all([
    notifee.createChannel({ id: "messages-v2", name: "Messages", importance: AndroidImportance.HIGH, sound: "default", vibration: true, vibrationPattern: [0, 250, 200, 250], lights: true, lightColor: "#C2410C", visibility: AndroidVisibility.PRIVATE }),
    notifee.createChannel({ id: "status", name: "Status", importance: AndroidImportance.DEFAULT, sound: "default", vibration: true, lights: true, lightColor: "#C2410C", visibility: AndroidVisibility.PRIVATE }),
    notifee.createChannel({ id: "social", name: "Friends and reactions", importance: AndroidImportance.DEFAULT, sound: "default", vibration: true, lights: true, lightColor: "#C2410C", visibility: AndroidVisibility.PRIVATE }),
    notifee.createChannel({ id: CALL_CHANNEL, name: "Calls", importance: AndroidImportance.HIGH, sound: "default", vibration: true }),
  ]);
}

if (nativeMessagingReady) createNotificationChannels().catch((error) => console.warn("Notification channels could not be created:", error.message));

async function showIncomingCall(data = {}) {
  await notifee.createChannel({ id: CALL_CHANNEL, name: "Incoming calls", importance: AndroidImportance.HIGH, sound: "default", vibration: true, vibrationPattern: [0, 900, 500, 900] });
  await notifee.displayNotification({
    id: `call-${data.callId || "incoming"}`,
    title: data.senderName || "Incoming call",
    body: `${data.callType === "video" ? "Video" : "Voice"} call`,
    data,
    android: {
      channelId: CALL_CHANNEL,
      smallIcon: "notification_icon",
      color: "#C2410C",
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
  return "messages-v2";
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
    android: { channelId: notificationChannel(data.kind), smallIcon: "notification_icon", color: "#C2410C", importance: notificationChannel(data.kind) === "messages" ? AndroidImportance.HIGH : AndroidImportance.DEFAULT, pressAction: { id: "default", launchActivity: "default" }, largeIcon: data.avatarUrl || undefined, ...(groupId ? { groupId, groupAlertBehavior: AndroidGroupAlertBehavior.SUMMARY } : {}) },
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
        android: { channelId: "messages-v2", smallIcon: "notification_icon", color: "#C2410C", groupId, groupSummary: true, groupAlertBehavior: AndroidGroupAlertBehavior.SUMMARY, style: { type: AndroidStyle.INBOX, title: data.title || "Group messages", summary: `${groupNotifications.length} new messages`, lines }, pressAction: { id: "default", launchActivity: "default" } },
      });
    }
  }
}

function openNotificationDestination(data, actionId, id) {
  if (!markHandled(data, id)) return;
  const path = getNotificationDestination(data, actionId);
  if (!path) return;
  const onNavigated = () => completeNotificationNavigation(data);
  import("../stores/useAuthStore").then(({ useAuthStore }) => {
    if (!useAuthStore.getState().authUser) queueForLogin(path, onNavigated);
    else navigate(path, onNavigated);
  });
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
  messaging().setBackgroundMessageHandler(handleNativeMessage);
  messaging().onMessage(handleNativeMessage);
}

async function handleNotifeeEvent({ type, detail }) {
  if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
  const data = detail.notification?.data || {};
  if (detail.pressAction?.id === "decline-call") await notifee.cancelNotification(detail.notification.id);
  openNotificationDestination(data, detail.pressAction?.id, detail.notification?.id);
}

if (nativeMessagingReady) {
  notifee.onBackgroundEvent(handleNotifeeEvent);
  notifee.onForegroundEvent(handleNotifeeEvent);
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    openNotificationDestination(data, response.actionIdentifier, response.notification.request.identifier);
  });
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const data = response.notification.request.content.data || {};
    openNotificationDestination(data, response.actionIdentifier, response.notification.request.identifier);
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

import { axiosInstance } from "./axios";

// Registers this device for Web Push, which is what delivers a notification
// when the app is closed. A socket event can't do that — it needs a live tab.
//
// The flow: ask the browser for permission -> subscribe against the server's
// VAPID public key -> hand the resulting endpoint to the backend so it can push
// to this device later.

// VAPID keys travel as base64url but the subscribe API wants raw bytes.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function notificationPermission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

// Subscribes this device. Must be called from a user gesture on iOS, which
// refuses the permission prompt otherwise.
export async function enablePushNotifications() {
  if (!pushSupported()) {
    return { ok: false, reason: "unsupported" };
  }

  // iOS only allows push for an installed PWA, never from a Safari tab. Saying
  // so is far better than a prompt that silently does nothing.
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isIos && !isStandalone) {
    return { ok: false, reason: "ios-needs-install" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: permission === "denied" ? "denied" : "dismissed" };
  }

  try {
    // Fetch the key from the server rather than a build-time env var, so
    // rotating it doesn't require a frontend rebuild to stay in sync.
    const { data: config } = await axiosInstance.get("/push/config");
    if (!config.enabled || !config.publicKey) {
      return { ok: false, reason: "server-not-configured" };
    }

    const registration = await navigator.serviceWorker.ready;

    // Reuse an existing subscription when there is one; re-subscribing with a
    // different key throws, so an old subscription has to go first.
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const existingKey = subscription.options?.applicationServerKey;
      const wanted = urlBase64ToUint8Array(config.publicKey);
      const same =
        existingKey && new Uint8Array(existingKey).toString() === wanted.toString();
      if (!same) {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        // Required to be true by every browser: silent push isn't allowed.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
    }

    const raw = subscription.toJSON();
    await axiosInstance.post("/push/subscribe", {
      endpoint: raw.endpoint,
      keys: raw.keys,
    });

    return { ok: true };
  } catch (error) {
    console.error("Push subscribe failed:", error);
    return { ok: false, reason: "error" };
  }
}

export async function disablePushNotifications() {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // Tell the server first — once unsubscribed locally the endpoint is gone
    // and the row would be orphaned until its next failed send.
    await axiosInstance
      .post("/push/unsubscribe", { endpoint: subscription.endpoint })
      .catch(() => {});
    await subscription.unsubscribe();
  } catch (error) {
    console.log("Push unsubscribe failed:", error.message);
  }
}

// Re-registers an existing grant on startup. Permission persists across visits,
// but the subscription row can be missing server-side (database reset, a
// pruned-then-revived endpoint), so this keeps them in step without prompting.
export async function syncPushSubscription() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const raw = subscription.toJSON();
    await axiosInstance.post("/push/subscribe", { endpoint: raw.endpoint, keys: raw.keys });
  } catch {
    // Non-critical: the user can always re-enable from Settings.
  }
}

// --- App icon badge -------------------------------------------------------

export function setAppBadge(count) {
  if ("setAppBadge" in navigator) {
    if (count > 0) navigator.setAppBadge(count).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  }
  // Keep the service worker's counter in step, since it owns the badge while
  // the app is closed.
  navigator.serviceWorker?.controller?.postMessage(
    count > 0 ? { type: "SET_BADGE", count } : { type: "CLEAR_BADGE" }
  );
}

export function clearAppBadge() {
  setAppBadge(0);
}

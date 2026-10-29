import { ENV } from "./env.js";
import PushSubscription from "../modules/PushSubscription.js";
import PushDevice from "../modules/PushDevice.js";

// Web Push delivers a notification to a device even when the app is closed —
// that's the whole point of it over a socket event, which only works while a tab
// is open. The service worker receives it and calls showNotification().
//
// VAPID keys identify this server to the push services (FCM, Mozilla, Apple).
// They're a keypair, generated once, and the public half is handed to the
// browser at subscribe time. Without them configured, push is simply disabled —
// the app still works, it just won't notify a closed device.
let configured = false;
let webpush = null;
let firebaseAdmin = null;
let fcmInitializationAttempted = false;

// `web-push` is loaded dynamically, and a missing module is treated exactly like
// missing VAPID keys: push turns itself off and everything else keeps working.
//
// A static `import webpush from "web-push"` would make the dependency mandatory
// — server.js imports the push route, so one absent package would crash the
// entire API on boot with a module-not-found error. Notifications are an
// enhancement; they must never be able to take messaging down with them.
export async function initPush() {
  await initFcm();
  if (!ENV.VAPID_PUBLIC_KEY || !ENV.VAPID_PRIVATE_KEY) {
    console.warn(
      "Web Push disabled: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set. " +
        "Generate a pair with `npx web-push generate-vapid-keys` and add them to your env."
    );
    return false;
  }

  try {
    const mod = await import("web-push");
    webpush = mod.default || mod;
    webpush.setVapidDetails(
      // Must be a mailto: or https: URL identifying the sender. Push services
      // reject the request outright if this is malformed.
      ENV.VAPID_SUBJECT || "mailto:admin@chatify.app",
      ENV.VAPID_PUBLIC_KEY,
      ENV.VAPID_PRIVATE_KEY
    );
    configured = true;
    // Full fingerprint, not just "enabled": the single most common failure is
    // the browser subscribing with a DIFFERENT public key than the server signs
    // with (frontend and backend envs drifted apart). Printing the public key
    // here means the boot log and the frontend's VITE_VAPID_PUBLIC_KEY can be
    // compared character-for-character instead of guessing.
    console.log(
      `Web Push enabled. VAPID public key: ${ENV.VAPID_PUBLIC_KEY.slice(0, 24)}…`
    );
    return true;
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND") {
      console.warn(
        "Web Push disabled: the 'web-push' package isn't installed. " +
          "Run `npm install web-push` in backend/ to enable device notifications."
      );
    } else {
      console.warn("Web Push disabled — invalid VAPID configuration:", error.message);
    }
    return false;
  }
}

async function initFcm() {
  if (fcmInitializationAttempted) return firebaseAdmin;
  fcmInitializationAttempted = true;
  if (!ENV.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.warn("FCM disabled: FIREBASE_SERVICE_ACCOUNT_BASE64 is not set.");
    return null;
  }
  try {
    const mod = await import("firebase-admin");
    firebaseAdmin = mod.default || mod;
    if (!firebaseAdmin.apps?.length) {
      const serviceAccount = JSON.parse(Buffer.from(ENV.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
      firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(serviceAccount) });
    }
    console.log("FCM enabled.");
    return firebaseAdmin;
  } catch (error) {
    console.warn("FCM disabled: could not initialize Firebase Admin:", error.message);
    return null;
  }
}

export function isPushConfigured() {
  return configured;
}

// Sends one notification to every device a user has registered.
//
// Never throws and never rejects: a notification failing must not break the
// message send that triggered it. Callers fire-and-forget this.
export async function sendPushToUser(userId, payload) {
  // A message can arrive immediately after boot, before the dynamic web-push
  // import in server.js has completed. Wait once here instead of dropping that
  // first notification.
  if (!configured) await initPush();
  if (!userId) {
    // Silence here was the problem: a missing package, missing keys, or a
    // never-subscribed device all produced exactly nothing in the logs, so
    // "no notification arrived" was impossible to diagnose from the server.
    const reason = "missing user id";
    console.log(`Push skipped: ${reason}`);
    return { sent: 0, skipped: reason };
  }

  try {
    let sent = 0;
    let pruned = 0;
    let failed = 0;
    let subs = [];
    if (configured && webpush) {
      subs = await PushSubscription.find({ userId });
      const body = JSON.stringify(payload);
      await Promise.all(subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            },
            body,
            // TTL: how long the push service should keep trying if the device is
            // offline. A day is plenty for a chat message; beyond that the
            // notification is stale and unwelcome.
            { TTL: 86400, urgency: "high" }
          );
          sent += 1;
        } catch (error) {
          // 404/410 mean the browser threw the subscription away (permission
          // revoked, PWA uninstalled, cache cleared). Those are dead forever, so
          // prune them — otherwise every later send retries them and the
          // collection grows without bound.
          if (error.statusCode === 404 || error.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
            pruned += 1;
          } else {
            failed += 1;
            // 401/403 almost always means the VAPID keys the subscription was
            // created with don't match the ones signing now — the usual cause is
            // the frontend and backend holding different public keys, or keys
            // being rotated without users re-subscribing.
            console.log(
              `Push send failed (${error.statusCode || "?"}):`,
              error.body || error.message
            );
          }
        }
      }));
    } else {
      console.log(`Web push skipped for ${userId}: ${configured ? "web-push transport unavailable" : "VAPID is not configured"}`);
    }

    const devices = await PushDevice.find({ userId }).select("_id fcmToken").lean();
    const admin = devices.length ? await initFcm() : null;
    let fcmSent = 0;
    let fcmPruned = 0;
    if (admin && devices.length) {
      const sender = payload.senderName || payload.title || "Havn";
      const data = Object.fromEntries(Object.entries({
        senderName: sender,
        avatarUrl: payload.avatarUrl || payload.icon || "",
        body: payload.body || "New message",
        chatId: payload.chatId || payload.groupId || payload.senderId || "",
        kind: payload.kind || "dm",
        tag: payload.tag || "havn-message",
      }).map(([key, value]) => [key, String(value)]));
      const call = payload.kind === "call";
      await Promise.all(devices.map(async (device) => {
        try {
          await admin.messaging().send({
            token: device.fcmToken,
            data,
            android: { priority: "high", ttl: call ? 30_000 : 86_400_000 },
          });
          fcmSent += 1;
        } catch (error) {
          const code = error.code || "";
          if (["messaging/registration-token-not-registered", "messaging/invalid-argument"].includes(code)) {
            await PushDevice.deleteOne({ _id: device._id }).catch(() => {});
            fcmPruned += 1;
          } else {
            failed += 1;
            console.error(`FCM send failed for ${userId} (${code}):`, error.message);
          }
        }
      }));
    } else if (!devices.length) {
      console.log(`FCM push skipped for ${userId}: no Android device tokens.`);
    } else {
      console.log(`FCM push skipped for ${userId}: FCM is unavailable or not configured.`);
    }
    const totalSent = sent + fcmSent;
    if (!subs.length && !devices.length) console.log(`Push skipped for ${userId}: no subscribed web or Android devices.`);
    console.log(`Push to ${userId}: web=${sent}, fcm=${fcmSent}, pruned=${pruned + fcmPruned}, failed=${failed}`);
    return { sent: totalSent, webSent: sent, fcmSent, pruned: pruned + fcmPruned, failed, total: subs.length + devices.length };
  } catch (error) {
    console.log("sendPushToUser error:", error.message);
    return { sent: 0, failed: 1, error: error.message };
  }
}

// Truncates message text for a notification body. Long messages get cut so the
// OS doesn't do it mid-word, and media-only messages get a readable stand-in.
export function previewText(message) {
  if (message.isDeleted) return "Message deleted";
  if (message.viewOnce) return message.viewOnceIsVideo ? "Video message" : "Photo";
  if (message.text) {
    const trimmed = message.text.trim();
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  }
  if (message.image) return "Photo";
  if (message.video) return "Video";
  if (message.gif) return "GIF";
  if (message.sticker) return "Sticker";
  if (message.audio) return "Voice note";
  return "New message";
}

import PushSubscription from "../modules/PushSubscription.js";
import { ENV } from "../lib/env.js";
import { isPushConfigured, initPush, sendPushToUser } from "../lib/push.js";
import PushDevice from "../modules/PushDevice.js";

// The browser needs the server's VAPID public key before it can subscribe, and
// it must be the exact key this server signs with. Serving it from here (rather
// than baking it into the frontend build) means the two can never drift apart
// after a key rotation.
export const getPushConfig = async (_req, res) => {
  await initPush();
  res.status(200).json({
    enabled: isPushConfigured(),
    publicKey: ENV.VAPID_PUBLIC_KEY || null,
  });
};

export const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};

    if (!endpoint || typeof endpoint !== "string" || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid subscription." });
    }

    // Upsert on endpoint, not on user: re-subscribing in the same browser
    // returns the same endpoint, and inserting would leave duplicates that all
    // fire for one message. This also re-points an endpoint at the current user
    // when two accounts share a device, so the previous owner stops receiving
    // notifications meant for someone else.
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId: req.user._id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: (req.headers["user-agent"] || "").slice(0, 300),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: "Subscribed." });
  } catch (error) {
    console.log("Error in push subscribe:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ message: "Endpoint is required." });

    // Scoped to the calling user so one account can't delete another's device.
    await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    res.status(200).json({ message: "Unsubscribed." });
  } catch (error) {
    console.log("Error in push unsubscribe:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendTestPush = async (req, res) => {
  const result = await sendPushToUser(req.user._id, {
    title: "Havn notification test",
    body: "Notifications are working on this device.",
    url: "/settings/notifications",
    tag: "havn-push-test",
    senderName: "Havn",
    kind: "dm",
    chatId: "settings",
  });
  res.status(result?.sent ? 200 : 503).json({
    message: result?.sent ? "Test notification sent." : "No test notification was sent.",
    ...result,
  });
};

export const registerAndroidDevice = async (req, res) => {
  try {
    const { fcmToken, appVersion = "" } = req.body || {};
    if (!req.session) return res.status(400).json({ message: "A mobile device session is required." });
    if (typeof fcmToken !== "string" || fcmToken.length < 20 || fcmToken.length > 4096) return res.status(400).json({ message: "Invalid FCM token." });
    await PushDevice.findOneAndUpdate({ fcmToken }, {
      userId: req.user._id,
      sessionId: req.session._id,
      platform: "android",
      fcmToken,
      appVersion: String(appVersion).slice(0, 64),
      lastSeenAt: new Date(),
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.status(201).json({ message: "Android device registered." });
  } catch (error) {
    console.error("Android device registration failed:", error.message);
    res.status(500).json({ message: "Could not register Android device." });
  }
};

export const removeAndroidDevice = async (req, res) => {
  try {
    if (!req.session) return res.status(400).json({ message: "A mobile device session is required." });
    await PushDevice.deleteMany({ userId: req.user._id, sessionId: req.session._id });
    res.status(200).json({ message: "Android device removed." });
  } catch (error) {
    console.error("Android device removal failed:", error.message);
    res.status(500).json({ message: "Could not remove Android device." });
  }
};

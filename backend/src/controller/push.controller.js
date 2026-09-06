import PushSubscription from "../modules/PushSubscription.js";
import { ENV } from "../lib/env.js";
import { isPushConfigured } from "../lib/push.js";

// The browser needs the server's VAPID public key before it can subscribe, and
// it must be the exact key this server signs with. Serving it from here (rather
// than baking it into the frontend build) means the two can never drift apart
// after a key rotation.
export const getPushConfig = (_req, res) => {
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

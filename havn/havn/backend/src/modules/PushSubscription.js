import mongoose from "mongoose";

// One Web Push subscription = one browser/device a user has granted permission
// on. A single account can have several (phone, laptop, work machine), so this
// is a separate collection rather than a field on User.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // The push service URL for this device. Unique because re-subscribing on
    // the same browser returns the same endpoint, and we want that to update
    // the existing row rather than pile up duplicates that all fire at once.
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    // Purely diagnostic — helps identify a stale device in the DB.
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);

export default PushSubscription;

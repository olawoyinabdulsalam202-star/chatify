import mongoose from "mongoose";

const pushDeviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "DeviceSession", required: true, index: true },
  platform: { type: String, enum: ["android"], default: "android" },
  fcmToken: { type: String, required: true, unique: true },
  appVersion: { type: String, default: "", maxlength: 64 },
  createdAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
}, { versionKey: false });

const PushDevice = mongoose.model("PushDevice", pushDeviceSchema);
export default PushDevice;

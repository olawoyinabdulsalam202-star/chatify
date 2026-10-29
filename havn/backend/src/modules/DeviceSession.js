import mongoose from "mongoose";

const deviceSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  platform: { type: String, enum: ["web", "android"], required: true },
  deviceName: { type: String, default: "Unknown device", maxlength: 120 },
  userAgent: { type: String, default: "", maxlength: 500 },
  ip: { type: String, default: "", maxlength: 80 },
  lastUsedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null, index: true },
}, { versionKey: false });

const DeviceSession = mongoose.model("DeviceSession", deviceSessionSchema);
export default DeviceSession;

import mongoose from "mongoose";

const qrLoginSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, select: false },
  status: { type: String, enum: ["pending", "approved", "used"], default: "pending", index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  webDevice: {
    browser: { type: String, default: "Unknown browser" },
    operatingSystem: { type: String, default: "Unknown device" },
    ip: { type: String, default: "" },
    city: { type: String, default: "" },
  },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
}, { versionKey: false });

const QrLogin = mongoose.model("QrLogin", qrLoginSchema);
export default QrLogin;

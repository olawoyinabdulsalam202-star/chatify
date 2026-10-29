import crypto from "node:crypto";
import QrLogin from "../modules/QrLogin.js";
import User from "../modules/User.js";
import { generateToken } from "../lib/utils.js";
import { io } from "../lib/socket.js";

const QR_TTL = 2 * 60 * 1000;

function deviceInfo(req) {
  const agent = String(req.headers["user-agent"] || "");
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const operatingSystem = /Windows/.test(agent) ? "Windows" : /Mac OS/.test(agent) ? "macOS" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Linux/.test(agent) ? "Linux" : "Unknown device";
  return { browser, operatingSystem, ip: String(req.ip || ""), city: String(req.headers["x-vercel-ip-city"] || "") };
}

export async function startQrLogin(req, res) {
  try {
    const code = crypto.randomBytes(32).toString("base64url");
    await QrLogin.create({ code, webDevice: deviceInfo(req), expiresAt: new Date(Date.now() + QR_TTL) });
    res.status(201).json({ code });
  } catch (error) {
    console.error("QR login start failed:", error.message);
    res.status(500).json({ message: "Could not start QR login." });
  }
}

export async function getQrInfo(req, res) {
  try {
    const record = await QrLogin.findOne({ code: req.params.code, expiresAt: { $gt: new Date() } }).select("webDevice status").lean();
    if (!record || record.status !== "pending") return res.status(404).json({ message: "This QR code has expired." });
    res.status(200).json(record.webDevice);
  } catch (error) {
    console.error("QR login info failed:", error.message);
    res.status(500).json({ message: "Could not load QR login details." });
  }
}

export async function approveQrLogin(req, res) {
  const record = await QrLogin.findOneAndUpdate(
    { code: req.body?.code, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "approved", approvedBy: req.user._id } },
    { new: true }
  ).select("+code webDevice");
  if (!record) return res.status(404).json({ message: "This QR code has expired or was already used." });
  io.to(`qr:${record.code}`).emit("qrLoginApproved", { code: record.code });
  res.status(200).json({ webDevice: record.webDevice });
}

export async function pollQrLogin(req, res) {
  try {
    const now = new Date();
    const record = await QrLogin.findOneAndUpdate(
      { code: req.params.code, status: "approved", usedAt: null, expiresAt: { $gt: now } },
      { $set: { status: "used", usedAt: now } },
      { new: true }
    );
    if (record) {
      const user = await User.findById(record.approvedBy);
      if (!user || user.isBanned) {
        await QrLogin.deleteOne({ _id: record._id });
        return res.status(404).json({ message: "This QR login is unavailable." });
      }
      generateToken(user._id, res);
      await QrLogin.deleteOne({ _id: record._id });
      return res.status(200).json({ status: "approved", user: { _id: user._id, username: user.username, fullName: user.fullName, email: user.email, profilePic: user.profilePic, isAdmin: user.isAdmin, isBadged: user.isBadged, showLastSeen: user.showLastSeen, settings: user.settings } });
    }
    const pending = await QrLogin.findOne({ code: req.params.code, status: "pending", expiresAt: { $gt: now } }).select("_id").lean();
    if (pending) return res.status(200).json({ status: "pending" });
    return res.status(410).json({ status: "expired", message: "This QR code has expired." });
  } catch (error) {
    console.error("QR login status failed:", error.message);
    res.status(500).json({ message: "Could not check QR login." });
  }
}

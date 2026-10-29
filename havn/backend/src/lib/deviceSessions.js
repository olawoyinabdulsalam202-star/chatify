import crypto from "node:crypto";
import DeviceSession from "../modules/DeviceSession.js";

const SESSION_DAYS = 90;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const hashDeviceToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export function getBearerToken(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function createDeviceSession(req, userId) {
  const token = crypto.randomBytes(48).toString("base64url");
  const now = new Date();
  const platform = req.body?.platform === "web" ? "web" : "android";
  const deviceName = typeof req.body?.deviceName === "string"
    ? req.body.deviceName.trim().slice(0, 120)
    : "";
  const session = await DeviceSession.create({
    userId,
    tokenHash: hashDeviceToken(token),
    platform,
    deviceName: deviceName || (platform === "android" ? "Android device" : "Web browser"),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
    ip: String(req.ip || "").slice(0, 80),
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  return { token, session };
}

export async function findDeviceSession(token, { touch = true } = {}) {
  if (!token || typeof token !== "string") return null;
  const now = new Date();
  const session = await DeviceSession.findOne({
    tokenHash: hashDeviceToken(token),
    revokedAt: null,
    expiresAt: { $gt: now },
  }).select("+tokenHash");
  if (!session) return null;

  const recentCutoff = new Date(now.getTime() - TOUCH_INTERVAL_MS);
  if (touch && (!session.lastUsedAt || session.lastUsedAt <= recentCutoff)) {
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const result = await DeviceSession.updateOne(
      { _id: session._id, revokedAt: null, $or: [{ lastUsedAt: null }, { lastUsedAt: { $lte: recentCutoff } }] },
      { $set: { lastUsedAt: now, expiresAt } }
    );
    if (result.modifiedCount) {
      session.lastUsedAt = now;
      session.expiresAt = expiresAt;
    }
  }
  return session;
}

export async function bearerSessionFromRequest(req, options) {
  const token = getBearerToken(req);
  return token ? findDeviceSession(token, options) : null;
}

import express from "express";
import { ENV } from "../lib/env.js";

const router = express.Router();
router.get("/version", (_req, res) => res.status(200).json({ android: {
  latestVersion: ENV.APP_LATEST_VERSION,
  minVersion: ENV.APP_MIN_VERSION,
  apkUrl: ENV.APP_APK_URL,
  notes: ENV.APP_RELEASE_NOTES,
} }));
export default router;

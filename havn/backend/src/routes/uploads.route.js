import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { rateLimit } from "../lib/memoryRateLimit.js";
import cloudinary from "../lib/cloudinary.js";
import { ENV } from "../lib/env.js";

const router = express.Router();
router.post("/sign", protectRoute, rateLimit({ key: (req) => String(req.user._id), limit: 30, windowMs: 60_000 }), (req, res) => {
  const type = req.body?.type;
  if (!new Set(["image", "video", "audio"]).has(type)) return res.status(400).json({ message: "Upload type must be image, video, or audio." });
  if (!ENV.CLOUDINARY_API_SECRET || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_CLOUD_NAME) return res.status(503).json({ message: "Uploads are not configured." });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `havn/${req.user._id}`;
  const resourceType = type === "image" ? "image" : "video";
  const allowed_formats = type === "image" ? "jpg,jpeg,png,webp,gif" : type === "audio" ? "mp3,m4a,wav,ogg,aac" : "mp4,mov,webm,mkv";
  try {
    const eager = req.body?.eager;
    const eagerMatch = typeof eager === "string" ? eager.match(/^so_(\d+(?:\.\d+)?),eo_(\d+(?:\.\d+)?),vc_auto,(?:ac_none,)?q_auto(?::low)?,w_(?:480|720),f_mp4$/) : null;
    if (eager && (type !== "video" || typeof eager !== "string" || eager.length > 160 || !eagerMatch || Number(eagerMatch[1]) < 0 || Number(eagerMatch[2]) <= Number(eagerMatch[1]) || Number(eagerMatch[2]) - Number(eagerMatch[1]) > 30)) {
      return res.status(400).json({ message: "Video transformation is invalid." });
    }
    const eagerParams = eager ? { eager, eager_async: true } : {};
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder, allowed_formats, ...eagerParams }, ENV.CLOUDINARY_API_SECRET);
    const maxFileSize = type === "video" ? 100 * 1024 * 1024 : ENV.MAX_UPLOAD_FILE_SIZE;
    res.status(200).json({ timestamp, signature, apiKey: ENV.CLOUDINARY_API_KEY, cloudName: ENV.CLOUDINARY_CLOUD_NAME, folder, resourceType, maxFileSize, ...(eager ? { eager, eagerAsync: true } : {}) });
  } catch (error) {
    console.error("Upload signature failed:", error.message);
    res.status(500).json({ message: "Could not sign upload." });
  }
});
export default router;

import express from "express";
import User from "../modules/User.js";
import { rateLimit } from "../lib/memoryRateLimit.js";

const router = express.Router();
router.get("/u/:username", rateLimit({ key: (req) => req.ip, limit: 60, windowMs: 60_000 }), async (req, res) => {
  try {
    const escaped = req.params.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({ username: new RegExp("^" + escaped + "$", "i"), isBanned: { $ne: true } })
      .select("fullName username profilePic isBadged bio").lean();
    if (!user) return res.status(404).json({ message: "Profile not found." });
    res.status(200).json({ fullName: user.fullName, username: user.username, profilePic: user.profilePic || "", isBadged: !!user.isBadged, bio: user.bio || "" });
  } catch (error) {
    console.error("Public profile lookup failed:", error.message);
    res.status(500).json({ message: "Could not load profile." });
  }
});
export default router;

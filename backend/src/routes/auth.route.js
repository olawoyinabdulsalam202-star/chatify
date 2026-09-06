import express from "express";
import {
  signup,
  login,
  logout,
  updateProfile,
  updateUsername,
  updateSettings,
  verifyOTP,
  resendOTP,
} from "../controller/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";
import { ensureUserOnboarded } from "../lib/systemAccounts.js";

const router = express.Router();

router.use(arcjetProtection);

router.post("/signup", signup);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/login", login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/username", protectRoute, updateUsername);
router.put("/settings", protectRoute, updateSettings);

router.get("/check", protectRoute, (req, res) => {
  res.status(200).json(req.user);
  ensureUserOnboarded(req.user).catch((err) => console.log("Onboarding error:", err.message));
});

export default router;
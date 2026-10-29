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
  forgotPassword,
  resetPassword,
  listSessions,
  revokeSession,
  logoutAll,
} from "../controller/auth.controller.js";
import { startQrLogin, getQrInfo, approveQrLogin, pollQrLogin } from "../controller/qr.controller.js";
import { rateLimit } from "../lib/memoryRateLimit.js";
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
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/qr/start", rateLimit({ key: (req) => req.ip, limit: 10, windowMs: 60_000 }), startQrLogin);
router.get("/qr/:code/info", rateLimit({ key: (req) => req.ip, limit: 60, windowMs: 60_000 }), getQrInfo);
router.get("/qr/:code/status", rateLimit({ key: (req) => req.ip, limit: 60, windowMs: 60_000 }), pollQrLogin);
router.post("/qr/approve", protectRoute, approveQrLogin);
router.get("/sessions", protectRoute, listSessions);
router.delete("/sessions/:id", protectRoute, revokeSession);
router.post("/logout-all", protectRoute, logoutAll);

router.put("/update-profile", protectRoute, updateProfile);
router.put("/username", protectRoute, updateUsername);
router.put("/settings", protectRoute, updateSettings);

router.get("/check", protectRoute, (req, res) => {
  res.status(200).json(req.user);
  ensureUserOnboarded(req.user).catch((err) => console.log("Onboarding error:", err.message));
});

export default router;

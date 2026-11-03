import express from "express";
import { getNotificationSettings, updateNotificationSettings } from "../controller/settings.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);
router.get("/notifications", getNotificationSettings);
router.put("/notifications", updateNotificationSettings);

export default router;

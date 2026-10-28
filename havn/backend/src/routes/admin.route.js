import express from "express";
import {
  listUsers,
  banUser,
  unbanUser,
  deleteUser,
  setUserBadge,
  getAdminStats,
} from "../controller/admin.controller.js";
import { protectRoute, requireAdmin } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute, requireAdmin);

router.get("/stats", getAdminStats);
router.get("/users", listUsers);
router.put("/users/:id/ban", banUser);
router.put("/users/:id/unban", unbanUser);
router.delete("/users/:id", deleteUser);
router.put("/users/:id/badge", setUserBadge);

export default router;

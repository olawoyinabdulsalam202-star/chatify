import express from "express";
import {
  getFriendStatus,
  searchUsers,
  addFriendByUsername,
  removeFriend,
  blockUser,
  unblockUser,
} from "../controller/friend.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/status", getFriendStatus);
router.get("/search", searchUsers);
router.post("/add", addFriendByUsername);
router.post("/block/:id", blockUser);
router.post("/unblock/:id", unblockUser);
router.delete("/:id", removeFriend);

export default router;

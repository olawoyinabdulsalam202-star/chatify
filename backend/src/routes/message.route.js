import express from "express";
import {
  getAllContacts,
  getMessagesByUserId,
  getChatPartners,
  sendMessage,
  editMessage,
  deleteMessage,
  markMessagesAsSeen,
  toggleReaction,
  openViewOnce,
} from "../controller/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";


const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/contacts", getAllContacts);
router.get("/chats", getChatPartners);
router.get("/:id", getMessagesByUserId);
router.post("/send/:id", sendMessage);
router.put("/edit/:id", editMessage);
router.delete("/delete/:id", deleteMessage);
router.put("/seen/:id", markMessagesAsSeen);
router.put("/react/:id", toggleReaction);
router.post("/view-once/:id", openViewOnce);

export default router;
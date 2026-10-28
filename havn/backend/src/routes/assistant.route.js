import express from "express";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  deleteAssistantMessages,
  getAssistantMessages,
  postAssistantMessage,
} from "../controller/assistant.controller.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);
router.get("/messages", getAssistantMessages);
router.post("/messages", postAssistantMessage);
router.delete("/messages", deleteAssistantMessages);

export default router;

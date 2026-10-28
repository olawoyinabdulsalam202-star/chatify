import express from "express";
import {
  getMyStickers,
  createSticker,
  saveSticker,
  deleteSticker,
} from "../controller/sticker.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/", getMyStickers);
router.post("/", createSticker);
router.post("/save", saveSticker);
router.delete("/:id", deleteSticker);

export default router;

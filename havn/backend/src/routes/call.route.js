import express from "express";
import { getIceServers } from "../controller/call.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();
router.get("/ice-servers", protectRoute, getIceServers);
export default router;

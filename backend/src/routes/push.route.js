import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getPushConfig, subscribe, unsubscribe } from "../controller/push.controller.js";

const router = express.Router();

// Every route here needs a logged-in user: a subscription is stored against an
// account, and an anonymous one would have nobody to notify.
router.use(protectRoute);

router.get("/config", getPushConfig);
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);

export default router;

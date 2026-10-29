import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getPushConfig, subscribe, unsubscribe, sendTestPush, registerAndroidDevice, removeAndroidDevice } from "../controller/push.controller.js";

const router = express.Router();

// Every route here needs a logged-in user: a subscription is stored against an
// account, and an anonymous one would have nobody to notify.
router.use(protectRoute);

router.get("/config", getPushConfig);
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);
router.post("/test", sendTestPush);
router.post("/device", registerAndroidDevice);
router.delete("/device", removeAndroidDevice);

export default router;

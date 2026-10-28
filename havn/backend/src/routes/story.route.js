import express from "express";
import {
  createStory,
  updateStory,
  getStoriesFeed,
  getMyStories,
  viewStory,
  getStoryViewers,
  likeStory,
  deleteStory,
} from "../controller/story.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.post("/", createStory);
router.put("/:id", updateStory);
router.get("/feed", getStoriesFeed);
router.get("/mine", getMyStories);
router.post("/:id/view", viewStory);
router.get("/:id/viewers", getStoryViewers);
router.post("/:id/like", likeStory);
router.delete("/:id", deleteStory);

export default router;

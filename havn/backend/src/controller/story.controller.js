import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Story from "../modules/Story.js";
import User from "../modules/User.js";

export const createStory = async (req, res) => {
  try {
    const { image, video, text, backgroundColor } = req.body;
    const userId = req.user._id;

    if (!image && !video && !text) {
      return res.status(400).json({ message: "An image, video, or text is required." });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let videoUrl;
    if (video) {
      const uploadResponse = await cloudinary.uploader.upload(video, {
        resource_type: "video",
        // Statuses are meant to be quick — cap length so uploads/playback
        // stay snappy and storage doesn't balloon.
        eager: [{ duration: 30 }],
      });
      videoUrl = uploadResponse.secure_url;
    }

    const story = await Story.create({
      userId,
      image: imageUrl,
      video: videoUrl,
      text: text?.trim(),
      backgroundColor: backgroundColor || "#0891b2",
    });

    // Notify contacts who are online that a new story is up.
    io.emit("newStory", { userId, storyId: story._id });

    res.status(201).json(story);
  } catch (error) {
    console.log("Error in createStory controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Editing is only offered for text statuses — a photo/video status is a
// one-shot post like WhatsApp's, so those are delete-and-repost instead.
export const updateStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, backgroundColor } = req.body;

    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ message: "Story not found or expired." });
    if (!story.userId.equals(req.user._id)) {
      return res.status(403).json({ message: "You can only edit your own story." });
    }
    if (story.image || story.video) {
      return res.status(400).json({ message: "Photo and video stories can't be edited — delete and repost instead." });
    }
    if (!text?.trim()) {
      return res.status(400).json({ message: "Text is required." });
    }

    story.text = text.trim();
    if (backgroundColor) story.backgroundColor = backgroundColor;
    await story.save();

    io.emit("storyUpdated", story);
    res.status(200).json(story);
  } catch (error) {
    console.log("Error in updateStory controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Returns stories from everyone (excluding your own), grouped by author,
// newest first within each group. Expired stories are already gone thanks
// to the TTL index, so no need to filter here.
export const getStoriesFeed = async (req, res) => {
  try {
    const myId = req.user._id;

    const stories = await Story.find({ userId: { $ne: myId } })
      .sort({ createdAt: -1 })
      .populate("userId", "fullName profilePic isBadged");

    const grouped = {};
    stories.forEach((story) => {
      const authorId = story.userId._id.toString();
      if (!grouped[authorId]) {
        grouped[authorId] = { user: story.userId, stories: [] };
      }
      grouped[authorId].stories.push(story);
    });

    res.status(200).json(Object.values(grouped));
  } catch (error) {
    console.log("Error in getStoriesFeed controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMyStories = async (req, res) => {
  try {
    const stories = await Story.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(stories);
  } catch (error) {
    console.log("Error in getMyStories controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const viewStory = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user._id;

    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ message: "Story not found or expired." });
    if (!story.userId.equals(viewerId)) {
      const result = await Story.updateOne(
        { _id: id, "viewers.userId": { $ne: viewerId }, userId: { $ne: viewerId } },
        { $push: { viewers: { userId: viewerId, viewedAt: new Date() } } }
      );
      if (result.modifiedCount === 1) {
      const authorSocketId = getReceiverSocketId(story.userId);
      if (authorSocketId) {
        io.to(authorSocketId).emit("storyViewed", { storyId: story._id, viewerId });
      }
      }
    }

    res.status(200).json(await Story.findById(id));
  } catch (error) {
    console.log("Error in viewStory controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getStoryViewers = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id)
      .populate("viewers.userId", "fullName profilePic isBadged")
      .populate("likes.userId", "_id");
    if (!story) return res.status(404).json({ message: "Story not found or expired." });
    if (!story.userId.equals(req.user._id)) {
      return res.status(403).json({ message: "Only the author can see viewers." });
    }
    const uniqueViewers = new Map();
    story.viewers.forEach((viewer) => {
      const user = viewer.userId;
      if (!user) return;
      const key = String(user._id);
      const existing = uniqueViewers.get(key);
      if (!existing || new Date(viewer.viewedAt) < new Date(existing.viewedAt)) {
        uniqueViewers.set(key, { ...viewer.toObject(), liked: story.likes.some((like) => String(like.userId?._id) === key) });
      }
    });
    res.status(200).json({ viewers: [...uniqueViewers.values()], viewCount: uniqueViewers.size, likeCount: new Set(story.likes.map((like) => String(like.userId?._id)).filter(Boolean)).size });
  } catch (error) {
    console.log("Error in getStoryViewers controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const likeStory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ message: "Story not found or expired." });
    if (story.userId.equals(userId)) return res.status(403).json({ message: "You cannot like your own status." });

    const friendship = await User.exists({
      $or: [
        { _id: story.userId, friends: userId },
        { _id: userId, friends: story.userId },
      ],
    });
    if (!friendship) {
      return res.status(403).json({ message: "Only the author's contacts can like this status." });
    }

    const alreadyLiked = story.likes.some((like) => like.userId.equals(userId));
    let liked;
    if (alreadyLiked) {
      const result = await Story.updateOne({ _id: id, "likes.userId": userId }, { $pull: { likes: { userId } } });
      liked = result.modifiedCount === 0;
    } else {
      const result = await Story.updateOne({ _id: id, "likes.userId": { $ne: userId } }, { $addToSet: { likes: { userId, likedAt: new Date() } } });
      liked = result.modifiedCount === 1;
      if (liked) io.to(`user:${story.userId}`).emit("storyLiked", { storyId: id, likerId: String(userId) });
    }
    const updated = await Story.findById(id).select("likes");
    liked = updated.likes.some((like) => like.userId.equals(userId));
    const likeCount = new Set(updated.likes.map((like) => String(like.userId))).size;
    return res.status(200).json({ liked, likeCount });
  } catch (error) {
    console.log("Error in likeStory controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteStory = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id);
    if (!story) return res.status(404).json({ message: "Story not found or expired." });
    if (!story.userId.equals(req.user._id)) {
      return res.status(403).json({ message: "You can only delete your own story." });
    }

    await story.deleteOne();
    io.emit("storyDeleted", { storyId: id });

    res.status(200).json({ message: "Story deleted." });
  } catch (error) {
    console.log("Error in deleteStory controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

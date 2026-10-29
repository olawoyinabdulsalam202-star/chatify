import mongoose from "mongoose";
import AssistantMessage from "../modules/AssistantMessage.js";
import { ENV } from "../lib/env.js";
import { askAssistant } from "../lib/bot.js";

const inFlightUsers = new Set();
const minuteMs = 60 * 1000;

const toMessage = (message) => ({
  _id: message._id,
  role: message.role,
  text: message.text,
  createdAt: message.createdAt,
});

export const getAssistantMessages = async (req, res) => {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(rawLimit, 30)) : 30;
    const before = req.query.before;
    if (before && !mongoose.Types.ObjectId.isValid(before)) {
      return res.status(400).json({ message: "Invalid message cursor." });
    }

    const filter = { userId: req.user._id };
    if (before) filter._id = { $lt: before };

    const records = await AssistantMessage.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = records.length > limit;
    const messages = records.slice(0, limit).reverse().map(toMessage);
    res.status(200).json({ messages, hasMore });
  } catch (error) {
    console.error("Error loading assistant history:", error.message);
    res.status(500).json({ message: "Couldn't load assistant history." });
  }
};

export const postAssistantMessage = async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ message: "Write a message first." });
  if (text.length > 2000) return res.status(400).json({ message: "Messages can be up to 2000 characters." });

  const userId = req.user._id;
  const userKey = userId.toString();
  if (inFlightUsers.has(userKey)) {
    return res.status(429).json({ message: "A reply is already in progress. Please wait a moment." });
  }

  inFlightUsers.add(userKey);
  try {
    const now = new Date();
    const minuteStart = new Date(now.getTime() - minuteMs);
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);

    const [minuteCount, dailyCount] = await Promise.all([
      AssistantMessage.countDocuments({ userId, role: "user", createdAt: { $gte: minuteStart } }),
      AssistantMessage.countDocuments({ userId, role: "user", createdAt: { $gte: dayStart } }),
    ]);

    if (minuteCount >= ENV.ASSISTANT_RATE_PER_MIN) {
      return res.status(429).json({ message: "You've reached the one-minute message limit. Try again shortly." });
    }
    if (dailyCount >= ENV.ASSISTANT_DAILY_LIMIT) {
      return res.status(429).json({ message: "You've reached today's assistant message limit. Try again tomorrow." });
    }

    const userMessage = await AssistantMessage.create({ userId, role: "user", text });
    const previousMessages = await AssistantMessage.find({
      userId,
      _id: { $ne: userMessage._id },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(10)
      .lean();

    let answer;
    try {
      answer = await askAssistant({
        question: text,
        history: previousMessages.reverse().map(({ role, text: content }) => ({ role, content })),
        privateChat: true,
      });
    } catch (error) {
      await AssistantMessage.deleteOne({ _id: userMessage._id, userId }).catch((deleteError) => {
        console.error("Could not remove unanswered assistant message:", deleteError.message);
      });
      console.error("Private assistant request failed:", error.message);
      return res.status(502).json({ message: "Kairos couldn't reply. Please try again." });
    }

    const assistantMessage = await AssistantMessage.create({ userId, role: "assistant", text: answer });
    res.status(201).json({ userMessage: toMessage(userMessage), assistantMessage: toMessage(assistantMessage) });
  } catch (error) {
    console.error("Error sending assistant message:", error.message);
    res.status(500).json({ message: "Couldn't send your message." });
  } finally {
    inFlightUsers.delete(userKey);
  }
};

export const deleteAssistantMessages = async (req, res) => {
  try {
    await AssistantMessage.deleteMany({ userId: req.user._id });
    res.status(200).json({ message: "Assistant chat cleared." });
  } catch (error) {
    console.error("Error clearing assistant history:", error.message);
    res.status(500).json({ message: "Couldn't clear assistant chat." });
  }
};

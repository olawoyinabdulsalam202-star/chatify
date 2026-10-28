import User from "../modules/User.js";
import Message from "../modules/Message.js";
import { ENV } from "./env.js";
import { io } from "./socket.js";

let botUserId = null;

export const seedBotUser = async () => {
  try {
    let bot = await User.findOne({ isBot: true });
    if (!bot) {
      bot = await User.create({
        fullName: ENV.BOT_NAME,
        email: ENV.BOT_EMAIL,
        password: Math.random().toString(36).slice(2) + Date.now(),
        isVerified: true,
        isBot: true,
        isBadged: true,
        profilePic: "",
      });
      console.log(`Bot user seeded: ${bot.fullName} (${bot._id})`);
    } else if (bot.fullName !== ENV.BOT_NAME) {
      bot.fullName = ENV.BOT_NAME;
      await bot.save();
    }
    botUserId = bot._id;
    return bot;
  } catch (error) {
    console.log("Error seeding bot user:", error.message);
    return null;
  }
};

export const getBotUserId = () => botUserId;

export const askAssistant = async ({ question, groupName = null, history = [] }) => {
  if (!ENV.GROQ_API_KEY) {
    const error = new Error("The assistant is not configured on the server.");
    error.code = "AI_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ENV.BOT_MODEL,
      temperature: 0.5,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are ${ENV.BOT_NAME}, Havn's private AI assistant${groupName ? ` helping inside the group "${groupName}"` : ""}. Be concise, friendly, and practical. This answer is private to the person asking; do not claim to have taken actions you cannot take. Plain text only.`,
        },
        ...history,
        { role: "user", content: question },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`Groq request failed: status=${response.status}; response body=${await response.text()}`);
    const error = new Error("The assistant provider returned an error.");
    error.code = "AI_PROVIDER_ERROR";
    throw error;
  }

  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("The assistant returned an empty answer.");
  return answer;
};

export const maybeReplyToGroupMessage = async (group, message) => {
  try {
    if (!ENV.GROQ_API_KEY || group.type === "channel" || !group.botEnabled || !botUserId || !message.text) return;
    const escapedName = ENV.BOT_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mentionPattern = new RegExp(`@${escapedName}\\b`, "i");
    if (!mentionPattern.test(message.text)) return;

    io.to(`group:${group._id}`).emit("botTyping", { groupId: group._id.toString() });
    try {
      const recentMessages = await Message.find({ groupId: group._id })
        .sort({ createdAt: -1 }).limit(12).populate("senderId", "fullName");
      const history = recentMessages.reverse().filter((m) => !m.isDeleted && m.text).map((m) => ({
        role: m.senderId._id.equals(botUserId) ? "assistant" : "user",
        content: m.senderId._id.equals(botUserId) ? m.text : `${m.senderId.fullName}: ${m.text}`,
      }));
      const replyText = await askAssistant({ question: message.text, groupName: group.name, history: history.slice(0, -1) });
      const botMessage = await Message.create({ senderId: botUserId, groupId: group._id, text: replyText });
      const populated = await botMessage.populate("senderId", "fullName profilePic isBadged isBot");
      io.to(`group:${group._id}`).emit("newGroupMessage", populated);
    } finally {
      io.to(`group:${group._id}`).emit("botStopTyping", { groupId: group._id.toString() });
    }
  } catch (error) {
    console.log("Error in maybeReplyToGroupMessage:", error.message);
  }
};

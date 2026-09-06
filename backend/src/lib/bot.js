import User from "../modules/User.js";
import Message from "../modules/Message.js";
import { ENV } from "./env.js";
import { io } from "./socket.js";

let botUserId = null;

// Creates (once) or fetches the bot's User document. The bot is a real
// member record like any other user — that's what lets it post messages
// through the exact same Message model, reactions, replies, etc. — but it's
// flagged isBot so it's excluded from people search and can never be banned
// or picked as a normal contact.
export const seedBotUser = async () => {
  try {
    let bot = await User.findOne({ isBot: true });
    if (!bot) {
      bot = await User.create({
        fullName: ENV.BOT_NAME,
        email: ENV.BOT_EMAIL,
        password: Math.random().toString(36).slice(2) + Date.now(), // never used to log in
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

// Called after every group message is saved. Only responds in ordinary
// groups (never channels — channels stay pure broadcast, same as WhatsApp),
// and only when the bot is actually mentioned by name, so it doesn't spam
// every conversation.
export const maybeReplyToGroupMessage = async (group, message) => {
  try {
    if (!ENV.GROQ_API_KEY) return; // bot disabled until a key is configured
    if (group.type === "channel") return; // channels are broadcast-only, no bot
    if (!group.botEnabled) return; // this group's admins turned the bot off
    if (!botUserId || !group.isMember(botUserId)) return;
    if (!message.text) return;

    const mentionPattern = new RegExp(`@${ENV.BOT_NAME}`, "i");
    if (!mentionPattern.test(message.text)) return;

    // Let the group know the bot is "thinking" right away — the OpenRouter
    // call can take a few seconds, and a silent gap reads as broken rather
    // than slow. GroupChatHeader/GroupChatContainer render this the same
    // way as a human's typing indicator.
    io.to(`group:${group._id}`).emit("botTyping", { groupId: group._id.toString() });

    try {
      const recentMessages = await Message.find({ groupId: group._id })
        .sort({ createdAt: -1 })
        .limit(12)
        .populate("senderId", "fullName");

      const history = recentMessages
        .reverse()
        .filter((m) => !m.isDeleted && m.text)
        .map((m) => ({
          role: m.senderId._id.equals(botUserId) ? "assistant" : "user",
          content: m.senderId._id.equals(botUserId) ? m.text : `${m.senderId.fullName}: ${m.text}`,
        }));

      // xAI's API is OpenAI-schema compatible, so this is the same
      // request/response shape as before — just a different base URL and key.
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ENV.BOT_MODEL,
          messages: [
            {
              role: "system",
              content: `You are ${ENV.BOT_NAME}, a helpful assistant participating in a group chat called "${group.name}". Keep replies short, friendly, and conversational — a couple of sentences unless more detail is genuinely needed. Reply in plain text only: no markdown headers, no bullet asterisks, no code fences unless the person is asking for actual code.`,
            },
            ...history,
          ],
        }),
      });

      if (!response.ok) {
        console.log("Bot API error:", response.status, await response.text());
        return;
      }

      const data = await response.json();
      const replyText = data?.choices?.[0]?.message?.content?.trim();
      if (!replyText) return;

      const botMessage = await Message.create({
        senderId: botUserId,
        groupId: group._id,
        text: replyText,
      });
      const populated = await botMessage.populate("senderId", "fullName profilePic isBadged isBot");

      io.to(`group:${group._id}`).emit("newGroupMessage", populated);
    } finally {
      // Always clear the indicator — success, API error, or empty reply —
      // so it can never get stuck showing "Kairos is typing…" forever.
      io.to(`group:${group._id}`).emit("botStopTyping", { groupId: group._id.toString() });
    }
  } catch (error) {
    console.log("Error in maybeReplyToGroupMessage:", error.message);
  }
};

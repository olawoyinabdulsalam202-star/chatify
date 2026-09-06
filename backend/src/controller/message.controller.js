import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../modules/Message.js";
import User from "../modules/User.js";
import Group from "../modules/Group.js";
import { getBotUserId } from "../lib/bot.js";
import { PUBLIC_USER_FIELDS, shapeLastSeenMany } from "../lib/publicFields.js";
import { sendPushToUser, previewText } from "../lib/push.js";

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
      isBot: { $ne: true },
      isSystem: { $ne: true },
    }).select(PUBLIC_USER_FIELDS);

    // Apply the last-seen reciprocity rule per viewer.
    res.status(200).json(shapeLastSeenMany(filteredUsers, req.user));
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    if (!req.user.friends.some((f) => f.equals(userToChatId))) {
      return res.status(403).json({ message: "You can only message people you've added. Add them by their username first." });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    // View-once media is never returned through the history endpoint — only
    // through the one-time /view-once/:id open endpoint. Covers video as well
    // as photos, and strips regardless of the opened flag: once it's been
    // viewed the URL is already gone, and if it somehow isn't, history is still
    // the wrong place to hand it out.
    const sanitized = messages.map((m) => {
      if (!m.viewOnce) return m;
      const obj = m.toObject();
      obj.image = undefined;
      obj.video = undefined;
      return obj;
    });

    res.status(200).json(sanitized);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, video, videoDuration, gif, sticker, replyToId, audio, audioDuration, viewOnce } =
      req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!req.user.friends.some((f) => f.equals(receiverId))) {
      return res.status(403).json({ message: "You can only message people you've added. Add them by their username first." });
    }

    if (!text && !image && !video && !gif && !sticker && !audio) {
      return res.status(400).json({ message: "Text, image, video, gif, sticker, or audio is required." });
    }
    // View-once now covers video as well as photos (Telegram-style).
    if (viewOnce && !image && !video) {
      return res.status(400).json({ message: "View-once is only supported for photos and videos." });
    }
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    if (image) {
      // upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl;
    if (audio) {
      // Voice notes are uploaded as a "video" resource (cloudinary's bucket for
      // audio/video). MediaRecorder captures webm/opus, which Safari/iOS can't
      // decode — so the note played for the sender but was silent on the
      // receiver's side. format: "mp3" transcodes to a codec every browser
      // plays.
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "video",
        format: "mp3",
      });
      audioUrl = uploadResponse.secure_url;
    }

    let videoUrl;
    if (video) {
      const uploadResponse = await cloudinary.uploader.upload(video, {
        resource_type: "video",
        // Let Cloudinary pick codec/quality per client instead of serving the
        // raw phone capture, which is often 10x larger than it needs to be.
        eager: [{ quality: "auto", fetch_format: "auto" }],
      });
      videoUrl = uploadResponse.secure_url;
    }

    // Disappearing messages: if the sender has it enabled, stamp an
    // expiry so MongoDB's TTL index removes it automatically later.
    let expiresAt;
    const senderSettings = req.user.settings?.disappearingMessages;
    if (senderSettings?.enabled && senderSettings?.duration) {
      expiresAt = new Date(Date.now() + senderSettings.duration * 1000);
    }

    // Reply — snapshot the quoted message so it still shows even if the
    // original is edited/deleted later.
    let replyTo;
    if (replyToId) {
      const original = await Message.findById(replyToId);
      if (original) {
        replyTo = {
          messageId: original._id,
          senderId: original.senderId,
          text: original.isDeleted
            ? "This message was deleted"
            : original.text || (original.image ? "📷 Photo" : original.sticker ? "Sticker" : "GIF"),
        };
      }
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      video: videoUrl,
      videoDuration,
      gif, // gif is already a hosted URL (from Giphy/Tenor), no upload needed
      sticker, // sticker is a hosted URL too (uploaded at creation), no upload here
      audio: audioUrl,
      audioDuration,
      expiresAt,
      replyTo,
      viewOnce: !!viewOnce,
      viewOnceIsVideo: !!(viewOnce && videoUrl),
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      if (newMessage.viewOnce && (newMessage.image || newMessage.video)) {
        // Never ship the media URL alongside the notification of a view-once
        // message: the recipient has to call the open endpoint to get it, which
        // is what makes "once" enforceable.
        const redacted = newMessage.toObject();
        redacted.image = undefined;
        redacted.video = undefined;
        io.to(receiverSocketId).emit("newMessage", redacted);
      } else {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }
    }

    // Push to the recipient's devices so a closed app still notifies. Sent
    // regardless of socket state and de-duplicated on the client: the service
    // worker suppresses the notification if a visible window already has the
    // chat open, which is more reliable than guessing from the server whether
    // a socket means "actually looking at it".
    sendPushToUser(receiverId, {
      title: req.user.fullName,
      body: previewText(newMessage),
      tag: `dm-${senderId}`,
      url: "/",
      senderId: String(senderId),
      kind: "dm",
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// View-once reveal. Returns the media URL exactly once per eligible viewer.
//
// DMs and groups differ in when the media is destroyed, and that difference is
// the whole design:
//   DM    — one recipient, so the first open strips the URL immediately.
//   Group — "once each". Stripping on the first open would rob every other
//           member of a message they never saw, so each opener is recorded and
//           the media is destroyed only once everyone eligible has seen it.
export const openViewOnce = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found." });
    if (!message.viewOnce) return res.status(400).json({ message: "This message is not view-once." });

    // Capture before any stripping, for both branches.
    const imageUrl = message.image;
    const videoUrl = message.video;
    const duration = message.videoDuration;

    if (message.groupId) {
      const group = await Group.findById(message.groupId);
      if (!group) return res.status(404).json({ message: "Group not found." });
      if (!group.isMember(userId)) {
        return res.status(403).json({ message: "You are not a member of this group." });
      }
      // The sender already has it; letting them re-open would also count them
      // toward "everyone has seen it" and destroy it early for real viewers.
      if (message.senderId.equals(userId)) {
        return res.status(403).json({ message: "You sent this." });
      }
      if (message.viewOnceViewers?.some((v) => v.userId?.equals(userId))) {
        return res.status(410).json({ message: "You've already viewed this." });
      }
      if (!imageUrl && !videoUrl) {
        return res.status(410).json({ message: "This is no longer available." });
      }

      message.viewOnceViewers.push({ userId, openedAt: new Date() });

      // Once every eligible member has opened it, the media has served its
      // purpose — destroy it so it can't be recovered from the API or the DB.
      // The bot is excluded because it never opens anything and would otherwise
      // keep the media alive forever.
      const botId = getBotUserId();
      const eligible = group.members
        .map((m) => String(m.userId))
        .filter(
          (uid) => uid !== String(message.senderId) && (!botId || uid !== String(botId))
        );
      const seen = new Set(message.viewOnceViewers.map((v) => String(v.userId)));
      const everyoneSaw = eligible.length > 0 && eligible.every((uid) => seen.has(uid));

      if (everyoneSaw) {
        message.image = undefined;
        message.video = undefined;
        message.viewOnceOpened = true;
        message.viewOnceOpenedAt = new Date();
      }

      await message.save();

      // Tell the room so every member's copy updates its "N viewed" state, and
      // flips to "opened" for good once the media is gone.
      io.to(`group:${message.groupId}`).emit("viewOnceOpened", {
        messageId: message._id,
        groupId: message.groupId,
        viewerCount: message.viewOnceViewers.length,
        destroyed: everyoneSaw,
      });

      return res.status(200).json({
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        duration: duration || null,
        message,
      });
    }

    // --- DM ---
    if (!message.receiverId || !message.receiverId.equals(userId)) {
      return res.status(403).json({ message: "Only the recipient can open this." });
    }
    if (message.viewOnceOpened) {
      return res.status(410).json({ message: "This has already been viewed." });
    }

    // Strip the URLs before responding. This is the whole guarantee of
    // view-once: after this save the media is unreachable from the API and the
    // database for everyone, including the sender.
    message.image = undefined;
    message.video = undefined;
    message.viewOnceOpened = true;
    message.viewOnceOpenedAt = new Date();
    await message.save();

    const senderSocketId = getReceiverSocketId(message.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("viewOnceOpened", { messageId: message._id });
    }

    res.status(200).json({
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      duration: duration || null,
      message,
    });
  } catch (error) {
    console.log("Error in openViewOnce controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Message text is required." });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found." });
    if (!message.senderId.equals(userId)) {
      return res.status(403).json({ message: "You can only edit your own messages." });
    }
    if (message.isDeleted) {
      return res.status(400).json({ message: "Cannot edit a deleted message." });
    }

    message.text = text.trim();
    message.isEdited = true;
    await message.save();

    if (message.groupId) {
      await message.populate("senderId", "fullName profilePic isBadged isBot");
      io.to(`group:${message.groupId}`).emit("messageEdited", message);
    } else {
      const receiverSocketId = getReceiverSocketId(message.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageEdited", message);
      }
    }

    res.status(200).json(message);
  } catch (error) {
    console.log("Error in editMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found." });
    if (!message.senderId.equals(userId)) {
      return res.status(403).json({ message: "You can only delete your own messages." });
    }

    // "Delete for everyone": wipe the content, keep a tombstone so the thread
    // still shows "This message was deleted" instead of a confusing gap.
    message.text = "";
    message.image = undefined;
    message.gif = undefined;
    message.sticker = undefined;
    message.audio = undefined;
    message.isDeleted = true;
    await message.save();

    if (message.groupId) {
      await message.populate("senderId", "fullName profilePic isBadged isBot");
      io.to(`group:${message.groupId}`).emit("messageDeleted", message);
    } else {
      const receiverSocketId = getReceiverSocketId(message.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageDeleted", message);
      }
    }

    res.status(200).json(message);
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const toggleReaction = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) return res.status(400).json({ message: "Emoji is required." });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found." });

    const existingIndex = message.reactions.findIndex((r) => r.userId.equals(userId));

    if (existingIndex !== -1 && message.reactions[existingIndex].emoji === emoji) {
      // tapping the same emoji again removes it
      message.reactions.splice(existingIndex, 1);
    } else if (existingIndex !== -1) {
      // switch to a different emoji
      message.reactions[existingIndex].emoji = emoji;
    } else {
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    if (message.groupId) {
      await message.populate("senderId", "fullName profilePic isBadged isBot");
      io.to(`group:${message.groupId}`).emit("messageReaction", message);
    } else {
      const otherUserId = message.senderId.equals(userId) ? message.receiverId : message.senderId;
      const otherSocketId = getReceiverSocketId(otherUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit("messageReaction", message);
      }
    }

    res.status(200).json(message);
  } catch (error) {
    console.log("Error in toggleReaction controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsSeen = async (req, res) => {
  try {
    const { id: senderId } = req.params; // the OTHER user whose messages we're marking seen
    const myId = req.user._id;

    const result = await Message.updateMany(
      { senderId, receiverId: myId, status: { $ne: "seen" } },
      { status: "seen", seenAt: new Date() }
    );

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesSeen", { by: myId });
    }

    res.status(200).json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.log("Error in markMessagesAsSeen controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // find all the 1:1 DMs where the logged-in user is either sender or receiver
    // (group messages have no receiverId, so they must be excluded here).
    // Newest first so the partner list can be ordered by most-recent activity —
    // the first time a partner's id appears is their latest message.
    const messages = await Message.find({
      groupId: { $exists: false },
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    }).sort({ createdAt: -1 });

    // Set preserves insertion order, so iterating newest-first yields partner
    // ids already ordered by their most recent message.
    const chatPartnerIds = [
      ...new Set(
        messages
          .filter((msg) => msg.senderId && msg.receiverId)
          .map((msg) =>
            msg.senderId.toString() === loggedInUserId.toString()
              ? msg.receiverId.toString()
              : msg.senderId.toString()
          )
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
      isBot: { $ne: true },
      isSystem: { $ne: true },
    }).select(PUBLIC_USER_FIELDS);

    // $in returns documents in arbitrary order, so restore the recency order
    // computed above. Bots/system users filtered out by the query just fall out
    // of the map lookup. This is what makes a fresh message bump its sender to
    // the top of the sidebar, like a normal messaging app.
    const partnerById = new Map(chatPartners.map((u) => [u._id.toString(), u]));
    const orderedPartners = chatPartnerIds
      .map((id) => partnerById.get(id))
      .filter(Boolean);

    res.status(200).json(shapeLastSeenMany(orderedPartners, req.user));
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
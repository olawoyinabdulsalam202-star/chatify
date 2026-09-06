import mongoose from "mongoose";
import FriendRequest from "../modules/FriendRequest.js";
import User from "../modules/User.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import { PUBLIC_USER_FIELDS, shapeLastSeen } from "../lib/publicFields.js";

// Escapes the one regex-special character a handle can legally contain (a dot)
// plus the rest, so a typed prefix is matched literally and can never act as a
// wildcard against the username index.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Just the friends list, as ids. The DM gate and the client both key off this
// to decide who you're allowed to message. (The old request-based fields —
// sentPending / receivedPending — are gone: connections are now instant.)
export const getFriendStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("friends");
    res.status(200).json({ friends: user.friends.map((id) => id.toString()) });
  } catch (error) {
    console.log("Error in getFriendStatus:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Typeahead for the "add someone" box: a case-insensitive PREFIX match on the
// handle. This is deliberately NOT a browse-all-users directory — it only
// returns accounts whose username STARTS WITH what you've already typed (min 2
// chars), capped at 8, with bot/system accounts and yourself filtered out. So
// you can find someone you already know the handle of, but you can't page
// through the whole membership.
export const searchUsers = async (req, res) => {
  try {
    const raw = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    if (raw.length < 2) return res.status(200).json([]);

    const prefix = new RegExp("^" + escapeRegex(raw));
    const users = await User.find({
      username: prefix,
      _id: { $ne: req.user._id },
      isBot: { $ne: true },
      isSystem: { $ne: true },
    })
      .select("_id username fullName profilePic isBadged")
      .limit(8);

    const friendIds = new Set(req.user.friends.map((f) => f.toString()));
    res.status(200).json(
      users.map((u) => ({
        _id: u._id,
        username: u.username,
        fullName: u.fullName,
        profilePic: u.profilePic,
        isBadged: u.isBadged,
        // Lets the UI show "Message" instead of "Add" for someone you already
        // have, so tapping them just opens the chat.
        isFriend: friendIds.has(u._id.toString()),
      }))
    );
  } catch (error) {
    console.log("Error in searchUsers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// WhatsApp-style add-by-username: no request/accept dance. If the handle
// resolves, the two accounts become mutual friends immediately, so the DM gate
// opens and you can message right away. Idempotent — adding someone you already
// have just hands the chat back so the client can open it.
export const addFriendByUsername = async (req, res) => {
  try {
    const me = req.user._id;
    const raw = typeof req.body.username === "string" ? req.body.username.trim().toLowerCase() : "";
    if (!raw) return res.status(400).json({ message: "Enter a username" });

    // Only public fields — this document is sent straight back to the client to
    // open the chat with, so it must not carry email/otp/etc.
    const target = await User.findOne({ username: raw }).select(PUBLIC_USER_FIELDS);
    if (!target || target.isBot || target.isSystem) {
      return res.status(404).json({ message: "No account with that username" });
    }
    if (target._id.equals(me)) {
      return res.status(400).json({ message: "That's your own username." });
    }

    const already = req.user.friends.some((f) => f.equals(target._id));
    if (!already) {
      await User.findByIdAndUpdate(me, { $addToSet: { friends: target._id } });
      await User.findByIdAndUpdate(target._id, { $addToSet: { friends: me } });

      // Tell the other side in real time so their contacts/chat list can pick up
      // the new connection without a reload.
      const targetSocketId = getReceiverSocketId(target._id.toString());
      if (targetSocketId) {
        io.to(targetSocketId).emit("friendAdded", {
          by: {
            _id: req.user._id,
            username: req.user.username,
            fullName: req.user.fullName,
            profilePic: req.user.profilePic,
            isBadged: req.user.isBadged,
          },
        });
      }
    }

    // Shaped so the last-seen reciprocity rule still applies to the object the
    // client opens the chat with.
    res.status(200).json(shapeLastSeen(target, req.user));
  } catch (error) {
    console.log("Error in addFriendByUsername:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { id: friendId } = req.params;
    const userId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });
    // Sweep up any legacy rows from the old request-based flow so nothing stale
    // is left pointing at a connection that no longer exists.
    await FriendRequest.deleteMany({
      $or: [
        { from: userId, to: friendId },
        { from: friendId, to: userId },
      ],
    });

    res.status(200).json({ message: "Friend removed" });
  } catch (error) {
    console.log("Error in removeFriend:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

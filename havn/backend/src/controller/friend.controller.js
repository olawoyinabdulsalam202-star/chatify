import mongoose from "mongoose";
import FriendRequest from "../modules/FriendRequest.js";
import User from "../modules/User.js";
import { io, syncPresenceForUsers } from "../lib/socket.js";
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
    const [user, reciprocal] = await Promise.all([
      User.findById(req.user._id).select("friends"),
      User.find({ friends: req.user._id }).select("_id"),
    ]);
    const friends = new Set((user?.friends || []).map(String));
    reciprocal.forEach((friend) => friends.add(String(friend._id)));
    res.status(200).json({ friends: [...friends] });
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

    // The `i` flag matters: usernames are stored lowercase for accounts created
    // since the schema's lowercase setter, but legacy/backfilled accounts can
    // still hold mixed case ("Elite_dev"). Without it, a lowercased query prefix
    // never matches a capitalised stored handle — a real account that shows up
    // as "no accounts match". Case-insensitive is also simply correct: handles
    // are case-insensitive identities.
    const prefix = new RegExp("^" + escapeRegex(raw), "i");
    const users = await User.find({
      username: prefix,
      _id: { $ne: req.user._id },
      isBot: { $ne: true },
      isSystem: { $ne: true },
    })
      .select("_id username fullName profilePic isBadged")
      .limit(8);

    const reciprocalFriends = await User.find({ friends: req.user._id }).select("_id");
    const friendIds = new Set([
      ...req.user.friends.map((f) => f.toString()),
      ...reciprocalFriends.map((friend) => friend._id.toString()),
    ]);
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
    //
    // Anchored case-insensitive match rather than a bare equality on `raw`: a
    // legacy/backfilled account stored as "Elite_dev" would never match the
    // lowercased "elite_dev", which is the exact reason a real, existing contact
    // returned "no account with that username" and had to be re-added. Handles
    // are case-insensitive, so this is the correct lookup everywhere.
    const target = await User.findOne({
      username: new RegExp("^" + escapeRegex(raw) + "$", "i"),
    }).select(PUBLIC_USER_FIELDS);
    if (!target || target.isBot || target.isSystem) {
      return res.status(404).json({ message: "No account with that username" });
    }
    if (target._id.equals(me)) {
      return res.status(400).json({ message: "That's your own username." });
    }
    const [currentUser, refreshedTarget] = await Promise.all([
      User.findById(me).select("blockedUsers"),
      User.findById(target._id).select("blockedUsers"),
    ]);
    if (currentUser?.blockedUsers?.some((id) => id.equals(target._id)) || refreshedTarget?.blockedUsers?.some((id) => id.equals(me))) {
      return res.status(403).json({ message: "You cannot add this user because one of you has blocked the other." });
    }

    await Promise.all([
      User.findByIdAndUpdate(me, { $addToSet: { friends: target._id } }),
      User.findByIdAndUpdate(target._id, { $addToSet: { friends: me } }),
    ]);
    io.to(`user:${target._id}`).emit("friendAdded", {
      by: {
        _id: req.user._id,
        username: req.user.username,
        fullName: req.user.fullName,
        profilePic: req.user.profilePic,
        isBadged: req.user.isBadged,
      },
    });
    io.to(`user:${me}`).emit("friendAdded", {
      by: { _id: target._id, username: target.username, fullName: target.fullName, profilePic: target.profilePic, isBadged: target.isBadged },
    });
    await syncPresenceForUsers(me, target._id);

    // Shaped so the last-seen reciprocity rule still applies to the object the
    // client opens the chat with.
    res.status(200).json(shapeLastSeen(target, req.user));
  } catch (error) {
    console.log("Error in addFriendByUsername:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid user id" });
    if (String(id) === String(userId)) return res.status(400).json({ message: "You cannot block yourself." });
    const target = await User.exists({ _id: id });
    if (!target) return res.status(404).json({ message: "User not found." });
    await Promise.all([
      User.updateOne({ _id: userId }, { $addToSet: { blockedUsers: id }, $pull: { friends: id } }),
      User.updateOne({ _id: id }, { $pull: { friends: userId } }),
    ]);
    io.to(`user:${userId}`).emit("friendRemoved", { userId: String(id) });
    io.to(`user:${id}`).emit("friendRemoved", { userId: String(userId) });
    io.to(`user:${userId}`).emit("presenceUpdate", { userId: String(id), online: false });
    io.to(`user:${id}`).emit("presenceUpdate", { userId: String(userId), online: false });
    res.status(200).json({ message: "User blocked." });
  } catch (error) {
    console.error("Error in blockUser:", error.message);
    res.status(500).json({ message: "Couldn't block this user." });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid user id" });
    await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: id } });
    res.status(200).json({ message: "User unblocked." });
  } catch (error) {
    console.error("Error in unblockUser:", error.message);
    res.status(500).json({ message: "Couldn't unblock this user." });
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
    io.to(`user:${userId}`).emit("friendRemoved", { userId: String(friendId) });
    io.to(`user:${friendId}`).emit("friendRemoved", { userId: String(userId) });
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

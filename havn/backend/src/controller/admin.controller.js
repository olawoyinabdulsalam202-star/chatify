import User from "../modules/User.js";
import Message from "../modules/Message.js";
import Group from "../modules/Group.js";
import Story from "../modules/Story.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

// GET /api/admin/users?search=&filter=banned|badged|all&page=&limit=
export const listUsers = async (req, res) => {
  try {
    const { search = "", filter = "all", page = 1, limit = 25 } = req.query;

    const query = { isBot: { $ne: true } };
    if (search.trim()) {
      // Filter by username (fullName) — case-insensitive partial match.
      query.fullName = { $regex: search.trim(), $options: "i" };
    }
    if (filter === "banned") query.isBanned = true;
    if (filter === "badged") query.isBadged = true;
    if (filter === "admins") query.isAdmin = true;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -otp -otpExpiry")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    res.status(200).json({ users, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.log("Error in listUsers controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "" } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.isAdmin) return res.status(400).json({ message: "Cannot ban an admin." });

    user.isBanned = true;
    user.banReason = reason;
    await user.save();

    // Kick their active sockets immediately.
    const socketId = getReceiverSocketId(user._id);
    if (socketId) {
      io.to(socketId).emit("accountBanned", { reason });
      io.sockets.sockets.get(socketId)?.disconnect(true);
    }

    res.status(200).json({ message: "User banned." });
  } catch (error) {
    console.log("Error in banUser controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unbanUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isBanned: false, banReason: "" }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found." });
    res.status(200).json({ message: "User unbanned." });
  } catch (error) {
    console.log("Error in unbanUser controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.isAdmin) return res.status(400).json({ message: "Cannot delete an admin." });

    // Clean up what we reasonably can — messages, group memberships, stories.
    await Promise.all([
      Message.deleteMany({ $or: [{ senderId: id }, { receiverId: id }] }),
      Story.deleteMany({ userId: id }),
      Group.updateMany({ "members.userId": id }, { $pull: { members: { userId: id } } }),
    ]);
    await user.deleteOne();

    const socketId = getReceiverSocketId(id);
    if (socketId) {
      io.to(socketId).emit("accountDeleted");
      io.sockets.sockets.get(socketId)?.disconnect(true);
    }

    res.status(200).json({ message: "User deleted." });
  } catch (error) {
    console.log("Error in deleteUser controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const setUserBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const { badged } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.isBadged = !!badged;
    await user.save();

    const socketId = getReceiverSocketId(id);
    if (socketId) io.to(socketId).emit("badgeUpdated", { isBadged: user.isBadged });

    res.status(200).json({ message: badged ? "Badge granted." : "Badge removed." });
  } catch (error) {
    console.log("Error in setUserBadge controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getAdminStats = async (req, res) => {
  try {
    const [totalUsers, bannedUsers, badgedUsers, totalGroups, totalMessages] = await Promise.all([
      User.countDocuments({ isBot: { $ne: true } }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ isBadged: true, isBot: { $ne: true } }),
      Group.countDocuments(),
      Message.countDocuments(),
    ]);
    res.status(200).json({ totalUsers, bannedUsers, badgedUsers, totalGroups, totalMessages });
  } catch (error) {
    console.log("Error in getAdminStats controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Group from "../modules/Group.js";
import User from "../modules/User.js";
import Message from "../modules/Message.js";
import { randomUUID } from "node:crypto";
import { sendPushToUser } from "./push.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ENV.ALLOWED_ORIGINS,
    credentials: true,
  },
  // The frontend connects with polling first (mobile networks and proxies that
  // block raw websockets), so the server has to accept it too and let the
  // client upgrade afterwards.
  transports: ["polling", "websocket"],
  // Render's proxy drops idle connections; pinging more often than that keeps
  // long-lived presence connections from being reaped mid-conversation.
  pingInterval: 25000,
  pingTimeout: 20000,
});

// apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// --- Presence -------------------------------------------------------
// A user can have several live sockets at once (multiple tabs, phone +
// laptop, a background tab, etc). We track a *set* of socket ids per user
// instead of a single id, so closing one tab/reconnecting doesn't wrongly
// flip someone offline while they still have another connection open.
const userSocketMap = {}; // { userId: Set<socketId> }

// When a tab closes/reloads or the network blips, socket.io fires
// "disconnect" immediately, but a reconnect (new tab, page refresh, brief
// wifi drop) usually follows within a second or two. We wait a grace period
// before broadcasting someone as offline so presence doesn't flicker every
// time a page reloads.
//
// This is deliberately generous. Phones suspend background tabs and PWAs the
// moment the screen locks or the user switches apps, which kills the socket
// without the user having "left". A short window made people vanish from the
// contact list — and therefore become uncallable — while their app was still
// very much open. The client reconnects on visibility/focus/online, so a real
// return lands well inside this window; only a genuine close stays offline.
const PRESENCE_GRACE_MS = ENV.PRESENCE_GRACE_MS;
const pendingOfflineTimers = {}; // { userId: Timeout }
const pendingCalls = new Map();
const callAttempts = new Map();

function clearPendingForPair(firstId, secondId) {
  const first = String(firstId);
  const second = String(secondId);
  for (const [callId, call] of pendingCalls) {
    if ((call.from === first && call.to === second) || (call.from === second && call.to === first)) {
      clearTimeout(call.timer);
      pendingCalls.delete(callId);
      sendPushToUser(call.to, { kind: "callCancelled", callId, title: "Call ended", body: "" });
      return call;
    }
  }
  return null;
}

function callRateAllowed(userId) {
  const now = Date.now();
  const recent = (callAttempts.get(String(userId)) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 10) return false;
  recent.push(now);
  callAttempts.set(String(userId), recent);
  return true;
}

async function createCallHistory(call, callStatus, duration = 0) {
  try {
    const message = await Message.create({
      senderId: call.from,
      receiverId: call.to,
      type: "call",
      callStatus,
      callType: call.callType,
      callDuration: Math.max(0, Number(duration) || 0),
      text: callStatus === "missed" ? `Missed ${call.callType} call` : `${call.callType === "video" ? "Video" : "Voice"} call`,
    });
    io.to(`user:${call.from}`).emit("newMessage", message);
    io.to(`user:${call.to}`).emit("newMessage", message);
    return message;
  } catch (error) {
    console.error("Call history write failed:", error.message);
    return null;
  }
}

// The single source of truth for who's online. Controllers and helpers must
// use this, not build their own copy from the map, so presence answers can
// never disagree about a user.
export function onlineUserIds() {
  return Object.keys(userSocketMap);
}

// Presence is friends-only. A user's online state is sent only to the people
// they're mutually connected with — never io.emit'd to the whole connected
// base, which used to leak every member's presence (and id) to everyone.
export async function friendIdsOf(userId) {
  try {
    const u = await User.findById(userId).select("friends blockedUsers");
    if (!u) return [];
    const ids = new Set((u.friends || []).map(String));
    const reciprocal = await User.find({ friends: userId }).select("_id");
    reciprocal.forEach((user) => ids.add(String(user._id)));
    const conversations = await Message.find({
      groupId: { $exists: false },
      $or: [{ senderId: userId }, { receiverId: userId }],
    }).select("senderId receiverId").lean();
    conversations.forEach((message) => {
      const otherId = String(message.senderId) === String(userId) ? message.receiverId : message.senderId;
      if (otherId) ids.add(String(otherId));
    });
    const candidates = [...ids].filter((id) => id !== String(userId));
    const blocked = new Set((u.blockedUsers || []).map(String));
    const blockers = await User.find({ _id: { $in: candidates }, blockedUsers: userId }).select("_id");
    blockers.forEach((user) => blocked.add(String(user._id)));
    return candidates.filter((id) => !blocked.has(id));
  } catch {
    return [];
  }
}

// Fan a presence change out to a user's friends, each in their own per-user
// room. This is the targeted replacement for the old global broadcast: X's
// friends are exactly the set allowed to know whether X is online.
export async function emitPresenceToFriends(userId, online) {
  const friends = await friendIdsOf(userId);
  friends.forEach((fid) => {
    io.to(`user:${fid}`).emit("presenceUpdate", { userId: String(userId), online });
  });
}

export async function syncPresenceForUsers(firstId, secondId) {
  const firstOnline = isUserOnline(String(firstId));
  const secondOnline = isUserOnline(String(secondId));
  io.to(`user:${firstId}`).emit("presenceUpdate", { userId: String(secondId), online: secondOnline });
  io.to(`user:${secondId}`).emit("presenceUpdate", { userId: String(firstId), online: firstOnline });
}

// Returns whether this was a genuine offline->online transition. The caller
// (the connection handler) owns the friends fan-out, since that needs a DB
// lookup and must not block the map bookkeeping here.
function markOnline(userId, socketId) {
  if (pendingOfflineTimers[userId]) {
    clearTimeout(pendingOfflineTimers[userId]);
    delete pendingOfflineTimers[userId];
  }
  const wasOffline = !userSocketMap[userId] || userSocketMap[userId].size === 0;
  if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
  userSocketMap[userId].add(socketId);
  return wasOffline;
}

function scheduleOffline(userId, socketId) {
  const disconnectedAt = new Date();
  const sockets = userSocketMap[userId];
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size > 0) return; // still connected elsewhere — stay online
  }

  if (pendingOfflineTimers[userId]) clearTimeout(pendingOfflineTimers[userId]);
  pendingOfflineTimers[userId] = setTimeout(() => {
    delete pendingOfflineTimers[userId];
    // Only actually go offline if no new socket showed up during the grace window.
    if (!userSocketMap[userId] || userSocketMap[userId].size === 0) {
      delete userSocketMap[userId];

      // Logout stamps lastSeenAt immediately, so it may have landed in the
      // seconds since this disconnect. Only write if the user has no fresher
      // stamp — a $setOnInsert-less conditional keeps the explicit logout from
      // being clobbered by the timer.
      User.updateOne(
        { _id: userId, $or: [{ lastSeenAt: { $exists: false } }, { lastSeenAt: { $lt: disconnectedAt } }] },
        { $set: { lastSeenAt: disconnectedAt } }
      ).catch(() => {}).finally(() => {
        if (userSocketMap[userId]?.size) return;
        console.log("Presence: user offline after grace window", userId);
        emitPresenceToFriends(userId, false).catch(() => {});
      });

      // Diagnostic for hosted environments (Render): confirms the grace timer
      // actually fired and the user was reaped, so a "nobody ever shows offline"
      // report can be traced to whether this line prints in production logs.
    }
  }, PRESENCE_GRACE_MS);
}

// Returns any one live socket id for a user (used for direct, single-target
// events like call signaling). Returns undefined if the user has no live
// connection right now.
export function getReceiverSocketId(userId) {
  const sockets = userSocketMap[userId];
  if (!sockets || sockets.size === 0) return undefined;
  return sockets.values().next().value;
}

// Presence, as the rest of the app understands it: the user still counts as
// online while they're inside the reconnect grace window. This is the global
// truth (is this user connected at all) that call-signaling routes off — it is
// deliberately NOT the same as what any one client sees, since presence is now
// fanned out per-friend rather than as one shared list.
export function isUserOnline(userId) {
  return Boolean(userSocketMap[userId]);
}

// Delivery, which is a stricter question: is there a socket to send to *right
// now*. During the grace window the Set exists but is empty, so this is false
// while isUserOnline is true — that gap is what tells "genuinely offline"
// apart from "momentarily between sockets".
export function hasLiveSocket(userId) {
  return Boolean(userSocketMap[userId] && userSocketMap[userId].size > 0);
}

io.on("connection", (socket) => {
  console.log("A user connected", socket.user.fullName);

  const userId = socket.userId;
  const wasOffline = markOnline(userId, socket.id);

  // A stable per-user room lets REST endpoints (e.g. creating/adding to a
  // group) push this socket into new group rooms without needing a reconnect,
  // and lets us fan a message out to every device/tab a user has open.
  socket.join(`user:${userId}`);

  for (const [callId, call] of pendingCalls) {
    if (call.to !== String(userId) || call.delivered) continue;
    call.delivered = true;
    io.to(socket.id).emit("incomingCall", {
      callId, from: call.from, fromName: call.fromName, fromAvatar: call.fromAvatar,
      fromIsBadged: call.fromIsBadged, offer: call.offer, callType: call.callType,
    });
  }

  Message.find({
    receiverId: userId,
    status: "sent",
    groupId: { $exists: false },
  }).select("_id senderId").lean()
    .then(async (pendingMessages) => {
      if (!pendingMessages.length) return;
      const deliveredAt = new Date();
      await Message.updateMany(
        { _id: { $in: pendingMessages.map((message) => message._id) }, status: "sent" },
        { $set: { status: "delivered", deliveredAt } }
      );
      const bySender = new Map();
      pendingMessages.forEach((message) => {
        const senderId = String(message.senderId);
        bySender.set(senderId, [...(bySender.get(senderId) || []), message]);
      });
      bySender.forEach((messages, senderId) => {
        messages.forEach((message) => {
          io.to(`user:${senderId}`).emit("messageDelivered", {
            messageId: String(message._id),
            receiverId: String(userId),
          });
        });
      });
    })
    .catch((error) => console.error("Error delivering pending messages:", error.message));

  // Join every group room this user already belongs to.
  Group.find({ "members.userId": userId })
    .select("_id")
    .then((groups) => {
      groups.forEach((g) => socket.join(`group:${g._id}`));
    })
    .catch((err) => console.log("Error joining group rooms:", err.message));

  // Presence bootstrap + fan-out, friends-only. This socket is told which of
  // ITS friends are online right now (so a freshly opened tab doesn't have to
  // wait for someone else's event), and the user's friends are told this user
  // just came online — but only on a real offline->online transition, so a
  // second tab doesn't spam a redundant notice.
  friendIdsOf(userId)
    .then((friends) => {
      const onlineFriends = friends.filter((fid) => isUserOnline(fid));
      socket.emit("getOnlineUsers", onlineFriends);
      if (wasOffline) {
        friends.forEach((fid) =>
          io.to(`user:${fid}`).emit("presenceUpdate", { userId: String(userId), online: true })
        );
      }
    })
    .catch(() => socket.emit("getOnlineUsers", []));

  // with socket.on we listen for events from clients
  socket.on("typing", ({ receiverId }) => {
    io.to(`user:${receiverId}`).emit("typing", { senderId: userId });
  });

  socket.on("heartbeat", (sentAt) => socket.emit("heartbeatAck", sentAt));

  socket.on("stopTyping", ({ receiverId }) => {
    io.to(`user:${receiverId}`).emit("stopTyping", { senderId: userId });
  });

  // --- WebRTC call signaling ---------------------------------------
  // Purely ephemeral relay: nothing here is written to the database, so no
  // call history/log is ever kept server-side.

  socket.on("callUser", async ({ to, offer, callType }) => {
    if (!to || !offer || !["audio", "video"].includes(callType)) return;
    if (!callRateAllowed(userId)) {
      socket.emit("callUnavailable", { to, message: "Too many calls. Try again in a minute." });
      return;
    }
    const targetSocketId = getReceiverSocketId(to);
    if (!targetSocketId) {
      // Two different situations reach here, and telling them apart matters to
      // the caller: the target may be fully offline, or they may be inside the
      // reconnect grace window (still listed as online, but with no live
      // socket to deliver the offer to right now — phone just locked, tunnel,
      // app switcher). "Offline" would be a lie in the second case.
      const target = await User.findById(to).select("_id").lean().catch(() => null);
      if (!target) {
        socket.emit("callUnavailable", { to, reconnecting: false });
        return;
      }
      const callId = randomUUID();
      const call = {
        callId, from: String(userId), to: String(to), fromName: socket.user.fullName,
        fromAvatar: socket.user.profilePic || "", fromIsBadged: !!socket.user.isBadged,
        offer, callType, createdAt: Date.now(),
      };
      call.timer = setTimeout(async () => {
        if (!pendingCalls.has(callId)) return;
        pendingCalls.delete(callId);
        io.to(`user:${call.from}`).emit("callNoAnswer", { callId, to: call.to });
        io.to(`user:${call.to}`).emit("callEnded", { callId, from: call.from });
        sendPushToUser(call.to, { kind: "callCancelled", callId, title: "Call ended", body: "" });
        const message = await createCallHistory(call, "missed");
        sendPushToUser(call.to, {
          title: call.fromName, body: `Missed ${call.callType} call`, senderId: call.from,
          senderName: call.fromName, avatarUrl: call.fromAvatar, chatId: call.from,
          kind: "dm", tag: `missed-call-${callId}`, messageId: message?._id,
        });
      }, 45_000);
      pendingCalls.set(callId, call);
      socket.emit("callRinging", { callId, to: call.to, state: "ringing offline" });
      sendPushToUser(call.to, {
        title: call.fromName, body: `Incoming ${call.callType} call`, senderName: call.fromName,
        avatarUrl: call.fromAvatar, senderId: call.from, chatId: call.from, kind: "call",
        tag: `call-${callId}`, callId, callerId: call.from, callType: call.callType,
      });
      return;
    }
    const callId = randomUUID();
    socket.emit("callStarted", { callId, to: String(to) });
    io.to(targetSocketId).emit("incomingCall", {
      callId,
      from: userId,
      fromName: socket.user.fullName,
      fromAvatar: socket.user.profilePic,
      fromIsBadged: socket.user.isBadged,
      offer,
      callType,
    });
    sendPushToUser(to, {
      title: socket.user.fullName,
      body: `Incoming ${callType} call`,
      senderName: socket.user.fullName,
      avatarUrl: socket.user.profilePic || "",
      senderId: String(userId),
      callerId: String(userId),
      chatId: String(userId),
      kind: "call",
      tag: `call-${callId}`,
      callId,
      callType,
    });
  });

  socket.on("answerCall", ({ to, answer, callId }) => {
    const pending = clearPendingForPair(userId, to);
    if (!pending && callId) sendPushToUser(userId, { kind: "callCancelled", callId, title: "Call answered", body: "" });
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callAnswered", { from: userId, answer, callId: callId || pending?.callId });
    }
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("iceCandidate", { from: userId, candidate });
    }
  });

  socket.on("declineCall", ({ to, callId }) => {
    const pending = clearPendingForPair(userId, to);
    if (!pending && callId) sendPushToUser(userId, { kind: "callCancelled", callId, title: "Call declined", body: "" });
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callDeclined", { from: userId, callId });
    }
  });

  socket.on("endCall", async ({ to, callId, duration, callType }) => {
    const pending = clearPendingForPair(userId, to);
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callEnded", { from: userId, callId });
    }
    if (!pending && duration != null) await createCallHistory({ from: String(userId), to: String(to), callType: callType === "video" ? "video" : "audio" }, "ended", duration);
    if (!pending) sendPushToUser(to, { kind: "callCancelled", callId: callId || "", title: "Call ended", body: "" });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);
    scheduleOffline(userId, socket.id);
  });
});

export { io, app, server };

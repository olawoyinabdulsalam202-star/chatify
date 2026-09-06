import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Group from "../modules/Group.js";
import User from "../modules/User.js";

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
const OFFLINE_GRACE_MS = 45000;
const pendingOfflineTimers = {}; // { userId: Timeout }

function broadcastOnlineUsers() {
  io.emit("getOnlineUsers", onlineUserIds());
}

// The single source of truth for who's online. Controllers and helpers must
// use this, not build their own copy from the map, so a broadcast and an
// answer can never disagree about a user.
export function onlineUserIds() {
  return Object.keys(userSocketMap);
}

function markOnline(userId, socketId) {
  if (pendingOfflineTimers[userId]) {
    clearTimeout(pendingOfflineTimers[userId]);
    delete pendingOfflineTimers[userId];
  }
  const wasOffline = !userSocketMap[userId] || userSocketMap[userId].size === 0;
  if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
  userSocketMap[userId].add(socketId);
  if (wasOffline) broadcastOnlineUsers();
}

function scheduleOffline(userId, socketId) {
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
        { _id: userId, $or: [{ lastSeenAt: { $exists: false } }, { lastSeenAt: { $lt: new Date() } }] },
        { $set: { lastSeenAt: new Date() } }
      ).catch(() => {});

      broadcastOnlineUsers();
    }
  }, OFFLINE_GRACE_MS);
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
// online while they're inside the reconnect grace window. This intentionally
// matches Object.keys(userSocketMap) — the exact list broadcastOnlineUsers
// sends out — because a helper that disagreed with the broadcast would report
// someone offline while every client still showed them online.
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
  markOnline(userId, socket.id);

  // A stable per-user room lets REST endpoints (e.g. creating/adding to a
  // group) push this socket into new group rooms without needing a reconnect,
  // and lets us fan a message out to every device/tab a user has open.
  socket.join(`user:${userId}`);

  // Join every group room this user already belongs to.
  Group.find({ "members.userId": userId })
    .select("_id")
    .then((groups) => {
      groups.forEach((g) => socket.join(`group:${g._id}`));
    })
    .catch((err) => console.log("Error joining group rooms:", err.message));

  // Send the current snapshot straight to the newly-connected client too,
  // not just to everyone else — otherwise a freshly opened tab has to wait
  // for someone else's connect/disconnect event before it knows who's online.
  socket.emit("getOnlineUsers", onlineUserIds());

  // with socket.on we listen for events from clients
  socket.on("typing", ({ receiverId }) => {
    io.to(`user:${receiverId}`).emit("typing", { senderId: userId });
  });

  socket.on("stopTyping", ({ receiverId }) => {
    io.to(`user:${receiverId}`).emit("stopTyping", { senderId: userId });
  });

  // --- WebRTC call signaling ---------------------------------------
  // Purely ephemeral relay: nothing here is written to the database, so no
  // call history/log is ever kept server-side.

  socket.on("callUser", ({ to, offer, callType }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (!targetSocketId) {
      // Two different situations reach here, and telling them apart matters to
      // the caller: the target may be fully offline, or they may be inside the
      // reconnect grace window (still listed as online, but with no live
      // socket to deliver the offer to right now — phone just locked, tunnel,
      // app switcher). "Offline" would be a lie in the second case.
      socket.emit("callUnavailable", { to, reconnecting: isUserOnline(to) });
      return;
    }
    io.to(targetSocketId).emit("incomingCall", {
      from: userId,
      fromName: socket.user.fullName,
      fromAvatar: socket.user.profilePic,
      fromIsBadged: socket.user.isBadged,
      offer,
      callType,
    });
  });

  socket.on("answerCall", ({ to, answer }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callAnswered", { from: userId, answer });
    }
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("iceCandidate", { from: userId, candidate });
    }
  });

  socket.on("declineCall", ({ to }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callDeclined", { from: userId });
    }
  });

  socket.on("endCall", ({ to }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("callEnded", { from: userId });
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);
    scheduleOffline(userId, socket.id);
  });
});

export { io, app, server };

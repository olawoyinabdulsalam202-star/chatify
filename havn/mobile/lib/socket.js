import { io } from "socket.io-client";
import { API_ORIGIN } from "./api";

let socket = null;
let heartbeatTimer = null;

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (socket?.connected) socket.emit("heartbeat", Date.now());
  }, 25000);
}

export function connectSocket(token) {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(API_ORIGIN, {
    auth: { token },
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    timeout: 20000,
  });
  startHeartbeat();
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

import { useAuthStore } from "../stores/useAuthStore";
import { useChatStore } from "../stores/useChatStore";
import { useMessageStore } from "../stores/useMessageStore";
import { usePresenceStore } from "../stores/usePresenceStore";

const boundSockets = new WeakSet();

export function bindSocketEvents(socket) {
  if (!socket || boundSockets.has(socket)) return;
  boundSockets.add(socket);

  socket.on("connect", () => {
    useMessageStore.getState().syncOpenChat();
    useChatStore.getState().loadChats({ quiet: true });
  });
  socket.on("getOnlineUsers", (ids) => usePresenceStore.getState().setOnlineUsers(ids));
  socket.on("presenceUpdate", ({ userId, online }) => usePresenceStore.getState().setPresence(userId, online));
  socket.on("newMessage", (message) => {
    if (!message?.receiverId) return;
    const currentUserId = useAuthStore.getState().authUser?._id;
    const isOpen = useMessageStore.getState().receiveMessage(message);
    useChatStore.getState().updateFromMessage(message, currentUserId, isOpen);
  });
  socket.on("messageDelivered", ({ messageId }) => {
    useMessageStore.getState().applyDelivered(messageId);
    useChatStore.getState().applyDelivered(messageId);
  });
  socket.on("messagesDelivered", (payload) => {
    const list = Array.isArray(payload) ? payload : payload?.messages || [];
    list.forEach((item) => {
      const messageId = item.messageId || item._id;
      useMessageStore.getState().applyDelivered(messageId);
      useChatStore.getState().applyDelivered(messageId);
    });
  });
  socket.on("messagesSeen", ({ by }) => {
    useMessageStore.getState().applySeen(by);
    useChatStore.getState().applySeen(by);
  });
  socket.on("typing", ({ senderId }) => {
    if (String(useMessageStore.getState().openPartner?._id) === String(senderId)) useMessageStore.getState().setTyping(true);
  });
  socket.on("stopTyping", ({ senderId }) => {
    if (String(useMessageStore.getState().openPartner?._id) === String(senderId)) useMessageStore.getState().setTyping(false);
  });
  socket.on("friendAdded", ({ by }) => useChatStore.getState().markFriendAdded(by));
  socket.on("messageEdited", (message) => {
    useMessageStore.getState().applyEdited(message);
    useChatStore.getState().applyMessageUpdate(message);
  });
  socket.on("messageDeleted", (message) => {
    useMessageStore.getState().applyDeleted(message);
    useChatStore.getState().applyMessageUpdate(message);
  });
}

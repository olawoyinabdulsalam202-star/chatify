import { useAuthStore } from "../stores/useAuthStore";
import { useChatStore } from "../stores/useChatStore";
import { useMessageStore } from "../stores/useMessageStore";
import { usePresenceStore } from "../stores/usePresenceStore";
import { useGroupStore } from "../stores/useGroupStore";
import { useStoryStore } from "../stores/useStoryStore";

const boundSockets = new WeakSet();

export function bindSocketEvents(socket) {
  if (!socket || boundSockets.has(socket)) return;
  boundSockets.add(socket);

  socket.on("connect", () => {
    useMessageStore.getState().syncOpenChat();
    useChatStore.getState().loadChats({ quiet: true });
  });
  socket.on("getOnlineUsers", (ids) => usePresenceStore.getState().setOnlineUsers(ids));
  socket.on("newGroupMessage", (message) => useGroupStore.getState().receive(message));
  socket.on("messageEdited", (message) => { if (message.groupId) useGroupStore.getState().editMessage(message); });
  socket.on("messageDeleted", (message) => { if (message.groupId) useGroupStore.getState().editMessage(message); });
  socket.on("groupUpdated", (group) => useGroupStore.setState((state) => ({ groups: state.groups.map((item) => String(item._id) === String(group._id) ? group : item) })));
  socket.on("groupCreated", (group) => useGroupStore.setState((state) => ({ groups: state.groups.some((item) => String(item._id) === String(group._id)) ? state.groups : [group, ...state.groups] })));
  socket.on("groupDeleted", ({ groupId }) => useGroupStore.setState((state) => ({ groups: state.groups.filter((item) => String(item._id) !== String(groupId)) })));
  socket.on("newStory", () => useStoryStore.getState().load());
  socket.on("storyDeleted", ({ storyId }) => useStoryStore.setState((state) => ({ mine: state.mine.filter((item) => String(item._id) !== String(storyId)), feed: state.feed.map((group) => ({ ...group, stories: group.stories.filter((item) => String(item._id) !== String(storyId)) })).filter((group) => group.stories.length) })));
  socket.on("storyViewed", ({ storyId, viewerId }) => useStoryStore.setState((state) => ({ mine: state.mine.map((story) => String(story._id) !== String(storyId) || story.viewers?.some((item) => String(item.userId?._id || item.userId) === String(viewerId)) ? story : { ...story, viewers: [...(story.viewers || []), { userId: viewerId, viewedAt: new Date().toISOString() }] }) })));
  socket.on("storyLiked", ({ storyId, likerId }) => useStoryStore.setState((state) => ({ mine: state.mine.map((story) => String(story._id) !== String(storyId) || story.likes?.some((item) => String(item.userId?._id || item.userId) === String(likerId)) ? story : { ...story, likes: [...(story.likes || []), { userId: likerId, likedAt: new Date().toISOString() }] }) })));
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

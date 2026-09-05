import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { setAppBadge } from "../lib/push";

// Keeps references to the handlers currently attached to the socket, so
// unsubscribe can remove exactly those (and not a shared-event listener
// that useGroupStore attached separately on the same socket).
let dmSocketHandlers = null;

// See the same helper in useGroupStore: a bare `temp-${Date.now()}` collides for
// two messages sent in the same millisecond, which duplicates React keys and can
// make one of the two disappear when the responses reconcile.
let tempIdCounter = 0;
const nextTempId = () => `temp-${Date.now()}-${++tempIdCounter}`;

// Handlers for events that must work regardless of which chat (if any) is
// open. These are attached once at the page level and stay attached for the
// whole session — that's what makes a message from someone you're NOT
// currently looking at still ring, bump them to the top of the Chats list,
// and show an unread badge, the way every other chat app behaves.
let globalSocketHandlers = null;

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  isAddPeopleOpen: false, // the "add someone by username" modal
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,
  typingUserId: null, // the other user's id, when THEY are typing to us
  replyTarget: null, // message currently being replied to
  viewOnceCache: {}, // messageId -> { imageUrl, videoUrl, duration } for view-once media opened this session (memory only, never persisted)
  unreadCounts: {}, // senderId -> number of messages that arrived while their chat wasn't open

  setReplyTarget: (message) => set({ replyTarget: message }),
  clearReplyTarget: () => set({ replyTarget: null }),

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  openAddPeople: () => set({ isAddPeopleOpen: true }),
  closeAddPeople: () => set({ isAddPeopleOpen: false }),

  // Opening someone's chat clears their unread badge.
  setSelectedUser: (selectedUser) => {
    if (!selectedUser) return set({ selectedUser: null });
    const { [selectedUser._id]: _cleared, ...rest } = get().unreadCounts;
    set({ selectedUser, unreadCounts: rest });
    // Keep the OS/app-icon badge in step with what's actually unread.
    setAppBadge(Object.values(rest).reduce((sum, n) => sum + n, 0));
  },

  // Wipes everything tied to the signed-in account. Without this, `messages`,
  // `chats` and `selectedUser` are module-level state that outlives logout —
  // the next person to log in on the same tab saw the previous user's
  // conversation and cached message history before any refetch. That's a
  // serious leak in an app whose whole point is that members stay anonymous.
  resetChatState: () =>
    set({
      allContacts: [],
      chats: [],
      messages: [],
      selectedUser: null,
      typingUserId: null,
      replyTarget: null,
      viewOnceCache: {},
      unreadCounts: {},
      activeTab: "chats",
      isAddPeopleOpen: false,
    }),

  getAllContacts: async ({ quiet = false } = {}) => {
    if (!quiet) set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
      get().syncSelectedUser(res.data);
    } catch (error) {
      // Optional chaining matters: a network/CORS failure has no `response` at
      // all, and the old `error.response.data.message` threw a TypeError that
      // replaced the toast with an unhandled rejection.
      if (!quiet) toast.error(error.response?.data?.message || "Couldn't load contacts");
    } finally {
      if (!quiet) set({ isUsersLoading: false });
    }
  },

  // Folds freshly-fetched fields into the open conversation's user object.
  //
  // `selectedUser` is a snapshot taken when the row was clicked, so refetching
  // a list replaced `chats`/`allContacts` but left the open chat header reading
  // from the stale copy — which is why the header kept saying "Offline" even
  // after the server had recorded a lastSeenAt. Merging (not replacing) keeps
  // any fields the list endpoint doesn't return.
  syncSelectedUser: (freshList) => {
    const selected = get().selectedUser;
    if (!selected) return;
    const fresh = freshList.find((u) => u._id === selected._id);
    if (fresh) set({ selectedUser: { ...selected, ...fresh } });
  },

  // `quiet` skips the loading flag. The socket handler refreshes this list on
  // every incoming message, and without quiet mode that would flash the
  // loading skeleton over the sidebar each time a message arrived.
  getMyChatPartners: async ({ quiet = false } = {}) => {
    if (!quiet) set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
      get().syncSelectedUser(res.data);
    } catch (error) {
      if (!quiet) toast.error(error.response?.data?.message || "Couldn't load chats");
    } finally {
      if (!quiet) set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
      get().markAsSeen(userId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, replyTarget } = get();
    const { authUser } = useAuthStore.getState();

    const tempId = nextTempId();

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      gif: messageData.gif,
      sticker: messageData.sticker,
      audio: messageData.audio,
      audioDuration: messageData.audioDuration,
      viewOnce: !!messageData.viewOnce,
      createdAt: new Date().toISOString(),
      status: "sent",
      replyTo: replyTarget
        ? {
            messageId: replyTarget._id,
            senderId: replyTarget.senderId,
            text: replyTarget.isDeleted
              ? "This message was deleted"
              : replyTarget.text ||
                (replyTarget.image ? "📷 Photo" : replyTarget.sticker ? "Sticker" : "GIF"),
          }
        : undefined,
      isOptimistic: true, // flag to identify optimistic messages (optional)
    };
    // immidetaly update the ui by adding the message
    set({ messages: [...messages, optimisticMessage], replyTarget: null });

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, {
        ...messageData,
        replyToId: replyTarget?._id,
      });
      // Same idempotent reconcile as the group path. DMs are only echoed to the
      // receiver today, so the sender can't double up — but this makes the
      // reconcile correct on its own terms rather than by relying on that.
      set({
        messages: [
          ...get().messages.filter((m) => m._id !== tempId && m._id !== res.data._id),
          res.data,
        ],
      });
      // Bump this partner to the top of the sidebar the way receiving one does.
      // Quiet so the list re-sorts without flashing the loading skeleton.
      get().getMyChatPartners({ quiet: true });
    } catch (error) {
      // remove optimistic message on failure
      set({ messages: get().messages.filter((m) => m._id !== tempId) });
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  },

  // Forward reuses the send endpoint but targets an arbitrary user, without
  // touching the currently open conversation.
  forwardMessage: async (message, targetUserId) => {
    try {
      await axiosInstance.post(`/messages/send/${targetUserId}`, {
        text: message.text,
        // View-once media is never forwarded — passing it on would defeat the
        // guarantee the sender relied on. Same rule for video as for photos.
        image: message.viewOnce ? undefined : message.image,
        video: message.viewOnce ? undefined : message.video,
        videoDuration: message.viewOnce ? undefined : message.videoDuration,
        gif: message.gif,
        sticker: message.sticker,
        audio: message.audio,
        audioDuration: message.audioDuration,
      });
      toast.success("Message forwarded");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward message");
    }
  },

  // Returns { imageUrl, videoUrl, duration } — view-once now covers video as
  // well as photos, so callers need to know which one came back.
  //
  // The server strips the URL from the document as it responds, so this is the
  // only moment the media is ever available. It's held in memory (never
  // localStorage) so closing the tab really does destroy it.
  openViewOnce: async (messageId) => {
    try {
      const res = await axiosInstance.post(`/messages/view-once/${messageId}`);
      const media = {
        imageUrl: res.data.imageUrl || null,
        videoUrl: res.data.videoUrl || null,
        duration: res.data.duration || null,
      };
      set({
        viewOnceCache: { ...get().viewOnceCache, [messageId]: media },
        messages: get().messages.map((m) => (m._id === messageId ? res.data.message : m)),
      });
      return media;
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't open this");
      return null;
    }
  },

  toggleReaction: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.put(`/messages/react/${messageId}`, { emoji });
      set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to react");
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const res = await axiosInstance.put(`/messages/edit/${messageId}`, { text });
      set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const res = await axiosInstance.delete(`/messages/delete/${messageId}`);
      set({ messages: get().messages.map((m) => (m._id === messageId ? res.data : m)) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },

  markAsSeen: async (userId) => {
    try {
      await axiosInstance.put(`/messages/seen/${userId}`);
    } catch {
      // non-critical — silently ignore
    }
  },

  sendTyping: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || !socket) return;
    socket.emit("typing", { receiverId: selectedUser._id });
  },

  sendStopTyping: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || !socket) return;
    socket.emit("stopTyping", { receiverId: selectedUser._id });
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    const handlers = {
      newMessage: (newMessage) => {
        const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
        if (!isMessageSentFromSelectedUser) return;

        const currentMessages = get().messages;
        set({ messages: [...currentMessages, newMessage] });
        get().markAsSeen(selectedUser._id);

        // Sound is now handled by the global handler below, which fires
        // regardless of which chat is open — this per-conversation subscription
        // only handles updating the message list for the currently-open chat.
      },
      messageEdited: (updatedMessage) => {
        if (updatedMessage.groupId) return; // handled by useGroupStore
        set({
          messages: get().messages.map((m) => (m._id === updatedMessage._id ? updatedMessage : m)),
        });
      },
      messageDeleted: (updatedMessage) => {
        if (updatedMessage.groupId) return; // handled by useGroupStore
        set({
          messages: get().messages.map((m) => (m._id === updatedMessage._id ? updatedMessage : m)),
        });
      },
      messageReaction: (updatedMessage) => {
        if (updatedMessage.groupId) return; // handled by useGroupStore
        set({
          messages: get().messages.map((m) => (m._id === updatedMessage._id ? updatedMessage : m)),
        });
      },
      viewOnceOpened: ({ messageId, groupId }) => {
        if (groupId) return; // group version is handled by useGroupStore
        set({
          messages: get().messages.map((m) =>
            m._id === messageId ? { ...m, viewOnceOpened: true } : m
          ),
        });
      },
      // `by` is the user who did the reading. Without checking it, ANY contact
      // opening their chat with you flipped the messages in your currently-open
      // conversation to "seen" — so you'd see double blue ticks for Carol
      // because Dave happened to read his own messages.
      messagesSeen: ({ by } = {}) => {
        if (by && by !== selectedUser._id) return;
        set({
          messages: get().messages.map((m) =>
            m.senderId === useAuthStore.getState().authUser?._id ? { ...m, status: "seen" } : m
          ),
        });
      },
      typing: ({ senderId }) => {
        if (senderId === selectedUser._id) set({ typingUserId: senderId });
      },
      stopTyping: ({ senderId }) => {
        if (senderId === selectedUser._id) set({ typingUserId: null });
      },
      // If the socket ever drops (dev server restart, brief network loss)
      // and reconnects, re-sync this conversation from the server instead
      // of trusting that no events were missed in the gap.
      connect: () => {
        get().getMessagesByUserId(selectedUser._id);
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    dmSocketHandlers = handlers;
  },

  // Note the ordering: the handler slot is cleared even when the socket is
  // already gone. On logout the socket is nulled *before* ChatPage unmounts, so
  // an early `if (!socket) return` would leave this slot populated — and then
  // the next login's subscribe call sees a non-null slot, assumes it's already
  // attached, and silently never subscribes. That's a dead session with no
  // sound and no live messages, so the slot must always be released.
  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (dmSocketHandlers) {
      if (socket) {
        Object.entries(dmSocketHandlers).forEach(([event, handler]) => socket.off(event, handler));
      }
      dmSocketHandlers = null;
    }
  },

  // Attaches session-global handlers that work regardless of which chat is
  // open. These stay attached for the entire session. This is what makes
  // notification sound play, unread badges appear, and a contact move to the
  // top of the Chats list when someone messages you while you're looking at a
  // different chat (or no chat at all).
  subscribeGlobalHandlers: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket || globalSocketHandlers) return;

    const handlers = {
      // For every incoming DM, play sound (if enabled) and bump unread count
      // unless the sender's chat is currently open. This global handler is
      // what makes messages from non-selected users actually arrive.
      newMessage: (message) => {
        if (message.groupId) return; // handled by useGroupStore

        const { selectedUser, isSoundEnabled, unreadCounts } = get();
        const isFromSelectedUser = selectedUser?._id === message.senderId;

        if (!isFromSelectedUser) {
          // Bump unread count for this sender.
          const nextUnread = {
            ...unreadCounts,
            [message.senderId]: (unreadCounts[message.senderId] || 0) + 1,
          };
          set({ unreadCounts: nextUnread });
          // Mirror the total onto the app icon, so an installed PWA shows a
          // count on the home screen the way a native chat app does.
          setAppBadge(Object.values(nextUnread).reduce((sum, n) => sum + n, 0));

          // Play sound. Without this global handler, sound only played when the
          // message arrived from someone whose chat you already had open — every
          // other message was silent.
          if (isSoundEnabled) {
            const notificationSound = new Audio("/sounds/notification.mp3");
            notificationSound.currentTime = 0;
            notificationSound.play().catch((e) => console.log("Audio play failed:", e));
          }
        }

        // Refresh the chats list so the sender appears at the top. The old code
        // never touched `chats`, so a new DM from someone you'd never talked to
        // before arrived in silence and they never appeared in the Chats tab
        // until you reloaded or switched tabs. This fetch means they appear
        // instantly the way WhatsApp does.
        get().getMyChatPartners({ quiet: true });
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    globalSocketHandlers = handlers;
  },

  unsubscribeGlobalHandlers: () => {
    const socket = useAuthStore.getState().socket;
    if (globalSocketHandlers) {
      if (socket) {
        Object.entries(globalSocketHandlers).forEach(([event, handler]) =>
          socket.off(event, handler)
        );
      }
      globalSocketHandlers = null;
    }
  },
}));
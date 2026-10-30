import { create } from "zustand";
import { api } from "../lib/api";

function newestFirst(chats) {
  return [...chats].sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt || 0) - new Date(a.lastMessage?.createdAt || a.updatedAt || 0));
}

export const useChatStore = create((set, get) => ({
  chats: [],
  searchResults: [],
  query: "",
  isLoading: false,
  isRefreshing: false,
  error: "",
  unreadCounts: {},
  loadChats: async ({ quiet = false, refresh = false } = {}) => {
    if (!quiet) set({ isLoading: !refresh, isRefreshing: refresh, error: "" });
    try {
      const response = await api("/messages/chats");
      const fresh = Array.isArray(response) ? response.filter(Boolean) : [];
      const old = get().chats;
      const next = fresh.map((person) => {
        const previous = old.find((item) => String(item._id) === String(person._id));
        return { ...previous, ...person };
      });
      const merged = quiet ? [...next, ...old.filter((item) => !next.some((freshItem) => String(freshItem._id) === String(item._id)))] : next;
      const unreadCounts = { ...get().unreadCounts };
      if (!quiet) Object.keys(unreadCounts).forEach((id) => { delete unreadCounts[id]; });
      fresh.forEach((person) => { unreadCounts[String(person._id)] = Number(person.unreadCount) || 0; });
      set({ chats: newestFirst(merged), unreadCounts });
    } catch (error) {
      if (!quiet) set({ error: error.message });
    } finally {
      if (!quiet) set({ isLoading: false, isRefreshing: false });
    }
  },
  searchUsers: async (query) => {
    set({ query });
    if (query.trim().length < 2) return set({ searchResults: [] });
    try {
      const results = await api(`/friends/search?q=${encodeURIComponent(query.trim())}`);
      if (get().query === query) set({ searchResults: results });
    } catch (error) {
      set({ error: error.message, searchResults: [] });
    }
  },
  rememberPerson: (person) => {
    if (!person?._id) return;
    const current = get().chats;
    if (!current.some((item) => String(item._id) === String(person._id))) set({ chats: [person, ...current] });
  },
  openChat: (person) => {
    const id = String(person._id);
    get().clearUnread(id);
  },
  clearUnread: (id) => {
    const key = String(id);
    const { chats, unreadCounts: currentCounts } = get();
    const count = Number(currentCounts[key]) || 0;
    const chat = chats.find((item) => String(item._id) === key);
    const rowCount = Number(chat?.unreadCount) || 0;
    if (!count && !rowCount) return;

    const unreadCounts = count ? { ...currentCounts, [key]: 0 } : currentCounts;
    const nextChats = rowCount
      ? chats.map((item) => String(item._id) === key ? { ...item, unreadCount: 0 } : item)
      : chats;
    set({ unreadCounts, chats: nextChats });
  },
  updateFromMessage: (message, currentUserId, isOpen) => {
    const otherId = String(message.senderId) === String(currentUserId) ? String(message.receiverId) : String(message.senderId);
    if (!otherId || otherId === "undefined") return;
    const current = get().chats;
    const chat = current.find((item) => String(item._id) === otherId);
    if (!chat) {
      get().loadChats({ quiet: true });
      return;
    }
    const unread = String(message.receiverId) === String(currentUserId) && !isOpen
      ? (Number(chat.unreadCount ?? get().unreadCounts[otherId]) || 0) + 1
      : String(message.receiverId) === String(currentUserId) ? 0 : Number(chat.unreadCount ?? get().unreadCounts[otherId]) || 0;
    const updated = { ...chat, lastMessage: message, unreadCount: unread };
    const chats = newestFirst([updated, ...current.filter((item) => String(item._id) !== otherId)]);
    const unreadCounts = { ...get().unreadCounts };
    unreadCounts[otherId] = unread;
    set({ chats, unreadCounts });
  },
  applyDelivered: (messageId) => set({
    chats: get().chats.map((chat) => String(chat.lastMessage?._id) === String(messageId)
      ? { ...chat, lastMessage: { ...chat.lastMessage, status: "delivered" } }
      : chat),
  }),
  applySeen: (partnerId) => set({
    chats: get().chats.map((chat) => String(chat._id) === String(partnerId) && String(chat.lastMessage?.senderId) !== String(partnerId)
      ? { ...chat, lastMessage: { ...chat.lastMessage, status: "seen" } }
      : chat),
  }),
  applyMessageUpdate: (message) => set({
    chats: get().chats.map((chat) => String(chat.lastMessage?._id) === String(message?._id)
      ? { ...chat, lastMessage: { ...chat.lastMessage, ...message } }
      : chat),
  }),
  markFriendAdded: (person) => {
    if (!person?._id) return;
    set({ chats: get().chats.map((item) => String(item._id) === String(person._id) ? { ...item, ...person, isFriend: true, isRequest: false } : item) });
  },
  updateMessage: (message) => set({ chats: get().chats.map((chat) => String(chat._id) === String(message.receiverId || message.senderId) ? { ...chat, lastMessage: message } : chat) }),
  reset: () => set({ chats: [], searchResults: [], query: "", isLoading: false, isRefreshing: false, error: "", unreadCounts: {} }),
}));

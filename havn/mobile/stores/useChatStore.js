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
      const fresh = await api("/messages/chats");
      const old = get().chats;
      const next = fresh.map((person) => {
        const previous = old.find((item) => String(item._id) === String(person._id));
        return { ...previous, ...person };
      });
      const merged = quiet ? [...next, ...old.filter((item) => !next.some((freshItem) => String(freshItem._id) === String(item._id)))] : next;
      set({ chats: newestFirst(merged) });
      get().hydrateChatPreviews(merged);
    } catch (error) {
      if (!quiet) set({ error: error.message });
    } finally {
      if (!quiet) set({ isLoading: false, isRefreshing: false });
    }
  },
  hydrateChatPreviews: async (partners) => {
    const { authUser } = (await import("./useAuthStore")).useAuthStore.getState();
    if (!authUser?._id || !partners.length) return;
    const unreadCounts = { ...get().unreadCounts };
    const summaries = [];
    for (let start = 0; start < partners.length; start += 5) {
      const batch = partners.slice(start, start + 5);
      const result = await Promise.all(batch.map(async (partner) => {
        try {
          const messages = await api(`/messages/${partner._id}`);
          const ordered = [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          const lastMessage = ordered[ordered.length - 1] || null;
          const unread = ordered.filter((message) => String(message.receiverId) === String(authUser._id) && message.status !== "seen").length;
          if (unread) unreadCounts[partner._id] = unread;
          else delete unreadCounts[partner._id];
          return { id: partner._id, lastMessage, unread };
        } catch {
          return null;
        }
      }));
      summaries.push(...result.filter(Boolean));
    }
    set({
      chats: newestFirst(get().chats.map((chat) => {
        const summary = summaries.find((item) => String(item.id) === String(chat._id));
        return summary ? { ...chat, lastMessage: summary.lastMessage } : chat;
      })),
      unreadCounts,
    });
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
    set({ unreadCounts: { ...get().unreadCounts, [id]: 0 } });
  },
  clearUnread: (id) => {
    const unreadCounts = { ...get().unreadCounts };
    delete unreadCounts[String(id)];
    set({ unreadCounts });
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
    const updated = { ...chat, lastMessage: message };
    const chats = newestFirst([updated, ...current.filter((item) => String(item._id) !== otherId)]);
    const unreadCounts = { ...get().unreadCounts };
    if (String(message.receiverId) === String(currentUserId) && !isOpen) unreadCounts[otherId] = (unreadCounts[otherId] || 0) + 1;
    set({ chats, unreadCounts });
  },
  markFriendAdded: (person) => {
    if (!person?._id) return;
    set({ chats: get().chats.map((item) => String(item._id) === String(person._id) ? { ...item, ...person, isFriend: true, isRequest: false } : item) });
  },
  updateMessage: (message) => set({ chats: get().chats.map((chat) => String(chat._id) === String(message.receiverId || message.senderId) ? { ...chat, lastMessage: message } : chat) }),
  reset: () => set({ chats: [], searchResults: [], query: "", isLoading: false, isRefreshing: false, error: "", unreadCounts: {} }),
}));

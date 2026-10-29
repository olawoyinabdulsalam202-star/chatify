import { create } from "zustand";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";

const mergeById = (current, fresh) => {
  const map = new Map(current.map((item) => [String(item._id), item]));
  fresh.forEach((item) => map.set(String(item._id), { ...map.get(String(item._id)), ...item }));
  return [...map.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

export const useMessageStore = create((set, get) => ({
  openPartner: null,
  messages: [],
  visibleCount: 30,
  isLoading: false,
  isSending: false,
  isTyping: false,
  replyTarget: null,
  error: "",
  openChat: async (partner) => {
    const same = String(get().openPartner?._id) === String(partner._id);
    set({ openPartner: partner, messages: same ? get().messages : [], visibleCount: 30, isTyping: false, replyTarget: null, error: "" });
    if (!same) await get().loadMessages(partner._id);
    else await get().loadMessages(partner._id, { quiet: true });
    get().markSeen(partner._id);
  },
  closeChat: () => set({ openPartner: null, isTyping: false, replyTarget: null }),
  loadMessages: async (partnerId, { quiet = false } = {}) => {
    if (!quiet) set({ isLoading: true, error: "" });
    try {
      const fresh = await api(`/messages/${partnerId}`);
      const messages = [...fresh].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      set({ messages: quiet ? mergeById(get().messages, messages) : messages, visibleCount: Math.max(30, get().visibleCount) });
    } catch (error) {
      if (!quiet) set({ error: error.message });
    } finally {
      if (!quiet) set({ isLoading: false });
    }
  },
  syncOpenChat: () => {
    const partner = get().openPartner;
    if (partner?._id) return get().loadMessages(partner._id, { quiet: true });
  },
  loadOlder: () => set({ visibleCount: Math.min(get().messages.length, get().visibleCount + 30) }),
  markSeen: async (partnerId) => {
    try {
      await api(`/messages/seen/${partnerId}`, { method: "PUT" });
      set({ messages: get().messages.map((message) => String(message.senderId) === String(partnerId) ? { ...message, status: "seen" } : message) });
    } catch {}
  },
  send: async (payload) => {
    const partner = get().openPartner;
    if (!partner?._id || get().isSending) return;
    set({ isSending: true, error: "" });
    const auth = (await import("./useAuthStore")).useAuthStore.getState();
    const tempId = `local-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      senderId: auth.authUser?._id,
      receiverId: partner._id,
      text: payload.text || "",
      image: payload.image,
      createdAt: new Date().toISOString(),
      status: "sent",
      replyTo: get().replyTarget ? { messageId: get().replyTarget._id, senderId: get().replyTarget.senderId, text: get().replyTarget.text || "Photo" } : undefined,
      isOptimistic: true,
    };
    set({ messages: [...get().messages, optimistic], replyTarget: null });
    try {
      const result = await api(`/messages/send/${partner._id}`, {
        method: "POST",
        body: { ...payload, replyToId: optimistic.replyTo?.messageId },
      });
      set({ messages: mergeById(get().messages.filter((item) => item._id !== tempId), [result]) });
      const chatStore = (await import("./useChatStore")).useChatStore;
      chatStore.getState().updateFromMessage(result, auth.authUser?._id, true);
      return result;
    } catch (error) {
      set({ messages: get().messages.filter((item) => item._id !== tempId), error: error.message });
      throw error;
    } finally {
      set({ isSending: false });
    }
  },
  receiveMessage: (message) => {
    if (!message?.receiverId || !get().openPartner) return false;
    const partnerId = String(get().openPartner._id);
    const belongs = String(message.senderId) === partnerId || String(message.receiverId) === partnerId;
    if (!belongs) return false;
    set({ messages: mergeById(get().messages, [message]) });
    if (String(message.senderId) === partnerId) get().markSeen(partnerId);
    return true;
  },
  applyDelivered: (messageId) => set({ messages: get().messages.map((message) => String(message._id) === String(messageId) ? { ...message, status: "delivered" } : message) }),
  applySeen: (senderId) => set({ messages: get().messages.map((message) => String(message.receiverId) === String(senderId) ? { ...message, status: "seen" } : message) }),
  applyEdited: (updated) => set({ messages: get().messages.map((message) => String(message._id) === String(updated._id) ? { ...message, ...updated } : message) }),
  applyDeleted: (updated) => set({ messages: get().messages.map((message) => String(message._id) === String(updated._id) ? { ...message, ...updated } : message) }),
  setReplyTarget: (message) => set({ replyTarget: message }),
  emitTyping: () => {
    const receiverId = get().openPartner?._id;
    if (receiverId) getSocket()?.emit("typing", { receiverId });
  },
  emitStopTyping: () => {
    const receiverId = get().openPartner?._id;
    if (receiverId) getSocket()?.emit("stopTyping", { receiverId });
  },
  setTyping: (value) => set({ isTyping: value }),
  reset: () => set({ openPartner: null, messages: [], visibleCount: 30, isLoading: false, isSending: false, isTyping: false, replyTarget: null, error: "" }),
}));

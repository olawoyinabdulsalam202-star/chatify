import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useChatStore } from "./useChatStore";
import { useGroupStore } from "./useGroupStore";
import { useAuthStore } from "./useAuthStore";

let temporaryId = 0;
let historyRequest = 0;
const nextTemporaryId = () => `assistant-temp-${Date.now()}-${++temporaryId}`;

const mergeMessages = (current, incoming) => {
  const byId = new Map(current.map((message) => [message._id, message]));
  incoming.forEach((message) => byId.set(message._id, message));
  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

export const useAssistantStore = create((set, get) => ({
  isOpen: false,
  messages: [],
  ownerId: null,
  isSending: false,
  isLoadingHistory: false,
  hasMore: false,
  errorMessage: null,
  failedMessageId: null,
  failedText: "",

  open: () => {
    clearConversationSelection();
    set({ isOpen: true });
  },
  close: () => set({ isOpen: false }),

  loadHistory: async () => {
    const userId = useAuthStore.getState().authUser?._id;
    if (!userId || (get().isLoadingHistory && get().ownerId === userId)) return;
    const isNewOwner = get().ownerId !== userId;
    const requestId = ++historyRequest;
    if (isNewOwner) {
      set({
        ownerId: userId,
        messages: [],
        hasMore: false,
        isSending: false,
        errorMessage: null,
        failedMessageId: null,
        failedText: "",
      });
    }

    set({ isLoadingHistory: true });
    try {
      const { data } = await axiosInstance.get("/assistant/messages", { params: { limit: 30 } });
      if (
        requestId !== historyRequest ||
        get().ownerId !== userId ||
        useAuthStore.getState().authUser?._id !== userId
      ) return;
      const current = get().messages;
      set({ messages: mergeMessages(current, data.messages), hasMore: data.hasMore });
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't load Havn AI chat.");
    } finally {
      if (requestId === historyRequest && get().ownerId === userId) {
        set({ isLoadingHistory: false });
      }
    }
  },

  loadOlder: async () => {
    const { messages, hasMore, isLoadingHistory } = get();
    const oldestId = messages[0]?._id;
    const userId = useAuthStore.getState().authUser?._id;
    if (!userId || !hasMore || !oldestId || isLoadingHistory) return;

    const requestId = ++historyRequest;
    set({ isLoadingHistory: true });
    try {
      const { data } = await axiosInstance.get("/assistant/messages", {
        params: { before: oldestId, limit: 30 },
      });
      if (
        requestId !== historyRequest ||
        get().ownerId !== userId ||
        useAuthStore.getState().authUser?._id !== userId
      ) return;
      set({ messages: mergeMessages(get().messages, data.messages), hasMore: data.hasMore });
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't load older messages.");
    } finally {
      if (requestId === historyRequest && get().ownerId === userId) {
        set({ isLoadingHistory: false });
      }
    }
  },

  send: async (rawText) => {
    const text = rawText.trim();
    const userId = useAuthStore.getState().authUser?._id;
    if (!userId || !text || text.length > 2000 || get().isSending) return false;

    const failedMessageId = get().failedMessageId;
    const message = {
      _id: nextTemporaryId(),
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      isPending: true,
    };
    set((state) => ({
      messages: [...state.messages.filter((item) => item._id !== failedMessageId), message],
      ownerId: userId,
      isSending: true,
      errorMessage: null,
      failedMessageId: null,
      failedText: "",
    }));

    try {
      const { data } = await axiosInstance.post("/assistant/messages", { text });
      if (get().ownerId !== userId || useAuthStore.getState().authUser?._id !== userId) return false;
      set((state) => ({
        messages: mergeMessages(
          state.messages.filter((item) => item._id !== message._id),
          [data.userMessage, data.assistantMessage]
        ),
        isSending: false,
      }));
      return true;
    } catch (error) {
      if (get().ownerId !== userId || useAuthStore.getState().authUser?._id !== userId) return false;
      const messageText = error.response?.data?.message || "Havn AI couldn't reply. Please try again.";
      set((state) => ({
        messages: state.messages.map((item) =>
          item._id === message._id ? { ...item, isPending: false, hasFailed: true } : item
        ),
        isSending: false,
        errorMessage: messageText,
        failedMessageId: message._id,
        failedText: text,
      }));
      return false;
    }
  },

  retry: () => {
    const text = get().failedText;
    return text ? get().send(text) : false;
  },

  clear: async () => {
    if (get().isSending) return false;
    const userId = useAuthStore.getState().authUser?._id;
    if (!userId) return false;
    try {
      await axiosInstance.delete("/assistant/messages");
      if (get().ownerId !== userId || useAuthStore.getState().authUser?._id !== userId) return false;
      set({ messages: [], hasMore: false, errorMessage: null, failedMessageId: null, failedText: "" });
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't clear Havn AI chat.");
      return false;
    }
  },
}));

function clearConversationSelection() {
  useChatStore.getState().setSelectedUser(null);
  useGroupStore.getState().setSelectedGroup(null);
  useChatStore.getState().setActiveTab("chats");
}

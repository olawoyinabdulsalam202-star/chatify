import { create } from "zustand";
import { api } from "../lib/api";

let temporaryId = 0;
let historyRequest = 0;

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [String(message._id), message]));
  incoming.forEach((message) => byId.set(String(message._id), message));
  return [...byId.values()].sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
}

export const useAssistantStore = create((set, get) => ({
  messages: [],
  ownerId: null,
  hasMore: false,
  isLoading: false,
  isLoadingOlder: false,
  isSending: false,
  error: "",
  errorType: "",
  failedMessageId: null,
  failedText: "",
  loadHistory: async () => {
    const { useAuthStore } = await import("./useAuthStore");
    const userId = useAuthStore.getState().authUser?._id;
    if (!userId) return false;
    if ((get().isLoading || get().isLoadingOlder) && get().ownerId === userId) return false;
    const requestId = ++historyRequest;
    if (get().ownerId !== userId) {
      set({ messages: [], ownerId: userId, hasMore: false, isLoadingOlder: false, isSending: false, failedMessageId: null, failedText: "" });
    }
    set({ isLoading: true, error: "", errorType: "" });
    try {
      const result = await api("/assistant/messages?limit=30");
      if (requestId !== historyRequest || get().ownerId !== userId || useAuthStore.getState().authUser?._id !== userId) return false;
      set({ messages: mergeMessages(get().messages, result.messages || []), hasMore: !!result.hasMore });
      return true;
    } catch (error) {
      if (requestId === historyRequest && get().ownerId === userId) {
        set({ error: error.message, errorType: "history" });
      }
      return false;
    } finally {
      if (requestId === historyRequest && get().ownerId === userId) set({ isLoading: false });
    }
  },
  loadOlder: async () => {
    const { useAuthStore } = await import("./useAuthStore");
    const { messages, hasMore, isLoading, isLoadingOlder } = get();
    const userId = useAuthStore.getState().authUser?._id;
    const oldestId = messages.find((message) => !String(message._id).startsWith("assistant-temp-"))?._id;
    if (!userId || !hasMore || !oldestId || isLoading || isLoadingOlder) return false;
    const requestId = ++historyRequest;
    set({ isLoadingOlder: true, error: "", errorType: "" });
    try {
      const result = await api(`/assistant/messages?before=${encodeURIComponent(oldestId)}&limit=30`);
      if (requestId !== historyRequest || get().ownerId !== userId || useAuthStore.getState().authUser?._id !== userId) return false;
      set({ messages: mergeMessages(get().messages, result.messages || []), hasMore: !!result.hasMore });
      return true;
    } catch (error) {
      if (requestId === historyRequest && get().ownerId === userId) set({ error: error.message, errorType: "older" });
      return false;
    } finally {
      if (requestId === historyRequest && get().ownerId === userId) set({ isLoadingOlder: false });
    }
  },
  send: async (rawText) => {
    const text = typeof rawText === "string" ? rawText.trim() : "";
    const { useAuthStore } = await import("./useAuthStore");
    const userId = useAuthStore.getState().authUser?._id;
    if (!userId || !text || text.length > 2000 || get().isSending) return false;

    const failedMessageId = get().failedMessageId;
    const userMessage = {
      _id: `assistant-temp-${Date.now()}-${++temporaryId}`,
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      isPending: true,
    };
    set((state) => ({
      messages: [...state.messages.filter((message) => message._id !== failedMessageId), userMessage],
      ownerId: userId,
      isSending: true,
      error: "",
      errorType: "",
      failedMessageId: null,
      failedText: "",
    }));
    try {
      const result = await api("/assistant/messages", { method: "POST", body: { text } });
      if (get().ownerId !== userId || useAuthStore.getState().authUser?._id !== userId) return false;
      set((state) => ({
        messages: mergeMessages(state.messages.filter((message) => message._id !== userMessage._id), [result.userMessage, result.assistantMessage]),
        isSending: false,
      }));
      return true;
    } catch (error) {
      if (get().ownerId !== userId || useAuthStore.getState().authUser?._id !== userId) return false;
      set((state) => ({
        messages: state.messages.map((message) => message._id === userMessage._id ? { ...message, isPending: false, hasFailed: true } : message),
        isSending: false,
        error: error.message,
        errorType: "send",
        failedMessageId: userMessage._id,
        failedText: text,
      }));
      return false;
    } finally {
      if (get().ownerId === userId) set({ isSending: false });
    }
  },
  retry: () => {
    const { errorType, failedText } = get();
    if (errorType === "send" && failedText) return get().send(failedText);
    if (errorType === "older") return get().loadOlder();
    if (errorType === "clear") return get().clear();
    return get().loadHistory();
  },
  clear: async () => {
    if (get().isSending) return false;
    const { useAuthStore } = await import("./useAuthStore");
    const userId = useAuthStore.getState().authUser?._id;
    if (!userId) return false;
    const requestId = ++historyRequest;
    set({ error: "", errorType: "", isLoading: false, isLoadingOlder: false });
    try {
      await api("/assistant/messages", { method: "DELETE" });
      if (requestId !== historyRequest || get().ownerId !== userId || useAuthStore.getState().authUser?._id !== userId) return false;
      set({ messages: [], hasMore: false, failedMessageId: null, failedText: "", error: "", errorType: "" });
      return true;
    } catch (error) {
      if (requestId === historyRequest && get().ownerId === userId) set({ error: error.message, errorType: "clear" });
      return false;
    }
  },
  reset: () => {
    historyRequest += 1;
    set({ messages: [], ownerId: null, hasMore: false, isLoading: false, isLoadingOlder: false, isSending: false, error: "", errorType: "", failedMessageId: null, failedText: "" });
  },
}));

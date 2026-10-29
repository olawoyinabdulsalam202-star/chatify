import { create } from "zustand";
import { api } from "../lib/api";

export const useAssistantStore = create((set, get) => ({
  messages: [],
  hasMore: false,
  isLoading: false,
  isSending: false,
  error: "",
  loadHistory: async () => {
    set({ isLoading: true, error: "" });
    try {
      const result = await api("/assistant/messages?limit=30");
      set({ messages: result.messages || [], hasMore: !!result.hasMore });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
  send: async (text) => {
    if (get().isSending || !text.trim()) return;
    set({ isSending: true, error: "" });
    try {
      const result = await api("/assistant/messages", { method: "POST", body: { text: text.trim() } });
      set({ messages: [...get().messages, result.userMessage, result.assistantMessage] });
      return result;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isSending: false });
    }
  },
  clear: async () => {
    await api("/assistant/messages", { method: "DELETE" });
    set({ messages: [], hasMore: false, error: "" });
  },
  reset: () => set({ messages: [], hasMore: false, isLoading: false, isSending: false, error: "" }),
}));

import { create } from "zustand";
import { api } from "../lib/api";

export const useBlockedStore = create((set, get) => ({
  contacts: [],
  isLoading: false,
  error: "",
  load: async () => {
    set({ isLoading: true, error: "" });
    try {
      const contacts = await api("/friends/blocked");
      set({ contacts: Array.isArray(contacts) ? contacts : [], isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.message || "Couldn't load blocked contacts.", isLoading: false });
      return false;
    }
  },
  block: (contact) => set((state) => ({ contacts: state.contacts.some((item) => String(item._id) === String(contact._id)) ? state.contacts : [...state.contacts, contact] })),
  unblock: async (id) => {
    try {
      await api(`/friends/unblock/${id}`, { method: "POST" });
      set((state) => ({ contacts: state.contacts.filter((item) => String(item._id) !== String(id)) }));
      return true;
    } catch (error) {
      set({ error: error.message || "Couldn't unblock this contact." });
      return false;
    }
  },
}));

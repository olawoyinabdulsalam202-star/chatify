import { create } from "zustand";

export const usePresenceStore = create((set, get) => ({
  onlineUsers: [],
  setOnlineUsers: (ids) => set({ onlineUsers: Array.isArray(ids) ? ids.map(String) : [] }),
  setPresence: (userId, online) => {
    const current = get().onlineUsers;
    const id = String(userId);
    if (online && !current.includes(id)) set({ onlineUsers: [...current, id] });
    if (!online && current.includes(id)) set({ onlineUsers: current.filter((value) => value !== id) });
  },
  reset: () => set({ onlineUsers: [] }),
}));

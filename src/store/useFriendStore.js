import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

let friendSocketHandlers = null;

export const useFriendStore = create((set, get) => ({
  // Ids of the people you're connected to. The DM gate keys off this and
  // ForwardModal filters its recipient list against it, so it stays a flat
  // array of ids — not user objects.
  friends: [],

  fetchStatus: async () => {
    try {
      const res = await axiosInstance.get("/friends/status");
      set({ friends: res.data.friends });
    } catch (error) {
      console.log("Error fetching friend status:", error);
    }
  },

  // The debounce lives in the caller (AddPeopleModal); this just returns the
  // results array so the component can hold them in local state. A blank or
  // too-short query never reaches the server.
  searchUsers: async (q) => {
    const query = (q || "").trim();
    if (query.length < 2) return [];
    try {
      const res = await axiosInstance.get("/friends/search", { params: { q: query } });
      return res.data;
    } catch (error) {
      console.log("Error searching users:", error);
      return [];
    }
  },

  // WhatsApp-style: adding by handle connects instantly and returns the
  // connected user so the caller can open the chat. On failure the server's
  // message ("No account with that username", etc.) is surfaced.
  addByUsername: async (username) => {
    try {
      const res = await axiosInstance.post("/friends/add", { username });
      const user = res.data;
      if (!get().friends.includes(user._id)) {
        set({ friends: [...get().friends, user._id] });
      }
      return user;
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't add that user");
      return null;
    }
  },

  removeFriend: async (userId) => {
    try {
      await axiosInstance.delete(`/friends/${userId}`);
      set({ friends: get().friends.filter((id) => id !== userId) });
      toast.success("Removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't remove");
    }
  },

  subscribeToFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    const handlers = {
      // Someone added you. The connection is already mutual on the server, so
      // record it locally and refresh the chats list so they can surface there.
      friendAdded: ({ by }) => {
        if (!get().friends.includes(by._id)) {
          set({ friends: [...get().friends, by._id] });
        }
        toast.success(`@${by.username} added you`);
        useChatStore.getState().getMyChatPartners({ quiet: true });
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    friendSocketHandlers = handlers;
  },

  // Releases the handler slot even when the socket is already gone — logout
  // nulls the socket before ChatPage unmounts, and an early return here would
  // leave the slot filled so the next login never re-subscribes.
  unsubscribeFromFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!friendSocketHandlers) return;
    if (socket) {
      Object.entries(friendSocketHandlers).forEach(([event, handler]) => socket.off(event, handler));
    }
    friendSocketHandlers = null;
  },
}));

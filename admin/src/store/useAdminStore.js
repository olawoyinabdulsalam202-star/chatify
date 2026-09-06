import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

const DEFAULT_QUERY = { search: "", filter: "all", page: 1 };
const PAGE_SIZE = 25;

// All the data behind the console: the headline stats and the paginated,
// searchable, filterable user list, plus the moderation actions. Every action
// maps 1:1 to an existing /api/admin endpoint — nothing here adds backend
// behavior, it only drives what's already there.
export const useAdminStore = create((set, get) => ({
  stats: null,
  isLoadingStats: false,

  users: [],
  total: 0,
  pages: 1,
  query: { ...DEFAULT_QUERY },
  isLoadingUsers: false,
  actioningId: null, // id of the user whose row action is in flight

  getStats: async () => {
    set({ isLoadingStats: true });
    try {
      const res = await axiosInstance.get("/admin/stats");
      set({ stats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't load stats");
    } finally {
      set({ isLoadingStats: false });
    }
  },

  // Merges any passed fields over the stored query, so callers can change just
  // the page or just the filter without restating the rest.
  getUsers: async (partial = {}) => {
    const query = { ...get().query, ...partial };
    set({ isLoadingUsers: true, query });
    try {
      const res = await axiosInstance.get("/admin/users", {
        params: { ...query, limit: PAGE_SIZE },
      });
      set({
        users: res.data.users,
        total: res.data.total,
        pages: res.data.pages,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't load users");
    } finally {
      set({ isLoadingUsers: false });
    }
  },

  banUser: async (id, reason = "") => {
    set({ actioningId: id });
    try {
      await axiosInstance.put(`/admin/users/${id}/ban`, { reason });
      set({
        users: get().users.map((u) =>
          u._id === id ? { ...u, isBanned: true, banReason: reason } : u
        ),
      });
      toast.success("User banned");
      get().getStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to ban user");
    } finally {
      set({ actioningId: null });
    }
  },

  unbanUser: async (id) => {
    set({ actioningId: id });
    try {
      await axiosInstance.put(`/admin/users/${id}/unban`);
      set({
        users: get().users.map((u) =>
          u._id === id ? { ...u, isBanned: false, banReason: "" } : u
        ),
      });
      toast.success("User unbanned");
      get().getStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to unban user");
    } finally {
      set({ actioningId: null });
    }
  },

  setBadge: async (id, badged) => {
    set({ actioningId: id });
    try {
      await axiosInstance.put(`/admin/users/${id}/badge`, { badged });
      set({
        users: get().users.map((u) => (u._id === id ? { ...u, isBadged: badged } : u)),
      });
      toast.success(badged ? "Badge granted" : "Badge removed");
      get().getStats();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update badge");
    } finally {
      set({ actioningId: null });
    }
  },

  deleteUser: async (id) => {
    set({ actioningId: id });
    try {
      await axiosInstance.delete(`/admin/users/${id}`);
      toast.success("User deleted");
      // Refetch the current page rather than just splicing the row — a delete
      // shifts everything, and refetching keeps the count and page contents
      // honest (and pulls in the row that slid up from the next page).
      await Promise.all([get().getUsers(), get().getStats()]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete user");
    } finally {
      set({ actioningId: null });
    }
  },
}));

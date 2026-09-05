import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

export const useAdminStore = create((set, get) => ({
  users: [],
  total: 0,
  page: 1,
  pages: 1,
  search: "",
  filter: "all", // all | banned | badged | admins
  stats: null,
  isLoading: false,

  setSearch: (search) => set({ search }),
  setFilter: (filter) => set({ filter }),

  fetchStats: async () => {
    try {
      const res = await axiosInstance.get("/admin/stats");
      set({ stats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load stats");
    }
  },

  fetchUsers: async (page = 1) => {
    set({ isLoading: true });
    try {
      const { search, filter } = get();
      const res = await axiosInstance.get("/admin/users", {
        params: { search, filter, page, limit: 20 },
      });
      set({ users: res.data.users, total: res.data.total, page: res.data.page, pages: res.data.pages });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load users");
    } finally {
      set({ isLoading: false });
    }
  },

  banUser: async (userId, reason) => {
    try {
      await axiosInstance.put(`/admin/users/${userId}/ban`, { reason });
      set({ users: get().users.map((u) => (u._id === userId ? { ...u, isBanned: true, banReason: reason } : u)) });
      toast.success("User banned");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to ban user");
    }
  },

  unbanUser: async (userId) => {
    try {
      await axiosInstance.put(`/admin/users/${userId}/unban`);
      set({ users: get().users.map((u) => (u._id === userId ? { ...u, isBanned: false, banReason: "" } : u)) });
      toast.success("User unbanned");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to unban user");
    }
  },

  deleteUser: async (userId) => {
    try {
      await axiosInstance.delete(`/admin/users/${userId}`);
      set({ users: get().users.filter((u) => u._id !== userId), total: get().total - 1 });
      toast.success("User deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete user");
    }
  },

  setUserBadge: async (userId, badged) => {
    try {
      await axiosInstance.put(`/admin/users/${userId}/badge`, { badged });
      set({ users: get().users.map((u) => (u._id === userId ? { ...u, isBadged: badged } : u)) });
      toast.success(badged ? "Badge granted" : "Badge removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update badge");
    }
  },
}));

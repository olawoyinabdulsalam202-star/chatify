import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

// Auth for the admin console. It reuses the platform's own /auth endpoints —
// there's no separate admin credential — and simply refuses anyone whose
// account isn't flagged isAdmin. The backend enforces this independently on
// every /admin route (requireAdmin), so this check is a UX gate, not the
// security boundary.
export const useAdminAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isLoggingIn: false,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      // A valid session that isn't an admin is treated as logged-out here.
      set({ authUser: res.data?.isAdmin ? res.data : null });
    } catch {
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  login: async ({ email, password }) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", { email, password });
      if (!res.data?.isAdmin) {
        // The cookie is set at this point, but this account can't use the
        // console. Log it straight back out so no half-authenticated session
        // lingers, and tell them plainly.
        try {
          await axiosInstance.post("/auth/logout");
        } catch {
          // best-effort — the guard below is what actually protects the app
        }
        toast.error("This account doesn't have admin access.");
        return;
      }
      set({ authUser: res.data });
      toast.success("Signed in");
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
    } catch {
      // Even if the request fails, drop the local session so the UI locks.
    }
    set({ authUser: null });
  },
}));

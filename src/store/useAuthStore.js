import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { BACKEND_URL } from "../lib/config";

// Presence watchers are attached to `window` once per page load, not once per
// connect — otherwise every reconnect would stack another duplicate listener.
let presenceWatchersAttached = false;

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  isVerifyingOtp: false,
  pendingVerificationEmail: null, // set after signup, or after a login blocked by "unverified"
  socket: null,
  onlineUsers: [],

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in authCheck:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      // No auto-login anymore — account needs OTP verification first.
      set({ pendingVerificationEmail: res.data.email });
      toast.success(res.data.message || "Check your email for a verification code");
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  verifyOtp: async ({ email, otp }) => {
    set({ isVerifyingOtp: true });
    try {
      const res = await axiosInstance.post("/auth/verify-otp", { email, otp });
      set({ authUser: res.data, pendingVerificationEmail: null });
      toast.success("Email verified — welcome!");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Verification failed");
    } finally {
      set({ isVerifyingOtp: false });
    }
  },

  resendOtp: async (email) => {
    try {
      const res = await axiosInstance.post("/auth/resend-otp", { email });
      toast.success(res.data.message || "Code resent");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resend code");
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });

      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      if (error.response?.data?.needsVerification) {
        set({ pendingVerificationEmail: error.response.data.email });
      }
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
      await get().clearUserScopedState();
    } catch (error) {
      toast.error("Error logging out");
      console.log("Logout error:", error);
    }
  },

  // Wipes per-account state out of the other stores on logout.
  //
  // Those stores hold module-level state that outlives a logout, so the next
  // person to sign in on the same tab briefly saw the previous user's open
  // conversation, cached messages, groups and stories. In an app built around
  // members staying anonymous, that's a leak, not a cosmetic glitch.
  //
  // The imports are dynamic on purpose: those stores already import this one,
  // and a static import back would make the cycle load-bearing at module-eval
  // time. Resolving them here, inside an async function, means both modules are
  // always fully initialised before either is touched.
  clearUserScopedState: async () => {
    const [{ useChatStore }, { useGroupStore }, { useStoryStore }, { useStickerStore }] =
      await Promise.all([
        import("./useChatStore"),
        import("./useGroupStore"),
        import("./useStoryStore"),
        import("./useStickerStore"),
      ]);
    useChatStore.getState().resetChatState?.();
    useGroupStore.getState().resetGroupState?.();
    useStoryStore.getState().resetStoryState?.();
    useStickerStore.getState().clearStickerState?.();
  },

  updateProfile: async (data) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("Error in update profile:", error);
      toast.error(error.response.data.message);
    }
  },

  // Change the unique @handle. The server enforces the 7-day cooldown, the
  // format, and uniqueness, so this just relays its message and returns whether
  // it worked — letting the Account screen stay in edit mode on failure.
  updateUsername: async (username) => {
    try {
      const res = await axiosInstance.put("/auth/username", { username });
      set({ authUser: res.data });
      toast.success("Username updated");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update username");
      return false;
    }
  },

  updateSettings: async (data) => {
    try {
      const res = await axiosInstance.put("/auth/settings", data);
      set({ authUser: res.data });
      toast.success("Settings saved");
    } catch (error) {
      console.log("Error in update settings:", error);
      toast.error(error.response?.data?.message || "Failed to save settings");
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser) return;

    const existing = get().socket;
    if (existing) {
      // Reuse the instance instead of building a new one. ChatPage registers
      // the call/story/group/friend handlers against whatever socket object
      // existed at mount — swapping in a fresh instance would silently orphan
      // all of them, so a dead socket gets revived, never replaced.
      if (!existing.connected) existing.connect();
      return;
    }

    const socket = io(BACKEND_URL, {
      withCredentials: true, // this ensures cookies are sent with the connection
      // Render free instances sleep and cold-start slowly, and some mobile
      // networks/proxies block raw websockets outright. Starting on polling
      // means the handshake still succeeds there; socket.io upgrades to
      // websocket by itself once it proves the transport works.
      transports: ["polling", "websocket"],
      // Presence must survive tunnels, lock screens, and backgrounded PWAs, so
      // reconnection never gives up.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.connect();

    set({ socket });

    socket.on("connect_error", (error) => {
      // Previously this failed silently, which is why a totally unreachable
      // backend looked identical to "everyone is just offline".
      console.log("Socket connect_error:", error?.message || error, "->", BACKEND_URL);
    });

    // listen for online users event
    socket.on("getOnlineUsers", (userIds) => {
      const previous = get().onlineUsers;
      set({ onlineUsers: userIds });

      // Someone just left the online set. Their lastSeenAt was written at that
      // moment, but every user object this client already holds was fetched
      // *before* that write — so without a refetch the lists and the open chat
      // header keep showing "Offline" with no timestamp to format. Quiet mode
      // skips the loading skeleton so the sidebar doesn't flash.
      const wentOffline = previous.some((id) => !userIds.includes(id));
      if (wentOffline) {
        import("./useChatStore").then(({ useChatStore }) => {
          const chat = useChatStore.getState();
          chat.getMyChatPartners({ quiet: true });
          chat.getAllContacts({ quiet: true });
        });
      }
    });

    socket.on("accountBanned", ({ reason }) => {
      toast.error(reason ? `Your account was banned: ${reason}` : "Your account was banned.");
      get().logout();
    });

    socket.on("accountDeleted", () => {
      toast.error("Your account was deleted by an admin.");
      set({ authUser: null });
      get().disconnectSocket();
    });

    socket.on("badgeUpdated", ({ isBadged }) => {
      const { authUser } = get();
      if (authUser) set({ authUser: { ...authUser, isBadged } });
      toast.success(isBadged ? "You've been badge-verified." : "Your badge was removed.");
    });

    if (presenceWatchersAttached) return;
    presenceWatchersAttached = true;

    // A backgrounded tab or a PWA resumed from the app switcher often has its
    // socket quietly killed by the OS without a close event ever firing. These
    // nudge it back the moment the user returns or the network comes back, so
    // "app open and online" actually means visible-to-everyone.
    const revive = () => {
      const current = useAuthStore.getState();
      if (current.authUser && !current.socket?.connected) current.connectSocket();
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") revive();
    });
    window.addEventListener("online", revive);
    window.addEventListener("focus", revive);
    // pageshow fires on back/forward-cache restores, where visibilitychange
    // doesn't — a common way mobile users return to the app.
    window.addEventListener("pageshow", revive);
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (!socket) return;
    socket.removeAllListeners();
    socket.disconnect();
    // Dropping the reference means the next login builds a clean instance
    // rather than reviving one bound to the previous user's session.
    set({ socket: null, onlineUsers: [] });
  },
}));

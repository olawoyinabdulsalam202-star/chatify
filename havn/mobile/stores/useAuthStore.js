import { create } from "zustand";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { api, setAccessToken, setUnauthorizedHandler, storeAccessToken } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { bindSocketEvents } from "../lib/socketEvents";

function deviceName() {
  return Device.deviceName || [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || "Android device";
}

const SESSION_KEY = "havn.sessionId";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  token: null,
  sessionId: null,
  isHydrating: true,
  setSession: async (result) => {
    await storeAccessToken(result.token);
    if (result.sessionId) await SecureStore.setItemAsync(SESSION_KEY, String(result.sessionId));
    set({ authUser: result.user, token: result.token, sessionId: result.sessionId || null });
    const socket = connectSocket(result.token);
    bindSocketEvents(socket);
  },
  hydrate: async () => {
    try {
      const { getAccessToken } = await import("../lib/api");
      const token = await getAccessToken();
      if (!token) return;
      const sessionId = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null);
      setAccessToken(token);
      const user = await api("/auth/check");
      set({ authUser: user, token, sessionId });
      bindSocketEvents(connectSocket(token));
    } catch {
      await storeAccessToken(null);
      set({ authUser: null, token: null, sessionId: null });
    } finally {
      set({ isHydrating: false });
    }
  },
  login: async (email, password) => {
    const result = await api("/auth/login", {
      method: "POST",
      keepSessionOn401: true,
      body: { email: email.trim(), password, client: "mobile", platform: "android", deviceName: deviceName() },
    });
    await get().setSession(result);
    return result;
  },
  signup: async ({ username, email, password }) => api("/auth/signup", {
    method: "POST",
    body: { username: username.trim().toLowerCase(), email: email.trim(), password, client: "mobile" },
  }),
  verifyOtp: async (email, otp) => {
    const result = await api("/auth/verify-otp", {
      method: "POST",
      keepSessionOn401: true,
      body: { email: email.trim(), otp: otp.trim(), client: "mobile", platform: "android", deviceName: deviceName() },
    });
    await get().setSession(result);
    return result;
  },
  updateUser: (fields) => set({ authUser: { ...get().authUser, ...fields } }),
  clearSession: async () => {
    disconnectSocket();
    await storeAccessToken(null);
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => {});
    set({ authUser: null, token: null, sessionId: null });
    const [{ useChatStore }, { useMessageStore }, { usePresenceStore }] = await Promise.all([
      import("./useChatStore"), import("./useMessageStore"), import("./usePresenceStore"),
    ]);
    useChatStore.getState().reset();
    useMessageStore.getState().reset();
    usePresenceStore.getState().reset();
  },
  logout: async () => {
    try {
      const { unregisterPushDevice } = await import("../lib/push");
      await unregisterPushDevice();
      await api("/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("Logout request failed:", error.message);
    }
    await get().clearSession();
  },
}));

setUnauthorizedHandler(() => {
  useAuthStore.getState().clearSession();
});

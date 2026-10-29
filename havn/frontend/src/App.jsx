import { Navigate, Route, Routes, useLocation } from "react-router";
import ChatPage from "./pages/ChatPage";
import LandingPage from "./pages/LandingPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import SettingsPage from "./pages/SettingsPage";
import OtpVerifyPage from "./pages/OtpVerifyPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import PublicProfilePage from "./pages/PublicProfilePage";
import { useAuthStore } from "./store/useAuthStore";
import { useChatStore } from "./store/useChatStore";
import { useGroupStore } from "./store/useGroupStore";
import { useCallStore } from "./store/useCallStore";
import { useEffect, useLayoutEffect, useState } from "react";
import PageLoader from "./components/PageLoader";
import IncomingCallModal from "./components/IncomingCallModal";
import CallScreen from "./components/CallScreen";
import InstallPrompt from "./components/InstallPrompt";
import UpdatePrompt from "./components/UpdatePrompt";
import NotificationPermissionBanner from "./components/NotificationPermissionBanner";
import { loadFont, getFontStack } from "./lib/fonts";
import { playNotificationSoundOnce } from "./lib/audioUnlock";

import { Toaster } from "react-hot-toast";

function App() {
  const { checkAuth, isCheckingAuth, authUser, pendingVerificationEmail } = useAuthStore();
  const { callState, subscribeToCallEvents, unsubscribeFromCallEvents } = useCallStore();
  const selectedUser = useChatStore((state) => state.selectedUser);
  const selectedGroup = useGroupStore((state) => state.selectedGroup);
  const unreadCounts = useChatStore((state) => state.unreadCounts);
  const [isDocumentFocused, setIsDocumentFocused] = useState(
    () => document.visibilityState === "visible" && document.hasFocus()
  );
  const location = useLocation();
  const unreadTotal = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  // Full-bleed public pages run edge-to-edge with their own scroll instead of the
  // centred app shell: the logged-out landing page, plus the legal pages, which
  // stay full-bleed for logged-in and logged-out visitors alike.
  const isFullBleed =
    location.pathname.startsWith("/u/") ||
    location.pathname === "/privacy" ||
    location.pathname === "/terms" ||
    (!authUser && location.pathname === "/");
  const isChatScreen = Boolean(authUser && location.pathname === "/");

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const updateFocus = () => {
      const focused = document.visibilityState === "visible" && document.hasFocus();
      setIsDocumentFocused(focused);
      if (focused && location.pathname === "/") {
        const { selectedUser: openUser, clearUnreadForChat, markAsSeen } = useChatStore.getState();
        if (openUser) {
          clearUnreadForChat(openUser._id);
          markAsSeen(openUser._id);
        }
      }
    };
    window.addEventListener("focus", updateFocus);
    window.addEventListener("blur", updateFocus);
    document.addEventListener("visibilitychange", updateFocus);
    return () => {
      window.removeEventListener("focus", updateFocus);
      window.removeEventListener("blur", updateFocus);
      document.removeEventListener("visibilitychange", updateFocus);
    };
  }, [location.pathname]);

  useEffect(() => {
    document.title = authUser
      ? !isDocumentFocused && unreadTotal > 0
        ? `(${unreadTotal}) Havn`
        : "Havn"
      : "Havn — a calmer place to talk";
  }, [authUser, isDocumentFocused, unreadTotal]);

  useEffect(() => {
    if (!authUser || !("serviceWorker" in navigator)) return;
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type !== "PUSH_RECEIVED") return;
      const payload = event.data.payload || {};
      if (payload.kind !== "dm" && payload.kind !== "group") return;

      const currentUser = useAuthStore.getState().authUser;
      if (payload.senderId && String(payload.senderId) === String(currentUser?._id)) return;

      const focused = document.visibilityState === "visible" && document.hasFocus();
      const openUser = useChatStore.getState().selectedUser;
      const openGroup = useGroupStore.getState().selectedGroup;
      const isOpenFocusedChat = focused && location.pathname === "/" && (
        (payload.kind === "dm" && payload.senderId && String(openUser?._id) === String(payload.senderId)) ||
        (payload.kind === "group" && payload.groupId && String(openGroup?._id) === String(payload.groupId))
      );
      if (isOpenFocusedChat) return;

      if (payload.kind === "dm" && payload.senderId) {
        useChatStore.getState().recordIncomingMessage(payload.senderId, payload.messageId);
      }
      if (!useChatStore.getState().isSoundEnabled) return;
      playNotificationSoundOnce(payload.messageId || payload.tag);
    };
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
  }, [authUser, location.pathname]);

  // Call signalling is subscribed here rather than on ChatPage so it survives
  // navigation. It re-runs when authUser changes because the socket only exists
  // once logged in, and logout replaces it — subscribing against a null or
  // stale socket would silently never receive an incoming call.
  useEffect(() => {
    if (!authUser) return;
    subscribeToCallEvents();
    return () => unsubscribeFromCallEvents();
  }, [authUser, subscribeToCallEvents, unsubscribeFromCallEvents]);

  // Apply the user's saved theme/font preferences to the whole document —
  // this is what actually makes the Settings page take effect.
  useEffect(() => {
    const settings = authUser?.settings;

    document.documentElement.setAttribute("data-theme", settings?.theme || "dark");

    // Fetch the chosen family (no-op for system fonts and for one already
    // loaded), then point the app's font variable at its stack. getFontStack
    // only ever returns a stack for a family in the catalogue, so an unknown or
    // tampered stored value degrades to the default instead of reaching CSS.
    const fontId = settings?.fontFamily || "sans";
    loadFont(fontId);
    document.documentElement.style.setProperty("--user-font-family", getFontStack(fontId));

    if (settings?.fontColor) {
      document.documentElement.style.setProperty("--user-font-color", settings.fontColor);
    } else {
      document.documentElement.style.removeProperty("--user-font-color");
    }
  }, [authUser]);

  // A visible Havn tab should only suppress a push for the conversation the
  // user is actually reading, not for messages arriving in another chat.
  useEffect(() => {
    const context = location.pathname !== "/"
      ? null
      : selectedUser
      ? { kind: "dm", id: selectedUser._id }
      : selectedGroup
      ? { kind: "group", id: selectedGroup._id }
      : null;
    const message = { type: "ACTIVE_CONTEXT", context };
    navigator.serviceWorker?.controller?.postMessage(message);
    navigator.serviceWorker?.ready.then((registration) => registration.active?.postMessage(message)).catch(() => {});
  }, [location.pathname, selectedUser, selectedGroup]);

  // The safe-area inset padding lives on <body>, so its background is what fills
  // the notch and home-indicator gaps. The landing and legal pages are always
  // the light brand ground whatever the theme, while the app shell follows the
  // theme — tag the body per route so those insets never show a mismatched bar.
  useEffect(() => {
    document.body.dataset.fullbleed = isFullBleed ? "true" : "false";
  }, [isFullBleed]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("chat-screen-mounted", isChatScreen);
    return () => document.documentElement.classList.remove("chat-screen-mounted");
  }, [isChatScreen]);

  if (isCheckingAuth) return <PageLoader />;

  return (
    <div
      className={
        isFullBleed
          ? `min-h-[100dvh] overflow-x-hidden font-size-${authUser?.settings?.fontSize || "medium"}`
          : isChatScreen
          ? `h-[var(--app-h,100dvh)] min-h-0 bg-slate-900 relative flex items-center justify-center p-0 overflow-hidden md:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:p-4 font-size-${
              authUser?.settings?.fontSize || "medium"
            }`
          : `h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-0 bg-slate-900 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden font-size-${
              authUser?.settings?.fontSize || "medium"
            }`
      }
    >
      <Routes>
        <Route path="/u/:username" element={<PublicProfilePage />} />
        <Route path="/" element={authUser ? <ChatPage /> : <LandingPage />} />

        {/* Public marketing/legal pages — reachable whether or not you're signed in. */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="/login"
          element={
            authUser ? (
              <Navigate to={(() => {
                const redirect = new URLSearchParams(location.search).get("redirect");
                return redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
              })()} replace />
            ) : pendingVerificationEmail ? (
              <OtpVerifyPage />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/signup"
          element={
            authUser ? (
              <Navigate to={"/"} />
            ) : pendingVerificationEmail ? (
              <OtpVerifyPage />
            ) : (
              <SignUpPage />
            )
          }
        />
        <Route
          path="/forgot-password"
          element={authUser ? <Navigate to={"/"} /> : <ForgotPasswordPage />}
        />
        <Route
          path="/reset-password"
          element={authUser ? <Navigate to={"/"} /> : <ResetPasswordPage />}
        />
        <Route path="/settings" element={authUser ? <SettingsPage /> : <Navigate to={"/login"} />} />
        <Route
          path="/settings/:section"
          element={authUser ? <SettingsPage /> : <Navigate to={"/login"} />}
        />
      </Routes>

      {/* Call UI lives at the app root, not inside ChatPage. A call can arrive
          while the user is on Settings, and mounting these per-route meant the
          socket event fired with nothing rendered to answer it — the call was
          simply invisible and silent on that page. */}
      {authUser && callState === "ringing" && <IncomingCallModal />}
      {authUser && (callState === "calling" || callState === "active") && <CallScreen />}

      {/* Outside the auth check: someone stuck on an old build may be sitting on
          the login screen, and that's exactly who needs the offer most. */}
      <UpdatePrompt />

      <InstallPrompt />
      {authUser && <NotificationPermissionBanner userId={authUser._id} />}

      <Toaster />
    </div>
  );
}
export default App;

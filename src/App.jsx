import { Navigate, Route, Routes, useLocation } from "react-router";
import ChatPage from "./pages/ChatPage";
import LandingPage from "./pages/LandingPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import SettingsPage from "./pages/SettingsPage";
import OtpVerifyPage from "./pages/OtpVerifyPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import { useAuthStore } from "./store/useAuthStore";
import { useCallStore } from "./store/useCallStore";
import { useEffect } from "react";
import PageLoader from "./components/PageLoader";
import IncomingCallModal from "./components/IncomingCallModal";
import CallScreen from "./components/CallScreen";
import InstallPrompt from "./components/InstallPrompt";
import UpdatePrompt from "./components/UpdatePrompt";
import { loadFont, getFontStack } from "./lib/fonts";

import { Toaster } from "react-hot-toast";

function App() {
  const { checkAuth, isCheckingAuth, authUser, pendingVerificationEmail } = useAuthStore();
  const { callState, subscribeToCallEvents, unsubscribeFromCallEvents } = useCallStore();
  const location = useLocation();

  // Full-bleed public pages run edge-to-edge with their own scroll instead of the
  // centred app shell: the logged-out landing page, plus the legal pages, which
  // stay full-bleed for logged-in and logged-out visitors alike.
  const isFullBleed =
    location.pathname === "/privacy" ||
    location.pathname === "/terms" ||
    (!authUser && location.pathname === "/");

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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

  // The safe-area inset padding lives on <body>, so its background is what fills
  // the notch and home-indicator gaps. The landing and legal pages are always
  // the light brand ground whatever the theme, while the app shell follows the
  // theme — tag the body per route so those insets never show a mismatched bar.
  useEffect(() => {
    document.body.dataset.fullbleed = isFullBleed ? "true" : "false";
  }, [isFullBleed]);

  if (isCheckingAuth) return <PageLoader />;

  return (
    <div
      className={
        isFullBleed
          ? `min-h-[100dvh] overflow-x-hidden font-size-${authUser?.settings?.fontSize || "medium"}`
          : `min-h-[100dvh] bg-slate-900 relative flex items-center justify-center p-2 sm:p-4 overflow-x-hidden font-size-${
              authUser?.settings?.fontSize || "medium"
            }`
      }
    >
      <Routes>
        <Route path="/" element={authUser ? <ChatPage /> : <LandingPage />} />

        {/* Public marketing/legal pages — reachable whether or not you're signed in. */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="/login"
          element={
            authUser ? (
              <Navigate to={"/"} />
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
        <Route path="/settings" element={authUser ? <SettingsPage /> : <Navigate to={"/login"} />} />
        <Route
          path="/settings/:section"
          element={authUser ? <SettingsPage /> : <Navigate to={"/login"} />}
        />

        <Route
          path="/admin"
          element={authUser?.isAdmin ? <AdminDashboardPage /> : <Navigate to={"/"} />}
        />
      </Routes>

      {/* Call UI lives at the app root, not inside ChatPage. A call can arrive
          while the user is on Settings or the admin dashboard, and mounting
          these per-route meant the socket event fired with nothing rendered to
          answer it — the call was simply invisible and silent on those pages. */}
      {authUser && callState === "ringing" && <IncomingCallModal />}
      {authUser && (callState === "calling" || callState === "active") && <CallScreen />}

      {/* Outside the auth check: someone stuck on an old build may be sitting on
          the login screen, and that's exactly who needs the offer most. */}
      <UpdatePrompt />

      <InstallPrompt />

      <Toaster />
    </div>
  );
}
export default App;
import { useEffect, useRef, useState } from "react";
import { Stack, useLocalSearchParams, usePathname, useRootNavigationState, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { api } from "../lib/api";
import { useTheme } from "../lib/theme";
import { useAuthStore } from "../stores/useAuthStore";
import { useAppStore } from "../stores/useAppStore";
import LoadingView from "../components/LoadingView";
import UpdateRequired from "../components/UpdateRequired";
import UpdateBanner from "../components/UpdateBanner";
import AppDialog from "../components/AppDialog";
import Toast from "../components/Toast";
import { AppState, Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import messaging from "@react-native-firebase/messaging";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { loadFont } from "../lib/fonts";
import { nativeMessagingReady } from "../lib/callNotifications";
import { registerPushDevice, registerPushToken } from "../lib/push";
import { enableKeepAliveWithExplanation, startKeepAlive, stopKeepAlive } from "../lib/keepAlive";
import { getSocket, connectSocket } from "../lib/socket";
import { bindSocketEvents } from "../lib/socketEvents";
import { queueForLogin, setNavigationRouter, takeLoginDestination } from "../lib/navigation";
import { completeNotificationNavigation, consumeInitialNotification, getNotificationDestination } from "../lib/callNotifications";
import { useCallStore } from "../stores/useCallStore";

function compareVersion(first, second) {
  const a = String(first || "0").split(".").map(Number);
  const b = String(second || "0").split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function RootNavigation() {
  const theme = useTheme();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const routerReady = Boolean(navigationState?.key);
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const authUser = useAuthStore((state) => state.authUser);
  const sessionValidated = useAuthStore((state) => state.sessionValidated);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const hydrate = useAuthStore((state) => state.hydrate);
  const release = useAppStore((state) => state.androidRelease);
  const setAndroidRelease = useAppStore((state) => state.setAndroidRelease);
  const hydrateSound = useAppStore((state) => state.hydrateSound);
  const callState = useCallStore((state) => state.callState);
  const fontFamily = authUser?.settings?.fontFamily || "sans";
  const pushAttemptedUsers = useRef(new Set());
  const keepAliveAttemptedUsers = useRef(new Set());
  const initialNotificationConsumed = useRef(false);
  const skipAuthRedirect = useRef(false);
  const [loadedFontFamily, setLoadedFontFamily] = useState(null);
  const fontsReady = loadedFontFamily === fontFamily;

  useEffect(() => {
    hydrate();
    hydrateSound();
    api("/app/version").then((result) => {
      const android = result.android || null;
      if (!android) return;
      const installedVersion = Constants.expoConfig?.version || "1.0.0";
      setAndroidRelease({
        ...android,
        required: compareVersion(installedVersion, android.minVersion) < 0,
        available: compareVersion(installedVersion, android.latestVersion) < 0,
      });
    }).catch((error) => console.warn("App version check failed:", error.message));
  }, [hydrate, setAndroidRelease]);

  useEffect(() => {
    if (!authUser) {
      pushAttemptedUsers.current.clear();
      return undefined;
    }
    if (!sessionValidated || !nativeMessagingReady || Platform.OS !== "android") return undefined;
    const userId = String(authUser._id);
    if (!userId || pushAttemptedUsers.current.has(userId)) return undefined;
    pushAttemptedUsers.current.add(userId);
    registerPushDevice({ force: true });
    const unsubscribeTokenRefresh = messaging().onTokenRefresh((token) => {
      registerPushToken(token);
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") registerPushDevice();
    });
    return () => {
      unsubscribeTokenRefresh();
      appStateSubscription.remove();
    };
  }, [authUser?._id, sessionValidated]);

  useEffect(() => {
    if (!authUser) {
      keepAliveAttemptedUsers.current.clear();
      stopKeepAlive();
      return undefined;
    }
    if (!sessionValidated || !nativeMessagingReady) return undefined;
    const userId = String(authUser._id);
    if (!userId || keepAliveAttemptedUsers.current.has(userId)) return undefined;
    keepAliveAttemptedUsers.current.add(userId);
    let active = true;
    const openBatterySettings = () => router.push("/battery-optimization");
    (async () => {
      const preference = await AsyncStorage.getItem("havn.keepAlive").catch(() => null);
      if (!active) return;
      if (preference === "false") return;
      if (preference === null) {
        await enableKeepAliveWithExplanation(openBatterySettings);
        return;
      }
      await startKeepAlive();
    })().catch((error) => console.warn("Background connection service could not start:", error.message));
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const token = useAuthStore.getState().token;
      if (token) {
        const currentSocket = getSocket();
        if (!currentSocket) bindSocketEvents(connectSocket(token));
        else if (!currentSocket.connected) currentSocket.connect();
      }
      AsyncStorage.getItem("havn.keepAlive").then((enabled) => {
        if (enabled === "true" && useAuthStore.getState().authUser) startKeepAlive();
      }).catch(() => {});
    });
    return () => {
      active = false;
      appStateSubscription.remove();
    };
  }, [authUser?._id, sessionValidated, router]);

  useEffect(() => {
    setNavigationRouter(router, routerReady);
  }, [router, routerReady, pathname]);

  useEffect(() => {
    if (!authUser || isHydrating || !routerReady) return;
    const destination = takeLoginDestination();
    if (!destination) return;
    skipAuthRedirect.current = true;
    router.push(destination.path);
    destination.onNavigated?.();
  }, [authUser?._id, isHydrating, routerReady, router]);

  useEffect(() => {
    if (!fontsReady || isHydrating || !routerReady || initialNotificationConsumed.current) return;
    initialNotificationConsumed.current = true;
    consumeInitialNotification().then((notification) => {
      if (!notification) return;
      const path = getNotificationDestination(notification.data, notification.actionId);
      if (!path) return;
      const onNavigated = () => completeNotificationNavigation(notification.data);
      if (!authUser) {
        queueForLogin(path, onNavigated);
        return;
      }
      router.push(path);
      onNavigated();
    }).catch((error) => console.warn("Initial notification navigation failed:", error.message));
  }, [fontsReady, isHydrating, routerReady, authUser?._id, router]);

  useEffect(() => {
    let active = true;
    loadFont(fontFamily).then(() => {
      const current = useAuthStore.getState().authUser;
      if (current && (current.settings?.fontFamily || "sans") === fontFamily) useAuthStore.getState().updateUser({ settings: { ...current.settings } });
    }).finally(() => { if (active) setLoadedFontFamily(fontFamily); });
    return () => { active = false; };
  }, [fontFamily]);

  useEffect(() => {
    const publicPath = pathname.startsWith("/u/") || pathname.startsWith("/qr/");
    const authPath = ["/login", "/signup", "/verify"].includes(pathname);
    const redirect = typeof params.redirect === "string" && params.redirect.startsWith("/") && !params.redirect.startsWith("//")
      ? params.redirect
      : "/";
    if (!isHydrating && !authUser && !authPath && !publicPath) router.replace("/login");
    if (!isHydrating && authUser && authPath) {
      if (skipAuthRedirect.current) { skipAuthRedirect.current = false; return; }
      router.replace(redirect);
    }
  }, [pathname, params.redirect, authUser, isHydrating, router]);

  useEffect(() => {
    if (isHydrating) return;
    if (callState !== "idle" && pathname !== "/call") router.push("/call");
  }, [callState, pathname, isHydrating, router]);

  if (isHydrating) return <View style={{ flex: 1, backgroundColor: theme.background }}><LoadingView label="Opening Havn" /></View>;
  if (release?.required) return <UpdateRequired />;

  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    {authUser && release?.available && <UpdateBanner />}
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background }, animation: "fade_from_bottom" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="create-group" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="call" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="battery-optimization" />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="assistant" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/[section]" />
      <Stack.Screen name="settings/blocked" />
      <Stack.Screen name="settings/legal/[doc]" />
      <Stack.Screen name="link-device" />
      <Stack.Screen name="qr/[code]" />
      <Stack.Screen name="u/[username]" />
    </Stack>
    <AppDialog />
    <Toast />
  </View>;
}

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><RootNavigation /><StatusBar style="auto" /></SafeAreaProvider></GestureHandlerRootView>;
}

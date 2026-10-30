import { useEffect } from "react";
import { Stack, useLocalSearchParams, usePathname, useRouter } from "expo-router";
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
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { loadFont } from "../lib/fonts";

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
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const authUser = useAuthStore((state) => state.authUser);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const hydrate = useAuthStore((state) => state.hydrate);
  const release = useAppStore((state) => state.androidRelease);
  const setAndroidRelease = useAppStore((state) => state.setAndroidRelease);
  const hydrateSound = useAppStore((state) => state.hydrateSound);

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
    const fontFamily = authUser?.settings?.fontFamily || "sans";
    loadFont(fontFamily).then(() => {
      const current = useAuthStore.getState().authUser;
      if (current && (current.settings?.fontFamily || "sans") === fontFamily) useAuthStore.getState().updateUser({ settings: { ...current.settings } });
    });
  }, [authUser?.settings?.fontFamily]);

  useEffect(() => {
    const publicPath = pathname.startsWith("/u/") || pathname.startsWith("/qr/");
    const authPath = ["/login", "/signup", "/verify"].includes(pathname);
    const redirect = typeof params.redirect === "string" && params.redirect.startsWith("/") && !params.redirect.startsWith("//")
      ? params.redirect
      : "/";
    if (!isHydrating && !authUser && !authPath && !publicPath) router.replace("/login");
    if (!isHydrating && authUser && authPath) router.replace(redirect);
  }, [pathname, params.redirect, authUser, isHydrating, router]);

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
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="assistant" />
      <Stack.Screen name="settings/index" />
      <Stack.Screen name="settings/[section]" />
      <Stack.Screen name="settings/legal/[doc]" />
      <Stack.Screen name="link-device" />
      <Stack.Screen name="qr/[code]" />
      <Stack.Screen name="u/[username]" />
    </Stack>
  </View>;
}

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><RootNavigation /><StatusBar style="auto" /></SafeAreaProvider></GestureHandlerRootView>;
}

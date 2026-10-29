import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || "https://api.kairos-va.com").replace(/\/+$/, "");
const API_BASE = API_ORIGIN.endsWith("/api") ? API_ORIGIN : `${API_ORIGIN}/api`;
const TOKEN_KEY = "havn.deviceToken";
let accessToken = null;
let unauthorizedHandler = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export async function getAccessToken() {
  if (accessToken) return accessToken;
  try {
    accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    accessToken = null;
  }
  return accessToken;
}

export async function storeAccessToken(token) {
  accessToken = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function friendlyMessage(status, message) {
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403) return message || "You do not have access to this.";
  if (status === 404) return message || "This could not be found.";
  if (status === 429) return message || "Please wait a moment and try again.";
  return message || "Something went wrong. Please try again.";
}

export async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 20000);
  const token = await getAccessToken();
  const customHeaders = Object.fromEntries(
    Object.entries(options.headers || {}).filter(([name]) => !["x-client", "user-agent"].includes(name.toLowerCase()))
  );
  const headers = {
    ...customHeaders,
    Accept: "application/json",
    "x-client": "havn-mobile",
    "User-Agent": `HavnAndroid/${Constants.expoConfig?.version || "1.0.0"}`,
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  try {
    const response = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
      headers,
      body: options.body && !(options.body instanceof FormData) && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token && !options.keepSessionOn401) {
        await storeAccessToken(null);
        unauthorizedHandler?.();
      }
      const error = new Error(friendlyMessage(response.status, data.message || data.error));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The request timed out. Check your connection and try again.");
    if (error instanceof TypeError) throw new Error("Could not reach Havn. Check your internet connection.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export { API_ORIGIN, API_BASE, TOKEN_KEY };
